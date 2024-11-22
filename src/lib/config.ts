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
    const configPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'config.development.jsonc');
    const config = readJsoncFile(configPath);
    if (!config) {
        throw new Error("No config file found");
    }

    for (const envvar of ["PROJECT_ID", "TRIGGER_LABELS", "PUSH_TO_BRANCH_PATTERN", "PUSH_TO_TAG_PATTERN", "WHITELISTED_SERVICES"]) {
        if (!config[envvar]) {
            throw new Error(`No value found for environment variable [${envvar}]`);
        }
    }

    return config;
}

export const config = loadConfig();
