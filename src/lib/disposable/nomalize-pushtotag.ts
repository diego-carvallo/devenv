import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';

import * as cloudrun from '../gcp-cloudrun.js';
import {Trigger, TriggerUpdated, PushType, enumerateTriggers, cloneTrigger} from '../gcp-cloudbuild.js';


const gcloudbuild = new CloudBuildClient();

async function _updateTrigger(t: Trigger, whitelistedOnly: boolean, newType: PushType): Promise<TriggerUpdated|undefined> {
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
    if (newType === PushType.PushToBranch) {
        afterPushType = PushType.PushToBranch;
        afterPattern = config.TRIGGER_PATTERN_PUSH_TO_BRANCH;
        trigger.triggerTemplate!.branchName = afterPattern;
        trigger.triggerTemplate!.tagName = undefined;
        trigger.name = `${trigger.name}-push-to-branch`;
    } else if (newType === PushType.PushToTag) {
        afterPushType = PushType.PushToTag;
        afterPattern = config.PUSH_TO_TAG_PATTERN;
        trigger.triggerTemplate!.branchName = undefined;
        trigger.triggerTemplate!.tagName = afterPattern;
        trigger.name = `${trigger.name}-push-to-tag`;
    } else {
        return;
    }
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


/**
 * Have 2 triggers per service:
 *     - push-to-branch for pushes to develop branch to keep the devenv updated
 *     - pusht-to-tag: when devs want to deploy a change the would create and push a git tag
 */
export async function normalizePushToTag(whitelistedOnly: boolean): Promise<TriggerUpdated[]> {
    const services = await cloudrun.enumerateServices(true);
    const triggers = await enumerateTriggers(true);
    let triggersUpdated: TriggerUpdated[] = [];

    for (const s of services) {
        if(whitelistedOnly && !config.WHITELISTED_SERVICES.find((n:string) => n === s.serviceName)) {
            continue;
        }
        const pushToTagTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === PushType.PushToTag);
        const pushToTagBranchTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === PushType.PushToBranch);
        if (!pushToTagTrigger && !pushToTagBranchTrigger) {
            continue;
        }
        if (pushToTagTrigger) {
            let updatedTrigger = await _updateTrigger(pushToTagTrigger, whitelistedOnly, PushType.PushToTag);
            if (updatedTrigger) {
                triggersUpdated.push(updatedTrigger);
            }
        }
        if (pushToTagBranchTrigger) {
            let updatedTrigger = await _updateTrigger(pushToTagBranchTrigger, whitelistedOnly, PushType.PushToBranch);
            if (updatedTrigger) {
                triggersUpdated.push(updatedTrigger);
            }
        }

        if (pushToTagTrigger && !pushToTagBranchTrigger) {
            let createdTrigger = await cloneTrigger(pushToTagTrigger, whitelistedOnly, PushType.PushToBranch);
            if (createdTrigger) {
                triggersUpdated.push(createdTrigger);
            }
        }
        if (!pushToTagTrigger && pushToTagBranchTrigger) {
            let createdTrigger = await cloneTrigger(pushToTagBranchTrigger, whitelistedOnly, PushType.PushToTag);
            if (createdTrigger) {
                triggersUpdated.push(createdTrigger);
            }
        }
    }
    return triggersUpdated;
}