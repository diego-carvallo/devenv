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


async function updateTrigger(triggerName: string, triggerId: string, triggerType: TriggerType, tags: string[]): Promise<void> {
    const [trigger] = await gcloud.getBuildTrigger({ projectId: PROJECT_ID, triggerId });
    if (trigger) {
        if (triggerType === TriggerType.Branch) {
            trigger.triggerTemplate!.branchName = BRANCH_PATTERN;
            trigger.triggerTemplate!.tagName = undefined;
            console.log(`[devenv] Updating trigger [${triggerName}] with [${triggerType}] pattern [${BRANCH_PATTERN}]`);
        } else if (triggerType === TriggerType.Tag) {
            trigger.triggerTemplate!.branchName = undefined;
            trigger.triggerTemplate!.tagName = TAG_PATTERN;
            console.log(`[devenv] Updating trigger [${triggerName}] with [${triggerType}] pattern [${TAG_PATTERN}]`);
        }
        trigger.tags = Array.from(new Set([...(trigger.tags || []), ...tags]));
        await gcloud.updateBuildTrigger({ projectId: PROJECT_ID, triggerId, trigger });
    }
}

enum TriggerType {
    Branch = 'branch',
    Tag = 'tag'
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
    branchOrTag: string;
    pattern: string;
}

async function triggerNormalize(triggerType: TriggerType): Promise<void> {
  console.log("[devenv] Normalizing triggers");
  const [allTriggers] = await gcloud.listBuildTriggers({ projectId: PROJECT_ID });
  
    for (const triggerName of FILTERED_TRIGGER_NAMES) {
        const trigger = allTriggers.find(t => t.name === triggerName);
        const triggerId = trigger ? trigger.id : null;

        if (triggerId) {
            await updateTrigger(triggerName, triggerId, triggerType, TRIGGER_LABELS);
        } else {
            console.log(`[devenv] Trigger not found: ${triggerName}`);
        }
    }

    console.log("[devenv] Done normalizing");
}

async function triggerArray(): Promise<Trigger[]> {
    const [triggers] = await gcloud.listBuildTriggers({ projectId: PROJECT_ID });

    let triggerArray: Trigger[] = [];

    triggers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    triggers.forEach(trigger => {
        const name = trigger.name || '---';
        const repoType = trigger.github ? "GitHub"
            : (trigger.sourceToBuild && trigger.sourceToBuild.uri && trigger.sourceToBuild.uri.includes('bitbucket')) ? "Bitbucket"
            : (trigger.triggerTemplate && trigger.triggerTemplate.repoName) ? "Mirrored"
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
        const branchOrTag = (trigger.triggerTemplate) ? (
            (trigger.triggerTemplate.branchName) ? "branch-based" :
            (trigger.triggerTemplate.tagName) ? "tag-based" : "other"
        ) : (trigger.github && trigger.github.push) ? (
            (trigger.github.push.branch) ? "GitHub branch-based" :
            (trigger.github.push.tag) ? "GitHub tag-based" : "GitHub other"
        ) : "???";
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
            branchOrTag,
            pattern
        });
    });

    return triggerArray;
}

export { triggerNormalize, triggerArray, TriggerType };
