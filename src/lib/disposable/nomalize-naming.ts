import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
// import * as cloudrun from '../gcp-cloudrun.js';
import {ParsedTrigger, ParsedTriggerUpdated, enumerateTriggers} from '../gcp-cloudbuild.js';


const gcloudbuild = new CloudBuildClient();



export async function _updateTrigger(t: ParsedTrigger, whitelistedOnly: boolean): Promise<ParsedTriggerUpdated|undefined> {
    if(whitelistedOnly && !config.WHITELISTED_SERVICES.find((n:string) => n === t.serviceName)) {
        return;
    }
    if (!t.id) {
        return;
    }
    const [trigger] = await gcloudbuild.getBuildTrigger({ projectId: config.DEVELOPMENT_PROJECT_ID, triggerId: t.id });
    if (!trigger) {
        return;
    }

    // update trigger
    let afterPushType: string = "";
    let afterPattern: string = "";
    trigger.name = trigger.name?.replace('-push-to-tag', '')
    trigger.name = trigger.name?.replace('-push-to-branch', '')
    trigger.name = trigger.name?.replace('-build-and-deploy', '')
    // if (newType === PushType.PushToBranch) {
    //     afterPushType = PushType.PushToBranch;
    //     afterPattern = config.TRIGGER_PATTERN_PUSH_TO_BRANCH;
    //     trigger.triggerTemplate!.branchName = afterPattern;
    //     trigger.triggerTemplate!.tagName = undefined;
    //     trigger.name = `${trigger.name}-push-to-branch`;
    // } else if (newType === PushType.PushToTag) {
    //     afterPushType = PushType.PushToTag;
    //     afterPattern = config.PUSH_TO_TAG_PATTERN;
    //     trigger.triggerTemplate!.branchName = undefined;
    //     trigger.triggerTemplate!.tagName = afterPattern;
    //     trigger.name = `${trigger.name}-push-to-tag`;
    // } else {
    //     return;
    // }
    trigger.tags = Array.from(new Set([...(trigger.tags || []), ...config.TRIGGER_LABELS]));
    let [updatedTrigger] = await gcloudbuild.updateBuildTrigger({ projectId: config.DEVELOPMENT_PROJECT_ID, triggerId: t.id, trigger });
    return {
        ...t,
        name: updatedTrigger?.name || '---',
        beforePushType: t.pushType,
        beforePattern: t.pattern,
        afterPushType,
        afterPattern
    };
}

// Migration003:
export async function normalizeDevenvCI(whitelistedOnly: boolean): Promise<ParsedTriggerUpdated[]> {
    const triggers = await enumerateTriggers(true);

    let triggersUpdated: ParsedTriggerUpdated[] = [];

    for (const t of triggers) {
        if(whitelistedOnly && !config.WHITELISTED_SERVICES.find((n:string) => n === t.serviceName)) {
            continue;
        }

        let updatedTrigger = await _updateTrigger(t, whitelistedOnly);
        if (updatedTrigger) {
            triggersUpdated.push(updatedTrigger);
        }
    }
    return triggersUpdated;
}

