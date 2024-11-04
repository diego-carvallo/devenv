import React from 'react';
import { table } from 'table';
import { Newline, Text } from 'ink';
import readline from 'readline';
import chalk from 'chalk';
import zod from 'zod';
import * as cloudrun from '../../lib/gcp-cloudrun.js';

export const alias = 'l';

export const options = zod.object({
	w: zod.boolean().describe('Watch for changes'),
});
type Props = { options: zod.infer<typeof options>; };

async function getServiceList(filtered: boolean = false): Promise<string[][]> {
    const services = await cloudrun.enumerateServices(filtered);
    const header = ['NAME', 'STATUS',
        //  'URL', 
         'BRANCH_NAME', 'COMMIT', 'LAST_DEPLOYED', 'LAST_REVISION'];
    const data = [ header ];
    services?.forEach(s => {
        data.push([
            s.serviceName,
            s.status ? chalk.green('   ✔') : chalk.red('   X'),
            // s.url,
            s.branchName,
            s.commitSha,
            s.lastDeployed,
            s.status ? chalk.green(s.lastRevision) : chalk.red(s.lastRevision),
        ]);
    });
    return data;
}

export default function devenv_service_list({options}: Props) {
    const filtered = false;

    const renderTable = async () => {
        const list = await getServiceList(filtered);
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

    return <Text>Cloud Run service list<Newline /></Text>;
}
