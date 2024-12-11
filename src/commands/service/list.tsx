import React from 'react';
import Table from 'cli-table3';
import { Newline, Text } from 'ink';
import readline from 'readline';
import chalk from 'chalk';
import zod from 'zod';
import { config } from '../../lib/config.js';
import * as cloudrun from '../../lib/gcp-cloudrun.js';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';
import * as utils from '../../lib/gcp-utils.js';

const tableConfig = {
    colWidths: [17, 30, ],
    wordWrap: true,
};
const header = ['CATEGORY',
                `${chalk.bold(chalk.cyan('NAME'))}\n${chalk.italic(chalk.yellow('--> dev only'))}\n${chalk.italic(chalk.red('--> prd only'))}`,
                'TRIGGER PATTERN', 'BRANCH NAME', 'COMMIT',
                'LAST DEPLOYED', 'LAST REVISION', 'BACKUP REVISION', "LOGS"].map(text => text.includes('only')? text: chalk.bold(chalk.cyan(text)));


async function getServiceList(includeAll: boolean = false): Promise<any[][]> {
    const services = await cloudrun.enumerateServices(includeAll);
    const triggers = await cloudbuild.enumerateTriggers(includeAll);
    const data: any[][] = [];

    services?.forEach((s, _) => {
        let row: any[] = [];

        // category
        if(s.rowSpan) {
            row.push({ content: chalk.bold(chalk.cyan(s.serviceCategory)), rowSpan: s.rowSpan });
        }
        // name
        let name = s.present === "both" ? s.serviceName : s.present === "devOnly" ? chalk.yellow(s.serviceName)  : chalk.red(s.serviceName);
        row.push({ content: name, href: s.url});
        // trigger
        const trigger = triggers.find((t) => t.serviceName === s.serviceName);
        const triggerPattern = trigger?.pattern || '---';
        let triggerText = triggerPattern !== config.TRIGGER_PATTERN_PUSH_TO_BRANCH ? chalk.red(triggerPattern) : triggerPattern;
        row.push({ content: triggerText, href: utils.getTriggerUrl(s.serviceName) });
        // branch
        row.push(s.branchName);
        // commit
        row.push(s.commitSha);
        // last deployed
        row.push({ content: s.lastDeployed, href: trigger?.name ? utils.getBuildsUrl(trigger?.name): '' });
        // last revision
        let lastRevision = s.status ? chalk.green(`${s.lastRevision}  ✔`) : chalk.red(`${s.lastRevision}  X`);
        row.push({ content: lastRevision, href: utils.getRevisionsUrl(s.serviceName) });
        // backup revision
        row.push(chalk.green(s.activeRevisions?.join(', ') ?? ''));
        // logs
        row.push({ content: 'logs', href: utils.getServiceLogsUrl(s.serviceName) });

        data.push(row);
    });

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
        // render
        const table = new Table({ head: header, ...tableConfig });
        table.push(...list);
        console.log(table.toString());
        // console.log(table(list, tableConfig));
    };

    renderTable();
    if (options.w) {
        setInterval(renderTable, 5000);
    }

    return <Text>Cloud Run service list<Newline /></Text>;
}
