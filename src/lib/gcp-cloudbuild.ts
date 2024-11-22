import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from './config.js';
import * as common from './common.js';
import * as cloudrun from './gcp-cloudrun-v1.js';


const gcloudbuild = new CloudBuildClient();

export enum PushType {
    Branch = 'push-to-branch',
    Tag = 'push-to-tag',
    Other = 'other'
}

export type Trigger = {
    serviceName: string;
    serviceCategory: string;
    repoType: string;
    repoHost: string|undefined;
    repoProject: string|undefined;
    name: string;
    id: string|undefined;
    disabled: boolean;
    labels: string;
    pushType: PushType;
    pattern: string;
}

export type TriggerUpdated = Trigger & {
    beforePushType: string;
    beforePattern: string;
    afterPushType: string;
    afterPattern: string;
}


export async function enumerateTriggers(includeAll: boolean = false): Promise<Trigger[]> {
    const [triggers] = await gcloudbuild.listBuildTriggers({ projectId: config.PROJECT_ID });

    let triggerArray: Trigger[] = [];

    triggers.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    for (const trigger of triggers) {
        const name = trigger.name ?? '---';
        const repoType = trigger.github ? "GitHub"
            : (trigger.sourceToBuild?.uri?.includes('bitbucket')) ? "Bitbucket"
            : (trigger.triggerTemplate?.repoName) ? "mirrored"
            : "unknown";
        const labels = trigger.tags?.join(', ') ?? '---';
        const [repoHost, repoProject, repoName] = common.splitRepoName(trigger.triggerTemplate?.repoName);
        const serviceName = trigger?.substitutions?.['_SERVICE_NAME'] || common.getServiceName(repoName);
        const serviceCategory = common.getServiceCategory(serviceName);

        if(!includeAll && common.excludeService(serviceName)) {
            continue;
        }

        const pushType = (trigger.triggerTemplate) ? (
            (trigger.triggerTemplate.branchName) ? PushType.Branch :
            (trigger.triggerTemplate.tagName) ? PushType.Tag : PushType.Other
        ) : (trigger.github?.push) ? (
            (trigger.github.push.branch) ? PushType.Branch :
            (trigger.github.push.tag) ? PushType.Tag : PushType.Other
        ) : PushType.Other;
        const pattern = trigger.triggerTemplate?.branchName ?? trigger.triggerTemplate?.tagName ?? '---';

        triggerArray.push({
            serviceName: serviceName || '---',
            serviceCategory,
            repoType,
            repoHost,
            repoProject,
            name,
            id: trigger.id ?? '---',
            disabled: trigger.disabled || false,
            labels,
            pushType,
            pattern
        });
    }

    triggerArray?.sort((a, b) => {
        if (a.serviceCategory === b.serviceCategory) {
            return a.serviceName.localeCompare(b.serviceName);
        }
        return a.serviceCategory.localeCompare(b.serviceCategory);
    });


    return triggerArray;
}

export async function normalizePattern(t: Trigger, whitelistedOnly: boolean, newType: PushType): Promise<TriggerUpdated|undefined> {
    if(whitelistedOnly && !config.WHITELISTED_SERVICES.find((n:string) => n === t.serviceName)) {
        return;
    }
    if (!t.id) {
        return;
    }
    const [trigger] = await gcloudbuild.getBuildTrigger({ projectId: config.PROJECT_ID, triggerId: t.id });
    if (!trigger) {
        return;
    }

    // update trigger
    let afterPushType: string = "";
    let afterPattern: string = "";
    trigger.name = trigger.name?.replace('-push-to-tag', '')
    trigger.name = trigger.name?.replace('-push-to-branch', '')
    trigger.name = trigger.name?.replace('-build-and-deploy', '')
    if (newType === PushType.Branch) {
        afterPushType = PushType.Branch;
        afterPattern = config.PUSH_TO_BRANCH_PATTERN;
        trigger.triggerTemplate!.branchName = afterPattern;
        trigger.triggerTemplate!.tagName = undefined;
        trigger.name = `${trigger.name}-push-to-branch`;
    } else if (newType === PushType.Tag) {
        afterPushType = PushType.Tag;
        afterPattern = config.PUSH_TO_TAG_PATTERN;
        trigger.triggerTemplate!.branchName = undefined;
        trigger.triggerTemplate!.tagName = afterPattern;
        trigger.name = `${trigger.name}-push-to-tag`;
    } else {
        return;
    }
    trigger.tags = Array.from(new Set([...(trigger.tags || []), ...config.TRIGGER_LABELS]));
    let [updatedTrigger] = await gcloudbuild.updateBuildTrigger({ projectId: config.PROJECT_ID, triggerId: t.id, trigger });
    return {
        ...t,
        name: updatedTrigger?.name || '---',
        beforePushType: t.pushType,
        beforePattern: t.pattern,
        afterPushType,
        afterPattern
    };
}

