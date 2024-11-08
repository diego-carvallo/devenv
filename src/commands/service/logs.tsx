import React from 'react';
import { Newline, Text } from 'ink';
import { config } from '../../lib/config.js';
import * as common from '../../lib/common.js';
import zod from 'zod';
import open from 'open';

import * as cloudrun from '../../lib/gcp-cloudrun-v1.js';

const period = "PT3H";
const logLinkPrefix = 
`https://console.cloud.google.com/logs/query;query=resource.type = "cloud_run_revision"
resource.labels.location = "${config.REGION}"
severity>=DEFAULT
`;
const logLinkSuffix = 
`;storageScope=project;summaryFields=${encodeURIComponent("resource/labels/revision_name")},${encodeURIComponent("labels/deploy_stamp")},${encodeURIComponent("jsonPayload/sourceLocation/file")}:false:32:beginning;lfeCustomFields="${encodeURIComponent("labels/deploy_stamp")};cursorTimestamp=${new Date().toISOString()};duration=${period}?project=${config.PROJECT_ID}&pli=1&invt=Abea-Q`;
const logLinkJoinOperator = `OR `;

async function getServiceLogsLink(includeAll: boolean = false): Promise<string> {
    const services = await cloudrun.enumerateServices(includeAll);
    let revisionsArray: string[] = [];
    let currentCategory = '';
    let firstElem = true;
    services?.forEach((s) => {
        let activeRevisionFound = false;
        if(includeAll || !common.excludeService(s.serviceName)) {
            if(!currentCategory || currentCategory != s.serviceCategory) {
                currentCategory = s.serviceCategory;
                revisionsArray.push(`-- ${currentCategory}`);
            }
            if(s.activeRevisions && s.activeRevisions.length > 0) {
                for (const revision of s.activeRevisions) {
                    if(revision.length > 0 && revision?.at(1) != "0%") {
                        revisionsArray.push(`${firstElem ? '   ' : logLinkJoinOperator}resource.labels.revision_name = "${s.serviceName}-${revision?.at(0)}"   --${revision?.at(1)}`);
                        firstElem = false;
                        activeRevisionFound = true;
                    }
                }
            }
            if(!activeRevisionFound) {
                revisionsArray.push(`${firstElem ? '   ' : logLinkJoinOperator}resource.labels.revision_name = "${s.serviceName}-${s.lastRevision}"`);
                firstElem = false;
            }
        }
    });

    let revisionsQuery = revisionsArray.join("\n");
    const result = `${logLinkPrefix}${revisionsQuery}${logLinkSuffix}`; 
    return encodeURI(result);
}


// CLI params definition
export const alias = 'l';
export const options = zod.object({
                                    all: zod.boolean().describe('Include DATASCIENCE and MONITORING services'),
                                 });
type Props = { options: zod.infer<typeof options>; };

// CLI default function
export default function devenv_service_list({options}: Props) {
    getServiceLogsLink(options.all).then((link) => {
        console.log(link);
        open(link);
    });

    return <Text><Newline />CloudRun latest revision logs<Newline /></Text>;
}
