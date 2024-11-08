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
        const serviceName = common.getServiceName(repoName);
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

export async function normalizePattern(t: Trigger, filtered: boolean, newType: PushType): Promise<TriggerUpdated|undefined> {
    if(filtered && !config.FILTERED_TRIGGERS.find((n:string) => n === t.name)) {
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
    if (newType === PushType.Branch) {
        afterPushType = PushType.Branch;
        afterPattern = config.PUSH_TO_BRANCH_PATTERN;
        trigger.triggerTemplate!.branchName = afterPattern;
        trigger.triggerTemplate!.tagName = undefined;
    } else if (newType === PushType.Tag) {
        afterPushType = PushType.Tag;
        afterPattern = config.PUSH_TO_TAG_PATTERN;
        trigger.triggerTemplate!.branchName = undefined;
        trigger.triggerTemplate!.tagName = afterPattern;
    } else {
        return;
    }
    trigger.tags = Array.from(new Set([...(trigger.tags || []), ...config.TRIGGER_LABELS]));
    await gcloudbuild.updateBuildTrigger({ projectId: config.PROJECT_ID, triggerId: t.id, trigger });
    return {
        ...t,
        beforePushType: t.pushType,
        beforePattern: t.pattern,
        afterPushType,
        afterPattern
    };
}

export async function copyTrigger(t: Trigger, filtered: boolean, newType: PushType): Promise<TriggerUpdated|undefined> {


}

export async function triggerMigration001(filtered: boolean, newType: PushType): Promise<TriggerUpdated[]> {
    const triggers = await enumerateTriggers(filtered);

    let triggersUpdated: TriggerUpdated[] = [];

    for (const t of triggers) {
        let updatedTrigger = await normalizePattern(t, filtered, newType);
        if (updatedTrigger) {
            triggersUpdated.push(updatedTrigger);
        }
    }
    return triggersUpdated;
}


export async function triggerMigration002(filtered: boolean, newType: PushType): Promise<TriggerUpdated[]> {
    const services = await cloudrun.enumerateServices(true);
    const triggers = await enumerateTriggers(true);
    let triggersUpdated: TriggerUpdated[] = [];

    for (const s of services) {
        const pushToTagTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === PushType.Tag);
        const pushToTagBranchTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === PushType.Branch);
        
        if (pushToTagTrigger && pushToTagBranchTrigger) {
            continue;
        }
        if (!pushToTagTrigger && !pushToTagBranchTrigger) {
            continue;
        }
        if (pushToTagTrigger && !pushToTagBranchTrigger) {
            let updatedTrigger = await normalizePattern(pushToTagTrigger, filtered, PushType.Tag);
            if (updatedTrigger) {
                triggersUpdated.push(updatedTrigger);
            }
            let createdTrigger = await copyTrigger(pushToTagTrigger, filtered, PushType.Branch);
            if (createdTrigger) {
                triggersUpdated.push(createdTrigger);
            }
        }
        if (!pushToTagTrigger && pushToTagBranchTrigger) {
            let updatedTrigger = await normalizePattern(pushToTagBranchTrigger, filtered, PushType.Branch);
            if (updatedTrigger) {
                triggersUpdated.push(updatedTrigger);
            }
            let createdTrigger = await copyTrigger(pushToTagBranchTrigger, filtered, PushType.Tag);
            if (createdTrigger) {
                triggersUpdated.push(createdTrigger);
            }
        }
    }
    return triggersUpdated;
}