import React from 'react';
import { table } from 'table';
import {Newline, Text} from 'ink';
import chalk from 'chalk';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';


async function getUpdatedTriggerList(): Promise<string[][]> {
    const whitelistedOnly = true;
    // const triggers = await cloudbuild.triggerMigration001(whitelistedOnly, newPushType);
    const triggers = await cloudbuild.triggerMigration002(whitelistedOnly);
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

export const alias = 'n';

export default function devenv_trigger_normalize() {

    getUpdatedTriggerList().then((list) => {
        console.log(table(list));
    });

    return <Text>Normalized triggers <Newline /></Text>;
}
