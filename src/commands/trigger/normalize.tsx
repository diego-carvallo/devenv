import React from 'react';
import { table } from 'table';
import {Newline, Text} from 'ink';
import chalk from 'chalk';
import zod from 'zod';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';

export const alias = 'n';

export const options = zod.object({
	tag: zod.boolean().describe('Convert push-to-tag'),
	branch: zod.boolean().describe('Convert to push-to-branch'),
});
type Props = { options: zod.infer<typeof options>; };

async function getUpdatedTriggerList(filtered: boolean = false, newPushType: cloudbuild.PushType): Promise<string[][]> {
    const triggers = await cloudbuild.updateTriggers(filtered, newPushType);
    const header = ['REPO', 'TRIGGER NAME', 'LABELS', 'PUSH TYPE', 'PATTERN'].map(text => chalk.cyan(text));
    const data = [ header ];
    triggers.forEach(t => {
        data.push([
            t.serviceName,
            t.name.replace("DEPRECATED", chalk.yellow("DEPRECATED")),
            t.labels,
            `${chalk.bgRed(t.beforePushType)} -> ${chalk.bgGreen(t.afterPushType)}`,
            `${chalk.bgRed(t.beforePattern)} -> ${chalk.bgGreen(t.afterPattern)}`,
        ]);
    });
    return data;
}

export default function devenv_trigger_normalize({options}: Props) {
    if (options.tag && options.branch) {
        return <Text>You can specify only one of --tag or --branch <Newline /></Text>;
    }
    const filtered = true;
    let newPushType = cloudbuild.PushType.Tag;
    if (options.tag)
        newPushType = cloudbuild.PushType.Tag;
    else if (options.branch)
        newPushType = cloudbuild.PushType.Branch;
    else
        return <Text>You must specify --tag or --branch <Newline /></Text>;

    getUpdatedTriggerList(filtered, newPushType).then((list) => {
        console.log(table(list));
    });

    return <Text>Normalized triggers <Newline /></Text>;
}
