import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from './config.js';
import * as common from './common.js';


const gcloudbuild = new CloudBuildClient();

export enum PushType {
    PushToBranch = 'branch',
    PushToTag = 'tag',
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
        const serviceName = trigger?.substitutions?.['_SERVICE_NAME'] || common.getRepoAlias(repoName);
        const serviceCategory = common.getServiceCategory(serviceName);

        if(!includeAll && common.excludeService(serviceName)) {
            continue;
        }

        const pushType = (trigger.triggerTemplate) ? (
            (trigger.triggerTemplate.branchName) ? PushType.PushToBranch :
            (trigger.triggerTemplate.tagName) ? PushType.PushToTag : PushType.Other
        ) : (trigger.github?.push) ? (
            (trigger.github.push.branch) ? PushType.PushToBranch :
            (trigger.github.push.tag) ? PushType.PushToTag : PushType.Other
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
    if (newType === PushType.PushToBranch) {
        afterPushType = PushType.PushToBranch;
        afterPattern = config.PUSH_TO_BRANCH_PATTERN;
        newTrigger.triggerTemplate!.branchName = afterPattern;
        newTrigger.triggerTemplate!.tagName = undefined;
        // newTrigger.name = `${trigger.name?.replace('-push-to-tag', '')}-push-to-branch`
    } else if (newType === PushType.PushToTag) {
        afterPushType = PushType.PushToTag;
        afterPattern = config.PUSH_TO_TAG_PATTERN;
        newTrigger.triggerTemplate!.branchName = undefined;
        newTrigger.triggerTemplate!.tagName = afterPattern;
        // newTrigger.name = `${trigger.name?.replace('-push-to-branch', '')}-push-to-tag`
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
