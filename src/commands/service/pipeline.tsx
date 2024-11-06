import React from 'react';
import { table, TableUserConfig } from 'table';
import { Newline, Text } from 'ink';
import readline from 'readline';
import chalk from 'chalk';
import zod from 'zod';
import * as cloudrun from '../../lib/gcp-cloudpipeline.js';

const tableConfig: TableUserConfig = {
    columns: [
        { alignment: 'center', width: 11, wrapWord: true },
    ],
    spanningCells: [ ],
};

async function getServiceData(filtered: boolean = false): Promise<string[][]> {
    const services = await cloudrun.enumerateServices(filtered);
    const header = ['CATEGORY', 'NAME', //'URL', 
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
        data.push([
            chalk.cyan(s.serviceCategory),
            s.serviceName,
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
                                 });
type Props = { options: zod.infer<typeof options>; };

// CLI default function
export default function devenv_service_pipeline({options}: Props) {
    const filtered = false;

    const renderTable = async () => {
        const list = await getServiceData(filtered);
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