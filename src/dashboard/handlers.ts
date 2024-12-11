import moment from 'moment';
import * as tui from './tui.js';
import * as cloudrun from '../lib/gcp-cloudrun.js';

interface Message {
    message: string;
    timestamp: string;
}

interface Alert {
    message: string;
    condition: { type: string; creator_user_id: string };
}

interface ThroughputData {
    x: string;
    y: number;
}

const totalThroughputData: ThroughputData[] = [];
const serviceThroughputData: ThroughputData[] = [];



export function updateMessagesList(messages: Message[]): void {
    const messageList = tui.getWidget('messageList');

    const items = messages
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((message) => `${moment(message.timestamp).format()} - ${message.message}`);

    messageList.setItems(items);
};

export function updateTotalThroughputLine(throughput: number): void {
    const throughputLine = tui.getWidget('totalThroughput');

    // Manage local data array.
    if (totalThroughputData.length >= 300) {
        totalThroughputData.shift();
    }
    totalThroughputData.push({ x: moment().format("HH:mm"), y: throughput });

    (throughputLine as any).setData(transformLineData(totalThroughputData));
};

export function updateServiceThroughput(throughput: number): void {
    if (!throughput) throughput = 0;
    // Update in title of log messages widget.
    const messageList = tui.getWidget('messageList');
    const label = getWidgetLabel(messageList);
    messageList.setLabel(label.replace(/(Throughput: )(\d+)/, "$1" + throughput));

    // Update in chart.
    const throughputLine = tui.getWidget('serviceThroughput');

    // Manage local data array.
    while (serviceThroughputData.length >= 300) {
        serviceThroughputData.shift();
    }
    serviceThroughputData.push({ x: moment().format("HH:mm"), y: throughput });

    (throughputLine as any).setData(transformLineData(serviceThroughputData));
};

export function updateServicesList(services: cloudrun.ParsedService[]): void {
    const serviceList = tui.getWidget('serviceList');
    serviceList.setItems(services.map((s) => s.serviceName));
    serviceList.focus();
};

export function updateAlerts(alertList: Alert[]): void {
    const alerts = tui.getWidget('alerts');
    const lines = [];

    if (alertList.length == 0) {
        lines.push("");
        lines.push("{center}{green-fg}No active alerts for this service!{/green-fg}{/center}");
    } else {
        let msg;
        if (alertList.length == 1) {
            msg = "One active service alert:";
        } else {
            msg = "Multiple (" + alertList.length + ") active service alerts:";
        }

        lines.push(`{center}{red-bg}!! ${msg} !!{/red-bg}{/center}`);
        lines.push("");

        for (const i in alertList) {
            lines.push(buildAlertDescription(Number(i), alertList[i]));
        }
    }

    alerts.setItems(lines);
};


// Blessed-contrib expects an object with x/y array datapoints.
function transformLineData(dataArray: ThroughputData[]): { x: string[]; y: number[] } {
    return dataArray.reduce<{ x: string[]; y: number[] }>((memo, d) => {
        memo.x.push(d.x);
        memo.y.push(d.y);
        return memo;
    }, { x: [], y: [] });
}

function buildAlertDescription(i: number, alert?: Alert): string {
    return `{red-fg}#${i + 1}:{/red-fg} ${alert?.condition.type} alert. ${alert?.message} (by ${alert?.condition.creator_user_id})`;
}

// We can't just get the label from options, it'll be stale.
function getWidgetLabel(widget: any): string {
    return widget.children.find((c: any) => c._isLabel)?.content || '';
}
