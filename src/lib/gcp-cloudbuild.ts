import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from './config.js';

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

export async function enumerateTriggers(filtered: boolean = false): Promise<Trigger[]> {
    const [triggers] = await gcloudbuild.listBuildTriggers({ projectId: config.PROJECT_ID });

    let triggerArray: Trigger[] = [];

    triggers.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    triggers.forEach(trigger => {
        if (filtered && config.FILTERED_SERVICES.length > 0 && !config.FILTERED_TRIGGERS.find((n:string) => n === trigger.name)) {
            return;
        }
        const name = trigger.name ?? '---';
        const repoType = trigger.github ? "GitHub"
            : (trigger.sourceToBuild?.uri?.includes('bitbucket')) ? "Bitbucket"
            : (trigger.triggerTemplate?.repoName) ? "mirrored"
            : "unknown";
        const labels = trigger.tags?.join(', ') ?? '---';
        let repoHost, repoProject: string|undefined;
        let repository: string[];

        const repoName = trigger.triggerTemplate && trigger.triggerTemplate.repoName
            ? (() => {
                [repoHost, repoProject, ...repository] = trigger.triggerTemplate.repoName.split('_');
                if (!repoProject) {
                    [repoProject, ...repository] = trigger.triggerTemplate.repoName.split('/');
                    repoHost = "";
                }
                if(repoHost) {
                    repoHost = repoHost.replace(/^./, (char) => char.toUpperCase());
                }
                if (repoProject === "brainfinance")
                    return `${repository.join('-')}`;
                return `${repoProject}/${repository.join('-')}`;
            })()
            : '---';
            
        const serviceCategory = config.BACKEND_SERVICES.includes(repoName) ? 'BACKEND SERVICES' :
            config.BACKOFFICE_SERVICES.includes(repoName) ? 'BACKOFFICE SERVICES' :
            config.BRIDGE_SERVICES.includes(repoName) ? 'BRIDGE SERVICES' :
            config.MONITORING_SERVICES.includes(repoName) ? 'MONITORING SERVICES' :
            config.DATASCIENCE_SERVICES.includes(repoName) ? 'DATASCIENCE SERVICES' :
            'OTHER';

        const pushType = (trigger.triggerTemplate) ? (
            (trigger.triggerTemplate.branchName) ? PushType.Branch :
            (trigger.triggerTemplate.tagName) ? PushType.Tag : PushType.Other
        ) : (trigger.github?.push) ? (
            (trigger.github.push.branch) ? PushType.Branch :
            (trigger.github.push.tag) ? PushType.Tag : PushType.Other
        ) : PushType.Other;
        const pattern = trigger.triggerTemplate?.branchName ?? trigger.triggerTemplate?.tagName ?? '---';

        triggerArray.push({
            serviceName: repoName,
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
    });

    return triggerArray;
}

