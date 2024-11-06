import { config } from './config.js';

export function getServiceCategory(serviceName: string|undefined) {
    const serviceCategory = config.BACKEND_SERVICES.includes(serviceName) ? 'BACKEND SERVICES' :
                            config.BACKOFFICE_SERVICES.includes(serviceName) ? 'BACKOFFICE SERVICES' :
                            config.BRIDGE_SERVICES.includes(serviceName) ? 'BRIDGE SERVICES' :
                            config.MONITORING_SERVICES.includes(serviceName) ? 'MONITORING SERVICES' :
                            config.DATASCIENCE_SERVICES.includes(serviceName) ? 'DATASCIENCE SERVICES' :
                            'OTHER';
    return serviceCategory;
}

export function excludeService(serviceName: string) {
    return !config.BACKEND_SERVICES.includes(serviceName) && !config.BACKOFFICE_SERVICES.includes(serviceName) && !config.BRIDGE_SERVICES.includes(serviceName);
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
    if (repoProject === "brainfinance") {
        repoShortName = `${repository.join('-')}`;
    }
    repoShortName = `${repoProject}/${repository.join('-')}`;
    return [repoHost, repoProject, repoShortName]
}
