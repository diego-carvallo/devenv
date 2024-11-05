import { google } from 'googleapis';
import { config } from './config.js';

export type Service = {
    serviceName: string;
    serviceCategory: string;
    url: string;
    status: boolean;
    branchName: string;
    commitSha: string;
    lastDeployed: string;
    lastRevision: string;
    onlineRevisions?: string[];
}

export async function enumerateServices(filtered: boolean = false) {
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const cloudRun = google.run({ version: 'v1', auth: auth });

    const res = await cloudRun.namespaces.services.list({ parent: `namespaces/${config.PROJECT_ID}` });

    const services = res.data.items || [];
    let serviceArray: Service[] = [];

    services.sort((a: any, b: any) => (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? ''));

    for (const service of services) {
        if (filtered && config.FILTERED_SERVICES.length > 0 && !config.FILTERED_TRIGGERS.find((n: string) => n === service.metadata?.name)) {
            continue;
        }
        const serviceName = service.metadata?.name ?? '';
        const serviceCategory = config.BACKEND_SERVICES.includes(serviceName) ? 'BACKEND SERVICES' :
                                config.BACKOFFICE_SERVICES.includes(serviceName) ? 'BACKOFFICE SERVICES' :
                                config.BRIDGE_SERVICES.includes(serviceName) ? 'BRIDGE SERVICES' :
                                config.MONITORING_SERVICES.includes(serviceName) ? 'MONITORING SERVICES' :
                                config.DATASCIENCE_SERVICES.includes(serviceName) ? 'DATASCIENCE SERVICES' :
                                'OTHER';
        const url = service.status?.url ?? '';
        const status = (service.status?.conditions?.find((condition: any) => condition.type === 'Ready')?.status === 'True');
        const lastRevisionName = service.status?.latestReadyRevisionName;
        const lastRevision = lastRevisionName ? lastRevisionName.substring(serviceName.length + 1, lastRevisionName.length) : '---';

        const lastDeployTimestamp = service.status?.conditions?.find((condition: any) => condition.type === 'Ready')?.lastTransitionTime;
        const lastDeployed = lastDeployTimestamp ? new Intl.DateTimeFormat('en-CA', config.DATE_FORMAT).format(new Date(lastDeployTimestamp)).replace(',', '') : '---';
        const [branchName, _, commitSha] = service.metadata?.labels?.['deploy_stamp']?.split('-') || '';

        const onlineRevisions = service.status?.traffic?.map(revision => {
            const revisionId = revision.revisionName ? revision.revisionName.substring(serviceName.length + 1, revision.revisionName.length) : '---';
            if (revisionId === lastRevision)
                return '';
            return `${revisionId} (${revision.percent ?? 0}%)`
        });

        serviceArray.push({
            serviceName,
            serviceCategory,
            status,
            url: url,
            branchName: branchName ?? '',
            commitSha: commitSha ?? '',
            lastDeployed: lastDeployed,
            lastRevision,
            onlineRevisions,
        });
    }

    return serviceArray;
}
