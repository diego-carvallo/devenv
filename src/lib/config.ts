import * as fs from 'fs';
import * as jsonc from 'jsonc-parser';
import * as path from 'path';

function readJsoncFile(filePath: string) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return jsonc.parse(fileContent);
    } catch (error) {
        throw new Error(`Error reading or parsing file ${filePath}: ${error}`);
    }
}

function loadConfig(): any {
    const configPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'config.jsonc');
    const config = readJsoncFile(configPath);
    if (!config) {
        throw new Error("No config file found");
    }

    // validate config file has the required minimal configs
    for (const envvar of ["DEVELOPMENT_PROJECT_ID", "TRIGGER_LABELS", "TRIGGER_PATTERN_PUSH_TO_BRANCH", "WHITELISTED_SERVICES"]) {
        if (!config[envvar]) {
            throw new Error(`No value found for environment variable [${envvar}]`);
        }
    }

    return config;
}

export const config = loadConfig();
