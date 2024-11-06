import React from 'react';
import { Newline, Text } from 'ink';
import { config } from '../../lib/config.js';
import open from 'open';

import * as cloudrun from '../../lib/gcp-cloudrun-v1.js';

const period = "PT3H";
const logLinkPrefix = 
`https://console.cloud.google.com/logs/query;query=resource.type = "cloud_run_revision"
resource.labels.location = "${config.REGION}"
severity>=DEFAULT`;
const logLinkSuffix = 
`;storageScope=project;summaryFields=${encodeURIComponent("resource/labels/revision_name")},${encodeURIComponent("labels/deploy_stamp")},${encodeURIComponent("jsonPayload/sourceLocation/file")}:false:32:beginning;lfeCustomFields="${encodeURIComponent("labels/deploy_stamp")};cursorTimestamp=${new Date().toISOString()};duration=${period}?project=${config.PROJECT_ID}&pli=1&invt=Abea-Q`;
const logLinkJoinOperator = `
OR `;

async function getServiceLogsLink(filtered: boolean = false): Promise<string> {
    const services = await cloudrun.enumerateServices(filtered);
    let revisionsArray: string[] = [];
    services?.forEach((s) => {

        if(config.BACKEND_SERVICES.includes(s.serviceName) ||
           config.BACKOFFICE_SERVICES.includes(s.serviceName) ||
           config.BRIDGE_SERVICES.includes(s.serviceName)) {
            if(s.onlineRevisions && s.onlineRevisions.length > 0) {
                for(const revision of s.onlineRevisions) {
                    revisionsArray.push(`resource.labels.revision_name = "${s.serviceName}-${revision?.at(0)}"   --${revision?.at(1)}`);
                }
            } else {
                revisionsArray.push(`resource.labels.revision_name = "${s.serviceName}-${s.lastRevision}"`);
            }
        }
    });

    let revisionsQuery = revisionsArray.join(logLinkJoinOperator);
    const result = 
    `${logLinkPrefix}
   ${revisionsQuery}
    ${logLinkSuffix}`; 
    return encodeURI(result);
}

export default function devenv_service_list() {
    const filtered = false;
    getServiceLogsLink(filtered).then((link) => {
        console.log(link);
        open(link);
    });

    return <Text><Newline />CloudRun latest revision logs<Newline /></Text>;
}
