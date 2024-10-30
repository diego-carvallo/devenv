import { CloudBuildClient } from '@google-cloud/cloudbuild';

const gcloud = new CloudBuildClient();

const PROJECT_ID = 'development-brainfinance';
const TRIGGER_LABELS = ["icash", "backend", "development"];
const BRANCH_PATTERN = "develop|^feature|^bugfix";
const TAG_PATTERN = "dev-*";
export const FILTERED_TRIGGER_NAMES = [
  "alicia-build-and-deploy-DEPRECATED",
//   "backoffice-frontend-build",
//   "backoffice-pubsub-ws-bridge",
//   "clamav-malware-scanner",
//   "contentful-cache-build-and-deploy",
//   "furious-application-api",
//   "furious-backoffice-api",
//   "furious-communication-api",
//   "furious-dms-api",
//   "gcp-storage-bridge-build-and-deploy",
//   "maria-build-and-deploy",
//   "pubsub-api-bridge-build-and-deploy",
//   "rudderstack-service-build-and-deploy",
//   "seon-service-build-and-deploy",
//   "sms-service-build-and-deploy"
];

export enum PushType {
    Branch = 'push-to-branch',
    Tag = 'push-to-tag',
    Other = 'other'
}

export type Trigger = {
    repoName: string;
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
        if(filtered && !FILTERED_TRIGGER_NAMES.find(n => n === t.name)) {
            continue;
        }
        if (!t.id) {
            continue;
        }
        const [trigger] = await gcloud.getBuildTrigger({ projectId: PROJECT_ID, triggerId: t.id });
        if (!trigger) {
            continue;
        }

        // update trigger
        let afterPushType: string = "";
        let afterPattern: string = "";
        if (newType === PushType.Branch) {
            afterPushType = PushType.Branch;
            afterPattern = BRANCH_PATTERN;
            trigger.triggerTemplate!.branchName = afterPattern;
            trigger.triggerTemplate!.tagName = undefined;
        } else if (newType === PushType.Tag) {
            afterPushType = PushType.Tag;
            afterPattern = TAG_PATTERN;
            trigger.triggerTemplate!.branchName = undefined;
            trigger.triggerTemplate!.tagName = afterPattern;
        } else {
            continue;
        }
        trigger.tags = Array.from(new Set([...(trigger.tags || []), ...TRIGGER_LABELS]));
        await gcloud.updateBuildTrigger({ projectId: PROJECT_ID, triggerId: t.id, trigger });
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
    const [triggers] = await gcloud.listBuildTriggers({ projectId: PROJECT_ID });

    let triggerArray: Trigger[] = [];

    triggers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    triggers.forEach(trigger => {
        if (filtered && !FILTERED_TRIGGER_NAMES.find(n => n === trigger.name)) {
            return;
        }
        const name = trigger.name || '---';
        const repoType = trigger.github ? "GitHub"
            : (trigger.sourceToBuild && trigger.sourceToBuild.uri && trigger.sourceToBuild.uri.includes('bitbucket')) ? "Bitbucket"
            : (trigger.triggerTemplate && trigger.triggerTemplate.repoName) ? "mirrored"
            : "Unknown";
        const labels = trigger.tags?.join(', ') || '---';
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
        const pushType = (trigger.triggerTemplate) ? (
            (trigger.triggerTemplate.branchName) ? PushType.Branch :
            (trigger.triggerTemplate.tagName) ? PushType.Tag : PushType.Other
        ) : (trigger.github && trigger.github.push) ? (
            (trigger.github.push.branch) ? PushType.Branch :
            (trigger.github.push.tag) ? PushType.Tag : PushType.Other
        ) : PushType.Other;
        const pattern = trigger.triggerTemplate?.branchName || trigger.triggerTemplate?.tagName || '---';

        triggerArray.push({
            repoName,
            repoType,
            repoHost,
            repoProject,
            name,
            id: trigger.id || '---',
            disabled: trigger.disabled || false,
            labels,
            pushType,
            pattern
        });
    });

    return triggerArray;
}

