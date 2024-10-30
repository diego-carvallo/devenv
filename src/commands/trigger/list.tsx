import React from 'react';
import { table } from 'table';
import {Newline, Text} from 'ink';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';


async function triggerList(filtered: boolean = false): Promise<string[][]> {
    const triggers = await cloudbuild.triggerArray();
    const header = ['REPO', 'REPO HOST', 'TRIGGER NAME', 'ENABLED', 'LABELS', 'BRANCH/TAG', 'PATTERN'].map(text => `\x1b[97m${text}\x1b[0m`);
    const data = [ header ];
    triggers.forEach(t => {
        if (filtered && !cloudbuild.FILTERED_TRIGGER_NAMES.includes(t.name || '')) {
            return;
        }
        data.push([
            t.repoName,
            t.repoType + (t.repoHost?` ${t.repoHost}`:``),
            t.name.replace("DEPRECATED", "\x1b[31mDEPRECATED\x1b[0m"),
            t.disabled ? '\x1b[31mDisabled\x1b[0m' : '\x1b[32m  ✔ \x1b[0m',
            t.labels,
            t.branchOrTag,
            t.pattern
        ]);
    });
    return data;
}

export default function list() {
    const filtered = false;
    triggerList(filtered).then((list) => {
        console.log(table(list));
    });

    return <Text>Trigger list<Newline /></Text>;
}