import React from 'react';
import { Newline, Text } from 'ink';
import * as utils from '../../lib/gcp-utils.js';
import zod from 'zod';
import open from 'open';

import * as cloudrun from '../../lib/gcp-cloudrun.js';


async function getServiceLogsLink(includeAll: boolean = false): Promise<string> {
    const services = await cloudrun.enumerateServices(includeAll);
    const logsUrl = utils.getServicesLogsUrl(services, includeAll);
    return logsUrl;
}


// CLI params definition
export const alias = 'l';
export const options = zod.object({
                                    all: zod.boolean().describe('Include LOAN_AUTOMATION and MONITORING services'),
                                 });
type Props = { options: zod.infer<typeof options>; };

// CLI default function
export default function devenv_service_logs({options}: Props) {
    getServiceLogsLink(options.all).then((link) => {
        console.log(link);
        open(link);
    });

    return <Text><Newline />CloudRun latest revision logs<Newline /></Text>;
}
