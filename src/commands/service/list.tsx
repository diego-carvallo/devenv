import React from 'react';
import { table, TableUserConfig } from 'table';
import { Newline, Text } from 'ink';
import readline from 'readline';
import chalk from 'chalk';
import zod from 'zod';
import terminalLink from 'terminal-link';
import { config } from '../../lib/config.js';
import * as cloudrun from '../../lib/gcp-cloudrun.js';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';

const tableConfig: TableUserConfig = {
    columns: {
        0: { alignment: 'center', width: 11, wrapWord: true },
        3: { alignment: 'center', width: 19, wrapWord: true },
    },
    spanningCells: [ ],
};

async function getServiceList(includeAll: boolean = false): Promise<string[][]> {
    const services = await cloudrun.enumerateServices(includeAll);
    const triggers = await cloudbuild.enumerateTriggers(includeAll);
    const header = ['CATEGORY', 'NAME','TRIGGER PATTERN', 'URL',
         'BRANCH_NAME', 'COMMIT', 'LAST_DEPLOYED', 'LAST_REVISION', 'BACKUP_REVISION'].map(text => chalk.cyan(text));
    const data = [ header ];

    let currentCategory = '';
    let startIndex = 0;
    let categorySize = 0;
    services?.forEach((s, index) => {
        if (index === 0) {
            tableConfig?.spanningCells?.splice(0, tableConfig?.spanningCells?.length);
            currentCategory = s.serviceCategory;
            startIndex = index;
            categorySize += 1;
        } else if (s.serviceCategory === currentCategory) {
            categorySize += 1;
        } else {
            tableConfig?.spanningCells?.push({ col: 0, row: startIndex + 1, rowSpan: categorySize, verticalAlignment: 'middle' });
            currentCategory = s.serviceCategory;
            startIndex = index;
            categorySize = 1;
        }

        // const pushToTagTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === cloudbuild.PushType.PushToTag)?.pattern || '---' ;
        const pushToTagBranchTrigger = triggers.find((t) => t.serviceName === s.serviceName && t.pushType === cloudbuild.PushType.PushToBranch)?.pattern || '---' ;
        console.log(`[${s.url}]` + "\u001B]8;;https://google.com\u0007Google\u001B]8;;\u0007", terminalLink("url", s.url));
        data.push([
            chalk.cyan(s.serviceCategory),
            s.present ? s.serviceName :  chalk.yellow(s.serviceName),
            // pushToTagTrigger !== config.PUSH_TO_TAG_PATTERN ? chalk.red(pushToTagTrigger) : chalk.green(pushToTagTrigger),
            pushToTagBranchTrigger !== config.PUSH_TO_BRANCH_PATTERN ? chalk.red(pushToTagBranchTrigger) : chalk.green(pushToTagBranchTrigger),
            // terminalLink('url', s.url),
            `\u001B]8;;https://google.com\u0007Google\u001B]8;;\u0007`,
            // s.url,
            s.branchName,
            s.commitSha,
            s.lastDeployed,
            s.status ? chalk.green(`${s.lastRevision}  ✔`) : chalk.red(`${s.lastRevision}  X`),
            chalk.green(s.activeRevisions?.join(', ') ?? ''),
        ]);
    });
    // Add the last category span
    if (services.length > 0) {
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
export default function devenv_service_list({options}: Props) {
    const renderTable = async () => {
        const list = await getServiceList(options.all);
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

    return <Text>Cloud Run service list<Newline /></Text>;
}
