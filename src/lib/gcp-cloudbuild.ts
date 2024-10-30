import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { table } from 'table';

const client = new CloudBuildClient();

const PROJECT_ID = 'development-brainfinance';
const BRANCH_PATTERN = "develop|^feature|^bugfix";
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

async function getTriggerId(triggerName: string): Promise<string | null> {
    const [triggers] = await client.listBuildTriggers({ projectId: PROJECT_ID });
    const trigger = triggers.find(t => t.name === triggerName);
    return trigger && trigger.id ? trigger.id : null;
}

async function updateTrigger(triggerId: string, branchPattern: string, tags: string[]): Promise<void> {
    const [trigger] = await client.getBuildTrigger({ projectId: PROJECT_ID, triggerId });
    if (trigger) {
        trigger.triggerTemplate!.branchName = branchPattern;
        trigger.tags = Array.from(new Set([...(trigger.tags || []), ...tags]));
        await client.updateBuildTrigger({ projectId: PROJECT_ID, triggerId, trigger });
    }
}

async function triggerNormalize(): Promise<void> {
  console.log("[devenv] Normalizing triggers");

    for (const triggerName of SELECTED_TRIGGER_NAMES) {
        const triggerId = await getTriggerId(triggerName);

        if (triggerId) {
            console.log(`Updating trigger [${triggerName}] with pattern: ${BRANCH_PATTERN}`);
            await updateTrigger(triggerId, BRANCH_PATTERN, ["icash", "backend", "development"]);
        } else {
            console.log(`Trigger not found: ${triggerName}`);
        }
    }

    console.log("[devenv] Done normalizing");
}

async function triggerList(): Promise<void> {
    const [triggers] = await client.listBuildTriggers({ projectId: PROJECT_ID });

    const data = [
        ['STATUS', 'NAME', 'REPO TYPE', 'LABELS', 'BRANCH/TAG', 'PATTERN']
    ];

    triggers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    triggers.forEach(trigger => {
        if (!SELECTED_TRIGGER_NAMES.includes(trigger.name || ''))
            return;

        const status = trigger.disabled ? 'Disabled' : 'Enabled';
        const name = trigger.name || '---';
        const repoType = trigger.github ? "GitHub"
            : (trigger.sourceToBuild && trigger.sourceToBuild.uri && trigger.sourceToBuild.uri.includes('bitbucket')) ? "Bitbucket"
            : (trigger.triggerTemplate && trigger.triggerTemplate.repoName) ? "CloudSource"
            : "Unknown";
        const labels = trigger.tags?.join(', ') || '---';
        const branchOrTag = (trigger.triggerTemplate) ? (
            (trigger.triggerTemplate.branchName) ? "Branch-based" :
            (trigger.triggerTemplate.tagName) ? "Tag-based" : "other"
        ) : (trigger.github && trigger.github.push) ? (
            (trigger.github.push.branch) ? "GitHub branch-based" :
            (trigger.github.push.tag) ? "GitHub tag-based" : "GitHub other"
        ) : "???";
        const pattern = trigger.triggerTemplate?.branchName || trigger.triggerTemplate?.tagName || '---';

        data.push([status, name, repoType, labels, branchOrTag, pattern]);
    });

    const output = table(data);
    console.log(output);
}

export { triggerNormalize, triggerList };
