import { config } from './config.js';
import { ParsedService } from './gcp-cloudrun.js';


export function getRepoAlias(repoName: string|undefined) {
    if (repoName && repoName in config.ALIASES) {
        return config.ALIASES[repoName];
    }
    return repoName;
}

export function getServiceCategory(serviceName: string|undefined) {
    for (const category in config.SERVICES) {
        if (serviceName && config.SERVICES[category].includes(serviceName)) {
            return `${category}`;
        }
    }
    return 'UNCATEGORIZED';
}

export function excludeService(serviceName: string) {
    return config.SERVICES.LOAN_AUTOMATION.includes(serviceName) ||
           config.SERVICES.REPORTING.includes(serviceName);
}

export function getDateTime(lastDeployTimestamp: string|undefined|null) {
    return lastDeployTimestamp ? new Intl.DateTimeFormat('en-CA', config.DATE_FORMAT).format(new Date(lastDeployTimestamp)).replace(',', '') : '---';
}

export function splitRepoName(repoLongName: string|undefined|null) {
    let repoHost, repoProject: string|undefined;
    let repository: string[];
    let repoShortName: string = "---";

    [repoHost, repoProject, ...repository] = (repoLongName?.split('_') || []);
    if (!repoProject) {
        [repoProject, ...repository] = repoLongName?.split('/') || [];
        repoHost = "";
    }
    if(repoHost) {
        repoHost = repoHost.replace(/^./, (char: string) => char.toUpperCase());
    }
    repoShortName = `${repoProject}/${repository.join('-')}`;
    if (repoProject === "brainfinance") {
        repoShortName = `${repository.join('-')}`;
    }
    return [repoHost, repoProject, repoShortName]
}

export function getTriggerUrl(serviceName: string): string {
    const baseUrl = `https://console.cloud.google.com/cloud-build/triggers;region=global?project=${config.DEVELOPMENT_PROJECT_ID}`;
    const filter = `&pageState=(%22triggers%22:(%22f%22:%22%255B%257B_22k_22_3A_22_22_2C_22t_22_3A10_2C_22v_22_3A_22_5C_22${serviceName}_5C_22_22%257D%255D%22))`;
    // must encode parenthesis for the table to print correctly
    const encodedUrl = `${baseUrl}${filter}`.replaceAll('(', "%28").replaceAll(')', "%29");
    return encodedUrl;
}

export function getBuildsUrl(triggerName: string): string {
    const baseUrl = `https://console.cloud.google.com/cloud-build/builds?project=${config.DEVELOPMENT_PROJECT_ID}`;
    const filter = `&pageState=(%22builds%22:(%22f%22:%22%255B%257B_22k_22_3A_22Trigger%2520Name_22_2C_22t_22_3A10_2C_22v_22_3A_22_5C_22${triggerName}_5C_22_22_2C_22s_22_3Atrue_2C_22i_22_3A_22triggerName_22%257D%255D%22))`;
    // must encode parenthesis for the table to print correctly
    const encodedUrl = `${baseUrl}${filter}`.replaceAll('(', "%28").replaceAll(')', "%29");
    return encodedUrl;
}

export function getRevisionsUrl(serviceName: string): string {
    const baseUrl = `https://console.cloud.google.com/run/detail/northamerica-northeast1/${serviceName}/revisions?&project=${config.DEVELOPMENT_PROJECT_ID}`;
    return baseUrl;
}

export function getServiceLogsUrl(serviceName: string): string {
    const period = "P1D";
    const baseUrl = `https://console.cloud.google.com/logs/query`;
    const summaryFields = `;summaryFields=resource%252Flabels%252Frevision_name,labels%252Fdeploy_stamp:false:32:beginning`.replaceAll(',', '%2C');
    const filter = `;query=resource.type%20%3D%20%22cloud_run_revision%22%0Aresource.labels.service_name%20%3D%20%22${serviceName}%22%0Aresource.labels.location%20%3D%20%22northamerica-northeast1%22%0A%20severity%3E%3DDEFAULT;storageScope=project;duration=${period}${summaryFields}?project=${config.DEVELOPMENT_PROJECT_ID}`;
    const encodedUrl = `${baseUrl}${filter}`;
    return encodedUrl;
}

export function getServicesLogsUrl(serviceList: ParsedService[], includeAll: boolean = false): string {
    const period = "PT24H";
    const logLinkPrefix =
`https://console.cloud.google.com/logs/query;query=resource.type = "cloud_run_revision"
resource.labels.location = "${config.REGION}"
severity>=DEFAULT
`;
    const logLinkSuffix =
`;storageScope=project;summaryFields=${encodeURIComponent("resource/labels/revision_name")},${encodeURIComponent("labels/deploy_stamp")},${encodeURIComponent("jsonPayload/sourceLocation/file")}:false:32:beginning;lfeCustomFields="${encodeURIComponent("labels/deploy_stamp")};cursorTimestamp=${new Date().toISOString()};duration=${period}?project=${config.DEVELOPMENT_PROJECT_ID}&pli=1&invt=Abea-Q`;
    const logLinkJoinOperator = `OR `;

    let revisionsArray: string[] = [];
    let currentCategory = '';
    let firstElem = true;
    serviceList?.forEach((service) => {
        let activeRevisionFound = false;
        if(includeAll || !excludeService(service.serviceName)) {
            if(!currentCategory || currentCategory != service.serviceCategory) {
                currentCategory = service.serviceCategory;
                revisionsArray.push(`-- ${currentCategory}`);
            }
            if(service.activeRevisions && service.activeRevisions.length > 0) {
                for (const revision of service.activeRevisions) {
                    if(revision.length > 0 && revision?.at(1) != "0%") {
                        revisionsArray.push(`${firstElem ? '   ' : logLinkJoinOperator}resource.labels.revision_name = "${service.serviceName}-${revision?.at(0)}"   --${revision?.at(1)}`);
                        firstElem = false;
                        activeRevisionFound = true;
                    }
                }
            }
            if(!activeRevisionFound) {
                revisionsArray.push(`${firstElem ? '   ' : logLinkJoinOperator}resource.labels.revision_name = "${service.serviceName}-${service.lastRevision}"`);
                firstElem = false;
            }
        }
    });

    let revisionsQuery = revisionsArray.join("\n");
    const result = `${logLinkPrefix}${revisionsQuery}${logLinkSuffix}`;
    const encodedUrl = encodeURI(result);
    return encodedUrl;
}
