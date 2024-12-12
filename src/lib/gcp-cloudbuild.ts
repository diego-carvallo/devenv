import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from './config.js';
import * as utils from './gcp-utils.js';


const gcloudbuild = new CloudBuildClient();

export enum PushType {
    PushToBranch = 'branch',
    PushToTag = 'tag',
    Other = 'other'
}

export type ParsedTrigger = {
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

export type ParsedTriggerUpdated = ParsedTrigger & {
    beforePushType: string;
    beforePattern: string;
    afterPushType: string;
    afterPattern: string;
}



export async function enumerateTriggers(includeAll: boolean = false): Promise<ParsedTrigger[]> {
    const [triggers] = await gcloudbuild.listBuildTriggers({ projectId: config.DEVELOPMENT_PROJECT_ID });

    let triggerArray: ParsedTrigger[] = [];

    triggers.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    for (const trigger of triggers) {
        const name = trigger.name ?? '---';
        const repoType = trigger.github ? "GitHub"
            : (trigger.sourceToBuild?.uri?.includes('bitbucket')) ? "Bitbucket"
            : (trigger.triggerTemplate?.repoName) ? "mirrored"
            : "unknown";
        const labels = trigger.tags?.join(', ') ?? '---';
        const [repoHost, repoProject, repoName] = utils.splitRepoName(trigger.triggerTemplate?.repoName);
        const serviceName = trigger?.substitutions?.['_SERVICE_NAME'] || utils.getRepoAlias(repoName);
        const serviceCategory = utils.getServiceCategory(serviceName);

        if(!includeAll && utils.excludeService(serviceName)) {
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

