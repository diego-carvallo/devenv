import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
// import * as cloudrun from '../gcp-cloudrun.js';
import {ParsedTrigger, ParsedTriggerNormalized, enumerateTriggers} from '../gcp-cloudbuild.js';


const gcloudbuild = new CloudBuildClient();



export async function _updateTrigger(parsedTrigger: ParsedTrigger, whitelistedOnly: boolean): Promise<ParsedTriggerNormalized|undefined> {
    if(whitelistedOnly && !config.WHITELISTED_SERVICES.find((n:string) => n === parsedTrigger.serviceName)) {
        return;
    }
    if (!parsedTrigger.id) {
        console.log('no id for trigger: ' + parsedTrigger.name);
        return;
    }
    // exclude exceptional triggers
    if (parsedTrigger.name === 'dev-env-trigger') {
        console.log('skipping trigger: ' + parsedTrigger.name);
        return;
    }

    // get raw trigger
    const [rawTrigger] = await gcloudbuild.getBuildTrigger({ projectId: config.DEVELOPMENT_PROJECT_ID, triggerId: parsedTrigger.id });
    if (!rawTrigger) {
        console.log('not found trigger: ' + parsedTrigger.name);
        return;
    }

    // set new values
    rawTrigger.name = rawTrigger.name?.replace('-build-and-deploy', '');
    rawTrigger.name = rawTrigger.name?.replace('-build', '');
    rawTrigger.name = rawTrigger.name?.replace('-redeploy', '');
    rawTrigger.name = rawTrigger.name?.replace('-devenv-ci', '');
    // trigger names are expected to start with the service name, after above cleanup this should match
    if (rawTrigger.name != parsedTrigger.serviceName) {
        console.log('skipping trigger: ' + rawTrigger.name);
        return;
    }

    rawTrigger.description = `Build and deploy '${parsedTrigger.serviceName}' by merge to 'develop' branch or by [devenv ci] commit command`;
    let afterPushType: string = parsedTrigger.pushType;
    let afterPattern: string = config.TRIGGER_PATTERN_PUSH_TO_BRANCH;
    rawTrigger.triggerTemplate!.branchName = afterPattern;
    rawTrigger.triggerTemplate!.tagName = undefined;
    rawTrigger.name = `${rawTrigger.name}-devenv-ci`;
    // rawTrigger.tags = Array.from(new Set([...(rawTrigger.tags || []), ...config.TRIGGER_LABELS]));

    // update trigger
    console.log('updating trigger: ' + rawTrigger.name);
    let [updatedTrigger] = await gcloudbuild.updateBuildTrigger({ projectId: config.DEVELOPMENT_PROJECT_ID, triggerId: parsedTrigger.id, trigger: rawTrigger });

    return {
        ...parsedTrigger,
        name: updatedTrigger?.name || '---',
        beforePushType: parsedTrigger.pushType,
        beforePattern: parsedTrigger.pattern,
        afterPushType,
        afterPattern
    };
}

// Migration003:
export async function normalizeDevenvCI(whitelistedOnly: boolean): Promise<ParsedTriggerNormalized[]> {
    const triggers = await enumerateTriggers(true);

    let triggersUpdated: ParsedTriggerNormalized[] = [];

    for (const t of triggers) {
        let updatedTrigger = await _updateTrigger(t, whitelistedOnly);
        if (updatedTrigger) {
            triggersUpdated.push(updatedTrigger);
        }
    }
    return triggersUpdated;
}

