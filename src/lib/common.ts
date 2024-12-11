import { config } from './config.js';

export function getRepoAlias(repoName: string|undefined) {
    if (repoName && repoName in config.ALIASES) {
        return config.ALIASES[repoName];
    }
    return repoName;
}

export function getServiceCategory(serviceName: string|undefined) {
    for (const category in config.SERVICES) {
        if (serviceName && config.SERVICES[category].includes(serviceName)) {
            return `${category} SERVICES`;
        }
    }
    return 'UNCATEGORIZED SERVICES';
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
