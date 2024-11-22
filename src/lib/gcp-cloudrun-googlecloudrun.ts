import { ServicesClient } from '@google-cloud/run';
import { config } from './config.js';

export type Service = {
    serviceName: string;
    status: boolean;
    url: string;
    branchName: string;
    commitSha: string;
    lastDeployed: string;
    lastRevision: string;
}

export async function enumerateServices(whitelistedOnly: boolean = false) {
    const gcloudrun = new ServicesClient();
    const [services] = await gcloudrun.listServices({ parent: `projects/${config.PROJECT_ID}/locations/${config.REGION}` });

    let serviceArray: Service[] = [];

    services.sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''));

    for (const service of services) {
        if (whitelistedOnly && config.WHITELISTED_SERVICES.length > 0 && !config.WHITELISTED_SERVICES.find((n:string) => n === service.name)) {
            return;
        }
        const serviceName = service.name?.split('/services/').pop() || '';
        const status = (service.terminalCondition?.type == 'Ready' && service.terminalCondition?.state == 'CONDITION_SUCCEEDED');
        const url = service.uri ?? '';
        const latestRevisionName = service.latestReadyRevision?.split('/revisions/').pop() || '';

        const lastDeployed = new Date(Number(service.updateTime?.seconds) * 1000).toISOString();
        const [branchName, _, commitSha] = service.labels?.['deploy_stamp']?.split('-') || '';


        serviceArray.push({
            serviceName,
            status,
            url: url,
            branchName: branchName ?? '---',
            commitSha: commitSha ?? '---',
            lastDeployed: lastDeployed,
            lastRevision: latestRevisionName.substring(serviceName.length + 1, latestRevisionName.length)
        });
    }

    return serviceArray;
}
