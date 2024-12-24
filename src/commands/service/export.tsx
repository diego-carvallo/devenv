import React from 'react';
import Table from 'cli-table3';
import { Newline, Text } from 'ink';
import chalk from 'chalk';
import zod from 'zod';
import { config } from '../../lib/config.js';
import * as cloudrun from '../../lib/gcp-cloudrun.js';
import { promisify } from 'util';
import { exec } from 'child_process';
import projectRootDirectory from 'project-root-directory';



const execAsync = promisify(exec);
const ROOT_PATH = projectRootDirectory;
const EXPORT_PATH = `${ROOT_PATH}/yaml_exported_services`;


const tableConfig = {
    colWidths: [17, 30, ],
    wordWrap: true,
};

async function _createDir(dirPath: string) {
    const command = `mkdir -p ${dirPath}`;
    try {
        const { stdout, stderr } = await execAsync(command);
        console.log(`creating destination dir ${dirPath} stdout: [${stdout}] stderr: [${stderr}]`);
    } catch (error) {
        console.log(`creating destination dir ${dirPath} error: [${error}]`);
    }
}

async function _exportStagingServiceToYaml(serviceName: string, serviceCategory: string) {
    const command = `gcloud run services describe ${serviceName} --project=${config.STAGING_PROJECT_ID} --region=northamerica-northeast1 --format=export > ${EXPORT_PATH}/${serviceCategory.toLowerCase()}/${serviceName}.yaml`;
    let result: any = 'ok';

    try {
        const { stdout, stderr } = await execAsync(command);
        console.log(`exporting ${serviceName} stdout: [${stdout}] stderr: [${stderr}]`);
        if (stderr) {
            result = stderr;
        }
    } catch (error) {
        result = error;
    }
    return {
        result,
        file: `${serviceName}.yaml`,
    };
}


async function getServiceList(includeAll: boolean = false): Promise<[any[][], string[]]> {
    const services = await cloudrun.enumerateServices('againstStaging', includeAll);
    const data: any[][] = [];
    await _createDir(EXPORT_PATH);

    for (const s of services) {
        let row: any[] = [];

        // category
        if(s.rowSpan) {
            row.push({ content: chalk.bold(chalk.cyan(s.serviceCategory)), rowSpan: s.rowSpan });
            await _createDir(`${EXPORT_PATH}/${s.serviceCategory.toLowerCase()}`);
        }
        // name
        let name = s.present === "both" ? s.serviceName : s.present === "devOnly" ? chalk.yellow(s.serviceName)  : chalk.red(s.serviceName);
        row.push(name);

        // export
        if(s.present !== "devOnly") {
            const exportResult = await _exportStagingServiceToYaml(s.serviceName, s.serviceCategory);
            row.push(exportResult.result === "ok" ? chalk.green(`${exportResult.file}  ✔`) : `${chalk.red(`${exportResult.result}`)}`);
        } else {
            row.push(chalk.red(`devOnly  ✖`));
        }

        data.push(row);
    }

    // header
    let header = [
        chalk.bold(chalk.cyan('CATEGORY')),
        chalk.bold(chalk.cyan('NAME')),
        chalk.bold(chalk.cyan('YAML'))
    ]

    return [data, header];
}


// CLI params definition
export const alias = 'e';
export const options = zod.object({
                                    all: zod.boolean().describe('Include LOAN_AUTOMATION and MONITORING services'),
                                 });
type Props = { options: zod.infer<typeof options>; };

// CLI default function
export default function devenv_service_export({options}: Props) {
    const renderTable = async () => {
        const [list, header] = await getServiceList(options.all);
        // render
        const table = new Table({ head: header, ...tableConfig });
        table.push(...list);
        console.log(table.toString());
    };

    renderTable();

    return <Text>Cloud Run service export to YAML<Newline /></Text>;
}
