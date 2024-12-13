import React from 'react';
import { table } from 'table';
import {Newline, Text} from 'ink';
import chalk from 'chalk';
import { normalizeDevenvCI } from '../../lib/disposable/nomalize-naming.js';
// import { normalizePushToTag} from '../../lib/disposable/nomalize-pushtotag.js';


async function getUpdatedTriggerList(whitelistedOnly: boolean): Promise<string[][]> {
    // const triggers = await normalizePushToTag(whitelistedOnly);
    const triggers = await normalizeDevenvCI(whitelistedOnly);

    const header = ['REPO', 'TRIGGER NAME', 'LABELS', 'PUSH TYPE', 'PATTERN'].map(text => chalk.cyan(text));
    const data = [ header ];
    triggers.forEach(t => {
        data.push([
            t.serviceName,
            chalk.red(t.name.replace(t.serviceName, chalk.cyan(t.serviceName)).replace("-devenv-ci", chalk.green("-devenv-ci"))),
            t.labels,
            `${chalk.bgRed(t.beforePushType)} -> ${chalk.bgGreen(t.afterPushType)}`,
            `${chalk.bgRed(t.beforePattern)} -> ${chalk.bgGreen(t.afterPattern)}`,
        ]);
    });
    return data;
}

export const alias = 'n';

export default function devenv_trigger_normalize() {
    const whitelistedOnly = false;
    getUpdatedTriggerList(whitelistedOnly).then((list) => {
        console.log(table(list));
    });

    return <Text>Normalized triggers <Newline /></Text>;
}