export async function cloneTrigger(t: Trigger, whitelistedOnly: boolean, newType: PushType): Promise<TriggerUpdated|undefined> {
    if (whitelistedOnly && !config.WHITELISTED_SERVICES.find((n: string) => n === t.serviceName)) {
        return;
    }
    if (!t.id) {
        return;
    }
    const [trigger] = await gcloudbuild.getBuildTrigger({ projectId: config.PROJECT_ID, triggerId: t.id });
    if (!trigger) {
        return;
    }

    // Create a new trigger with the same configuration
    const newTrigger = {
        ...trigger,
        id: undefined, // Ensure the ID is not set for the new trigger
    };
    let afterPushType: string = "";
    let afterPattern: string = "";
    if (newType === PushType.Branch) {
        afterPushType = PushType.Branch;
        afterPattern = config.PUSH_TO_BRANCH_PATTERN;
        newTrigger.triggerTemplate!.branchName = afterPattern;
        newTrigger.triggerTemplate!.tagName = undefined;
        newTrigger.name = `${trigger.name?.replace('-push-to-tag', '')}-push-to-branch`
    } else if (newType === PushType.Tag) {
        afterPushType = PushType.Tag;
        afterPattern = config.PUSH_TO_TAG_PATTERN;
        newTrigger.triggerTemplate!.branchName = undefined;
        newTrigger.triggerTemplate!.tagName = afterPattern;
        newTrigger.name = `${trigger.name?.replace('-push-to-branch', '')}-push-to-tag`
    } else {
        return;
    }
    const [createdTrigger] = await gcloudbuild.createBuildTrigger({ projectId: config.PROJECT_ID, trigger: newTrigger });

    if (!createdTrigger) {
        return;
    }

    return {
        ...t,
        name: createdTrigger.name || '---',
        beforePushType: t.pushType,
        beforePattern: t.pattern,
        afterPushType,
        afterPattern
    };
}

export async function triggerMigration001(whitelistedOnly: boolean, newType: PushType): Promise<TriggerUpdated[]> {
    const triggers = await enumerateTriggers(true);

    let triggersUpdated: TriggerUpdated[] = [];

    for (const t of triggers) {
        if(whitelistedOnly && !config.WHITELISTED_SERVICES.find((n:string) => n === t.serviceName)) {
            continue;
        }

        let updatedTrigger = await normalizePattern(t, whitelistedOnly, newType);
        if (updatedTrigger) {
            triggersUpdated.push(updatedTrigger);
        }
    }
    return triggersUpdated;
}


export async function triggerMigration002(whitelistedOnly: boolean): Promise<TriggerUpdated[]> {
    const services = await cloudrun.enumerateServices(true);
    const triggers = await enumerateTriggers(true);
    let triggersUpdated: TriggerUpdated[] = [];

    for (const s of services) {
        if(whitelistedOnly && !config.WHITELISTED_SERVICES.find((n:string) => n === s.serviceName)) {
            continue;
        }
        const pushToTagTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === PushType.Tag);
        const pushToTagBranchTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === PushType.Branch);
        if (!pushToTagTrigger && !pushToTagBranchTrigger) {
            continue;
        }
        if (pushToTagTrigger) {
            let updatedTrigger = await normalizePattern(pushToTagTrigger, whitelistedOnly, PushType.Tag);
            if (updatedTrigger) {
                triggersUpdated.push(updatedTrigger);
            }
        }
        if (pushToTagBranchTrigger) {
            let updatedTrigger = await normalizePattern(pushToTagBranchTrigger, whitelistedOnly, PushType.Branch);
            if (updatedTrigger) {
                triggersUpdated.push(updatedTrigger);
            }
        }

        if (pushToTagTrigger && !pushToTagBranchTrigger) {
            let createdTrigger = await cloneTrigger(pushToTagTrigger, whitelistedOnly, PushType.Branch);
            if (createdTrigger) {
                triggersUpdated.push(createdTrigger);
            }
        }
        if (!pushToTagTrigger && pushToTagBranchTrigger) {
            let createdTrigger = await cloneTrigger(pushToTagBranchTrigger, whitelistedOnly, PushType.Tag);
            if (createdTrigger) {
                triggersUpdated.push(createdTrigger);
            }
        }
    }
    return triggersUpdated;
}
