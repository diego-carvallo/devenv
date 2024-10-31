import React from 'react';
import { table } from 'table';
import { Newline, Text } from 'ink';
import readline from 'readline';
import chalk from 'chalk';
import zod from 'zod';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';

export const alias = 'l';

export const options = zod.object({
	w: zod.boolean().describe('Watch for changes'),
});
type Props = { options: zod.infer<typeof options>; };

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

export default function devenv_trigger_list({options}: Props) {
    const filtered = false;

    const renderTable = async () => {
        const list = await getTriggerList(filtered);
        if (options.w) {
            readline.cursorTo(process.stdout, 0, 0);
            readline.clearScreenDown(process.stdout);
        }
        console.log(table(list));
    };

    renderTable();
    if (options.w) {
        setInterval(renderTable, 5000);
    }

    return <Text>Listed tirggers<Newline /></Text>;
}
