import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { table } from 'table';

const gcloud = new CloudBuildClient();

const PROJECT_ID = 'development-brainfinance';
const TRIGGER_LABELS = ["icash", "backend", "development"];
const BRANCH_PATTERN = "develop|^feature|^bugfix";
const TAG_PATTERN = "dev-*";
const SELECTED_TRIGGER_NAMES = [
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

async function triggerNormalize(triggerType: TriggerType): Promise<void> {
  console.log("[devenv] Normalizing triggers");
  const [allTriggers] = await gcloud.listBuildTriggers({ projectId: PROJECT_ID });
  
    for (const triggerName of SELECTED_TRIGGER_NAMES) {
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

async function triggerList(): Promise<void> {
    const [triggers] = await gcloud.listBuildTriggers({ projectId: PROJECT_ID });

    const header = ['REPO', 'REPO TYPE', 'TRIGGER STATUS', 'NAME', 'LABELS', 'BRANCH/TAG', 'PATTERN'].map(text => `\x1b[1;34m${text}\x1b[0m`);
    const data = [ header ];

    triggers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    triggers.forEach(trigger => {
        // if (!SELECTED_TRIGGER_NAMES.includes(trigger.name || ''))
        //     return;

        const status = trigger.disabled ? 'Disabled' : 'Enabled';
        const triggerName = trigger.name || '---';
        const repoType = trigger.github ? "GitHub"
            : (trigger.sourceToBuild && trigger.sourceToBuild.uri && trigger.sourceToBuild.uri.includes('bitbucket')) ? "Bitbucket"
            : (trigger.triggerTemplate && trigger.triggerTemplate.repoName) ? "CloudSource"
            : "Unknown";
        const labels = trigger.tags?.join(', ') || '---';
        let host, project: string|undefined;
        let repository: string[];
        const repoName = trigger.triggerTemplate && trigger.triggerTemplate.repoName
            ? (() => {
                [host, project, ...repository] = trigger.triggerTemplate.repoName.split('_');
                if (!project) {
                    [project, ...repository] = trigger.triggerTemplate.repoName.split('/');
                    host = "";
                }
                if (!host) {
                    host = host;
                }
                if (project === "brainfinance")
                    return `${repository.join('-')}`;
                return `${project}/${repository.join('-')}`;
            })()
            : '---';
        const branchOrTag = (trigger.triggerTemplate) ? (
            (trigger.triggerTemplate.branchName) ? "Branch-based" :
            (trigger.triggerTemplate.tagName) ? "Tag-based" : "other"
        ) : (trigger.github && trigger.github.push) ? (
            (trigger.github.push.branch) ? "GitHub branch-based" :
            (trigger.github.push.tag) ? "GitHub tag-based" : "GitHub other"
        ) : "???";
        const pattern = trigger.triggerTemplate?.branchName || trigger.triggerTemplate?.tagName || '---';

        data.push([repoName, repoType +  `(${host})`, triggerName, status, labels, branchOrTag, pattern]);
    });

    const output = table(data);
    console.log(output);
}

export { triggerNormalize, triggerList, TriggerType };
