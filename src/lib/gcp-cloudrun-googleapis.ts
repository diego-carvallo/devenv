import { google } from 'googleapis';
import { config } from './config.js';
import * as common from './common.js';

export type Service = {
    serviceName: string;
    serviceCategory: string;
    url: string;
    status: boolean;
    branchName: string;
    commitSha: string;
    lastDeployed: string;
    lastRevision: string;
    activeRevisions?: string[][];
}

export async function enumerateServices(includeAll: boolean = false) {
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const cloudRun = google.run({ version: 'v1', auth: auth });

    const res = await cloudRun.namespaces.services.list({ parent: `namespaces/${config.PROJECT_ID}` });
    const services = res.data.items || [];
    services.sort((a: any, b: any) => (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? ''));
    
    let serviceArray: Service[] = [];
    for (const service of services) {
        const serviceName = service.metadata?.name ?? '';
        if(!includeAll && common.excludeService(serviceName)) {
            continue;
        }
        const serviceCategory = common.getServiceCategory(serviceName);
        const url = service.status?.url ?? '';
        const status = (service.status?.conditions?.find((condition: any) => condition.type === 'Ready')?.status === 'True');
        const lastRevisionName = service.status?.latestReadyRevisionName;
        const lastRevision = lastRevisionName ? lastRevisionName.substring(serviceName.length + 1, lastRevisionName.length) : '---';
        const lastDeployTimestamp = service.status?.conditions?.find((condition: any) => condition.type === 'Ready')?.lastTransitionTime;
        const lastDeployed = common.getDateTime(lastDeployTimestamp);
        const [branchName, _, commitSha] = service.metadata?.labels?.['deploy_stamp']?.split('-') || '';

        let activeRevisions = [];
        for (const revision of service.status?.traffic || []) {
            const revisionId = revision.revisionName ? revision.revisionName.substring(serviceName.length + 1, revision.revisionName.length) : '---';
            if (revisionId === lastRevision) {
                continue;
            }
            activeRevisions.push([revisionId, (`${revision.percent ?? 0}%`)]);
        }

        serviceArray.push({
            serviceName,
            serviceCategory,
            status,
            url: url,
            branchName: branchName ?? '',
            commitSha: commitSha ?? '',
            lastDeployed: lastDeployed,
            lastRevision,
            activeRevisions
        });
    }

    // sort by serviceCategory and serviceName
    serviceArray.sort((a, b) => {
        if (a.serviceCategory === b.serviceCategory) {
            return a.serviceName.localeCompare(b.serviceName);
        }
        return a.serviceCategory.localeCompare(b.serviceCategory);
    });

    return serviceArray;
}