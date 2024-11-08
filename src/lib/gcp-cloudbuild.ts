import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from './config.js';
import * as common from './common.js';

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

export async function updateTriggers(filtered: boolean, newType: PushType): Promise<TriggerUpdated[]> {
    const triggers = await enumerateTriggers(filtered);

    let triggersUpdated: TriggerUpdated[] = [];

    for (const t of triggers) {
        if(filtered && !config.FILTERED_TRIGGERS.find((n:string) => n === t.name)) {
            continue;
        }
        if (!t.id) {
            continue;
        }
        const [trigger] = await gcloudbuild.getBuildTrigger({ projectId: config.PROJECT_ID, triggerId: t.id });
        if (!trigger) {
            continue;
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
            continue;
        }
        trigger.tags = Array.from(new Set([...(trigger.tags || []), ...config.TRIGGER_LABELS]));
        await gcloudbuild.updateBuildTrigger({ projectId: config.PROJECT_ID, triggerId: t.id, trigger });
        triggersUpdated.push({
            ...t,
            beforePushType: t.pushType,
            beforePattern: t.pattern,
            afterPushType,
            afterPattern
        });
    }

    return triggersUpdated;
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

