import React from 'react';
import { table, TableUserConfig } from 'table';
import { Newline, Text } from 'ink';
import readline from 'readline';
import chalk from 'chalk';
import zod from 'zod';
import { config } from '../../lib/config.js';
// import * as cloudrun from '../../lib/gcp-cloudrun.js';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';

const tableConfig: TableUserConfig = {
    columns: [
        { alignment: 'center', width: 11, wrapWord: true },
    ],
    spanningCells: [ ],
};


async function getTriggerList(includeAll: boolean = false): Promise<string[][]> {
    const triggers = await cloudbuild.enumerateTriggers(includeAll);
    // const services = await cloudrun.enumerateServices(includeAll);
    const header = ['SERVICE CATEGORY', '_SERVICE_NAME', 'REPO HOST', 'TRIGGER NAME', 'PUSH TO', 'PATTERN', 'ENABLED'].map(text => chalk.cyan(text));
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
            chalk.red(t.name.replace(t.serviceName, chalk.cyan(t.serviceName)).replace("-devenv-ci", chalk.green("-devenv-ci"))),
            t.pushType,
            chalk.red(t.pattern.replace(config.TRIGGER_PATTERN_PUSH_TO_BRANCH, chalk.green(config.TRIGGER_PATTERN_PUSH_TO_BRANCH))),
            // t.labels,
            t.disabled ? chalk.red('Disabled') : chalk.green('   ✔'),
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
