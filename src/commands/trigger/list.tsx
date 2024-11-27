import React from 'react';
import { table, TableUserConfig } from 'table';
import { Newline, Text } from 'ink';
import readline from 'readline';
import chalk from 'chalk';
import zod from 'zod';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';

const tableConfig: TableUserConfig = {
    columns: [
        { alignment: 'center', width: 11, wrapWord: true },
    ],
    spanningCells: [ ],
};

async function getTriggerList(includeAll: boolean = false): Promise<string[][]> {
    const triggers = await cloudbuild.enumerateTriggers(includeAll);
    const header = ['SERVICE CATEGORY', 'SERVICE NAME', 'REPO HOST', 'TRIGGER NAME', 'ENABLED', 'LABELS', 'PUSH TYPE', 'PATTERN'].map(text => chalk.cyan(text));
    const data = [ header ];

    let currentCategory = '';
    let startIndex = 0;
    let categorySize = 0;
    triggers.forEach((t, index) => {
        if (index === 0) {
            tableConfig?.spanningCells?.splice(0, tableConfig?.spanningCells?.length);
            currentCategory = t.serviceCategory;
            startIndex = index;
            categorySize += 1;
        } else if (t.serviceCategory === currentCategory) {
            categorySize += 1;
        } else {
            tableConfig?.spanningCells?.push({ col: 0, row: startIndex + 1, rowSpan: categorySize, verticalAlignment: 'middle' });
            currentCategory = t.serviceCategory;
            startIndex = index;
            categorySize = 1;
        }
        data.push([
            chalk.cyan(t.serviceCategory),
            t.serviceName,
            t.repoType + (t.repoHost?` ${t.repoHost}`:``),
            t.name.replace("DEPRECATED", chalk.yellow("DEPRECATED")),
            t.disabled ? chalk.red('Disabled') : chalk.green('   ✔'),
            t.labels,
            t.pushType,
            t.pattern
        ]);
    });
    // Add the last category span
    if (triggers.length > 0) {
        tableConfig?.spanningCells?.push({ col: 0, row: startIndex +1, rowSpan: categorySize, verticalAlignment: 'middle' });
    }

    return data;
}

// CLI params definition
export const alias = 'l';
export const options = zod.object({
                                    w: zod.boolean().describe('Watch for changes'),
                                    all: zod.boolean().describe('Include LOAN_AUTOMATION and MONITORING services'),
                                 });
type Props = { options: zod.infer<typeof options>; };

// CLI default function
export default function devenv_trigger_list({options}: Props) {
    const renderTable = async () => {
        const list = await getTriggerList(options.all);
        if (options.w) {
            readline.cursorTo(process.stdout, 0, 0);
            readline.clearScreenDown(process.stdout);
        }
        console.log(table(list, tableConfig));
    };

    renderTable();
    if (options.w) {
        setInterval(renderTable, 5000);
    }

    return <Text>Listed tirggers<Newline /></Text>;
}
