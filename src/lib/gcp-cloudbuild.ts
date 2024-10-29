import { CloudBuildClient } from '@google-cloud/cloudbuild';

const client = new CloudBuildClient();

const TRIGGER_NAMES = [
  "alicia-build-and-deploy-DEPRECATED",
  "backoffice-frontend-build",
  "backoffice-pubsub-ws-bridge",
  "clamav-malware-scanner",
  "contentful-cache-build-and-deploy",
  "furious-application-api",
  "furious-backoffice-api",
  "furious-communication-api",
  "furious-dms-api",
  "gcp-storage-bridge-build-and-deploy",
  "maria-build-and-deploy",
  "pubsub-api-bridge-build-and-deploy",
  "rudderstack-service-build-and-deploy",
  "seon-service-build-and-deploy",
  "sms-service-build-and-deploy"
];

async function getTriggerId(triggerName: string): Promise<string | null> {
  const [triggers] = await client.listBuildTriggers({ projectId: 'your-project-id' });
  const trigger = triggers.find(t => t.name === triggerName);
  return trigger ? trigger.id : null;
}

async function updateTrigger(triggerId: string, branchPattern: string, tags: string[]): Promise<void> {
  const [trigger] = await client.getBuildTrigger({ projectId: 'your-project-id', triggerId });
  if (trigger) {
    trigger.triggerTemplate!.branchName = branchPattern;
    trigger.tags = Array.from(new Set([...(trigger.tags || []), ...tags]));
    await client.updateBuildTrigger({ projectId: 'your-project-id', triggerId, trigger });
  }
}

async function triggerNormalize(): Promise<void> {
  console.log("[devenv] Normalizing triggers");

  const branchPattern = "develop|^feature|^bugfix";

  for (const triggerName of TRIGGER_NAMES) {
    const triggerId = await getTriggerId(triggerName);

    if (triggerId) {
      console.log(`Updating trigger: ${triggerName} (ID: ${triggerId})`);
      await updateTrigger(triggerId, branchPattern, ["icash", "backend", "development"]);
    } else {
      console.log(`Trigger not found: ${triggerName}`);
    }
  }

  console.log("[devenv] Done normalizing");
}

async function triggerList(): Promise<void> {
  const [triggers] = await client.listBuildTriggers({ projectId: 'your-project-id' });
  triggers.forEach(trigger => {
    console.log(`Name: ${trigger.name}, ID: ${trigger.id}, Tags: ${trigger.tags?.join(', ')}, Branch: ${trigger.triggerTemplate?.branchName}`);
  });
}

export { triggerNormalize, triggerList };
