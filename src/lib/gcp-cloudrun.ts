import { google, run_v1 } from 'googleapis';
import { config } from './config.js';
import * as utils from './gcp-utils.js';
type GoogleService = run_v1.Schema$Service;

export type ParsedService = {
    serviceName: string;
    serviceCategory: string;
    url: string;
    status: boolean;
    present: "both" | "devOnly" | "prodOnly";
    branchName: string;
    commitSha: string;
    lastDeployed: string;
    lastRevision: string;
    activeRevisions?: string[][];
    rowSpan?: number;
}


let PROD_SERVICE_LIST: GoogleService[] = [];


async function _fetchAllServicesFor(projectId: string): Promise<GoogleService[]> {
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const cloudRun = google.run({ version: 'v1', auth: auth });

    const res = await cloudRun.namespaces.services.list({ parent: `namespaces/${projectId}` });
    const services = res.data.items || [];
    return services;
}

function _setRowSpans(serviceArray: ParsedService[]) {
    let currentCategory = '';
    let currentCategoryCount = 0;
    let startIndex = 0;

    for (let i = 0; i < serviceArray.length; i++) {
        if (serviceArray[i]?.serviceCategory !== currentCategory) {
        // If not the first category, set the rowSpan for the previous category
        if (currentCategoryCount > 0 && serviceArray[startIndex]) {
            let previousRow = serviceArray[startIndex];
            if(previousRow) {
                previousRow.rowSpan = currentCategoryCount;
            }
        }
        // Update current category and reset counters
        currentCategory = serviceArray[i]?.serviceCategory || '';
        startIndex = i;
        currentCategoryCount = 1;
        } else {
        currentCategoryCount++;
        }
    }

    // Set rowSpan for the last category
    if (currentCategoryCount > 0) {
        let previousRow = serviceArray[startIndex];
        if(previousRow) {
            previousRow.rowSpan = currentCategoryCount;
        }
    }
}

function _sort(serviceArray: ParsedService[]) {
    // sort by serviceCategory and serviceName
    serviceArray.sort((a, b) => {
        if (a.serviceCategory === b.serviceCategory) {
            return a.serviceName.localeCompare(b.serviceName);
        }
        return a.serviceCategory.localeCompare(b.serviceCategory);
    });
}

async function _prodServiceList(): Promise<GoogleService[]> {
    if (PROD_SERVICE_LIST.length == 0) {
        PROD_SERVICE_LIST = await _fetchAllServicesFor(config.PRODUCTION_PROJECT_ID)
    }
    return PROD_SERVICE_LIST;
}

export async function enumerateServices(includeAll: boolean = false): Promise<ParsedService[]> {
    const services = await _fetchAllServicesFor(config.DEVELOPMENT_PROJECT_ID);
    const prodServiceList = await _prodServiceList();

    let devServiceList: ParsedService[] = [];
    for (const service of services) {
        const serviceName = service.metadata?.name ?? '';
        if(!includeAll && utils.excludeService(serviceName)) {
            continue;
        }
        const serviceCategory = utils.getServiceCategory(serviceName);
        const url = service.status?.url ?? '';
        const status = (service.status?.conditions?.find((condition: any) => condition.type === 'Ready')?.status === 'True');
        const lastRevisionName = service.status?.latestReadyRevisionName;
        const lastRevision = lastRevisionName ? lastRevisionName.substring(serviceName.length + 1, lastRevisionName.length) : '---------';
        const lastDeployTimestamp = service.status?.conditions?.find((condition: any) => condition.type === 'Ready')?.lastTransitionTime;
        const lastDeployed = utils.getDateTime(lastDeployTimestamp);
        const [branchName, _, commitSha] = service.metadata?.labels?.['deploy_stamp']?.split('-') || '';

        let activeRevisions = [];
        for (const revision of service.status?.traffic || []) {
            const revisionId = revision.revisionName ? revision.revisionName.substring(serviceName.length + 1, revision.revisionName.length) : '---------';
            if (revisionId === lastRevision) {
                continue;
            }
            activeRevisions.push([revisionId, (`${revision.percent ?? 0}%`)]);
        }

        devServiceList.push({
            serviceName,
            serviceCategory,
            status,
            present: prodServiceList.find((s) => s.metadata?.name === serviceName) ? "both" : "devOnly",
            url: url,
            branchName: branchName ?? '',
            commitSha: commitSha ?? '',
            lastDeployed: lastDeployed,
            lastRevision,
            activeRevisions
        });
    }

    // find missing services available in prodOnly
    for (const prodService of prodServiceList) {
        const comparableServiceName = prodService.metadata?.name ?? '';
        const comparableServiceCategory = utils.getServiceCategory(comparableServiceName);
        if(!includeAll && utils.excludeService(comparableServiceName)) {
            continue;
        }
        if (!devServiceList.find((s) => s.serviceName === comparableServiceName)) {
            devServiceList.push({
                serviceName: comparableServiceName,
                serviceCategory: comparableServiceCategory,
                status: false,
                present: "prodOnly",
                url: "",
                branchName: "",
                commitSha: "",
                lastDeployed: "---",
                lastRevision: "---------",
                activeRevisions: []
            });
        }
    }

    _sort(devServiceList);
    _setRowSpans(devServiceList);
    return devServiceList;
}
