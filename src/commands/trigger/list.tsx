import React from 'react';
import { table } from 'table';
import {Newline, Text} from 'ink';
import chalk from 'chalk';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';

export const alias = 'l';

async function getTriggerList(filtered: boolean = false): Promise<string[][]> {
    const triggers = await cloudbuild.enumerateTriggers(filtered);
    const header = ['REPO', 'REPO HOST', 'TRIGGER NAME', 'ENABLED', 'LABELS', 'PUSH TYPE', 'PATTERN'].map(text => chalk.cyan(text));
    const data = [ header ];
    triggers.forEach(t => {
        data.push([
            t.repoName,
            t.repoType + (t.repoHost?` ${t.repoHost}`:``),
            t.name.replace("DEPRECATED", chalk.yellow("DEPRECATED")),
            t.disabled ? chalk.red('Disabled') : chalk.green('   ✔'),
            t.labels,
            t.pushType,
            t.pattern
        ]);
    });
    return data;
}

export default function list() {
    const filtered = false;
    getTriggerList(filtered).then((list) => {
        console.log(table(list));
    });

    return <Text>Listed tirggers<Newline /></Text>;
}
