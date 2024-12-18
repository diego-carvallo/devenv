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

function urlEncode(text: string, url: string): string {
    const link = url ? `\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007` : chalk.gray(text);
    return link;
}

async function getServiceList(includeAll: boolean = false): Promise<[any[][], string[]]> {
    const services = await cloudrun.enumerateServices('againsProd', includeAll);
    const triggers = await cloudbuild.enumerateTriggers(includeAll);
    const data: any[][] = [];

    services?.forEach((s, _) => {
        let row: any[] = [];
        const trigger = triggers.find((t) => t.serviceName === s.serviceName);
        const triggerPattern = trigger?.pattern || '---';
        let triggerUrl = utils.getTriggerUrl(s.serviceName)
        let buildsUrl = trigger?.name ? utils.getBuildsUrl(trigger?.name): '';
        let deploymentsUrl = utils.getRevisionsUrl(s.serviceName);
        let liveUrl = s.url;
        let logsUrl = utils.getServiceLogsUrl(s.serviceName);

        // category
        if(s.rowSpan) {
            row.push({ content: chalk.bold(chalk.cyan(s.serviceCategory)), rowSpan: s.rowSpan });
        }
        // name
        let name = s.present === "both" ? s.serviceName : s.present === "devOnly" ? chalk.yellow(s.serviceName)  : chalk.red(s.serviceName);
        row.push(name);

        // ci/cd
        let _triggerLink = (text: string="trigger") => urlEncode(triggerPattern !== config.TRIGGER_PATTERN_PUSH_TO_BRANCH ? chalk.red(text) : text, triggerUrl);
        let _buildLink  = (text: string = 'build')  => urlEncode(s.status ? text : chalk.red(text), buildsUrl);
        let _deployLink = (text: string = 'deploy') => urlEncode(s.status ? text : chalk.red(text), deploymentsUrl);
        let _liveLink   = (text: string = 'live')   => liveUrl ? urlEncode(text, liveUrl) : `${chalk.red(`${text}`)}`;
        let _logsLink   = (text: string = 'logs')   => urlEncode(liveUrl ? text : chalk.red(text), logsUrl);
        let ciBoxing = function (trigger: string, build: string, deploy: string, live: string, logs: string, largeView: boolean): string {
            if (s.present === "devMissing") {
                return '';
            }
            if (largeView) {
                return trigger + chalk.gray(`──`) + build + chalk.gray(`──`) + deploy + chalk.gray(`──`) + live + chalk.gray(`──`) + logs;
            } else {
                let top = chalk.gray(`╭───────╮  ╭─────╮  ╭──────╮  ╭────╮  ╭────╮`);
                let mid = chalk.gray(`│`) + trigger + chalk.gray(`┝━━┥`) + build + chalk.gray(`┝━━┥`) + deploy + chalk.gray(`┝━━┥`) + live + chalk.gray(`┝━━┥`) + logs + chalk.gray(`│`);
                let bot = chalk.gray(`╰───────╯  ╰─────╯  ╰──────╯  ╰────╯  ╰────╯`);
                return `${top}\n${mid}\n${bot}`;
            }
        }
        row.push(ciBoxing(_triggerLink(), _buildLink(), _deployLink(), _liveLink(), _logsLink(), includeAll));


        if(includeAll) {
            // commit
            row.push(s.present === "devMissing" ? '' : `${s.commitSha} - ${s.branchName}`);
            // trigger
            row.push(s.present === "devMissing" ? '' : triggerPattern !== config.TRIGGER_PATTERN_PUSH_TO_BRANCH ? chalk.red(triggerPattern) : triggerPattern);
            // last build
            row.push(s.present === "devMissing" ? '' : s.lastDeployed);
        }
        // deployment
        let deployment = s.status ? chalk.green(`${s.lastRevision}  ✔`) : `${chalk.red(`${s.lastRevision}  ✖`)}`;
        deployment += `${chalk.dim(s.activeRevisions?.map(r => `\n${r[0]}  ${r[1]}`).join('') ?? '')}`;
        row.push(deployment);

        data.push(row);
    });

    // header
    let header = [
        chalk.bold(chalk.cyan('CATEGORY')),
        `${chalk.bold(chalk.cyan('NAME'))}\n${chalk.italic(chalk.yellow('--> dev only'))}\n${chalk.italic(chalk.red('--> prd only'))}`,
        `${chalk.bold(chalk.cyan('CI/CD'))}\n\n${chalk.italic(chalk.white('links to GoogleCloud'))}`
    ]
    if(includeAll) {
        header.push(chalk.bold(chalk.cyan('COMMIT')));
        header.push(chalk.bold(chalk.cyan('TRIGGER')));
        header.push(chalk.bold(chalk.cyan('LAST BUILD')));
    }
    header.push(chalk.bold(chalk.cyan('LAST DEPLOYMENT')));

    return [data, header];
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
        const [list, header] = await getServiceList(options.all);
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
