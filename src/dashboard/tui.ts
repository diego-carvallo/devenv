import blessed, { Widgets } from "blessed";
import fs from 'fs';
import contrib from "blessed-contrib";
import * as cloudrun from '../lib/gcp-cloudrun-googleapis.js';

interface Options {
    onServiceChange: (el: Widgets.BlessedElement) => void;
}

interface WidgetsMap {
    [key: string]: Widgets.ListElement;
}

const widgets: Partial<WidgetsMap> = {};

const positions = {
    // [row, col, rowSpan, colSpan]
    serviceList:        [0, 0, 4, 1],
    serviceThroughput:  [0, 1, 2, 2],
    totalThroughput:    [0, 3, 1, 2],
    alerts:             [1, 3, 1, 2],
    messageList:        [2, 1, 2, 4],
};

let screen: Widgets.Screen;

export function create(options: Options): void {
    if (screen) throw new Error('Screen already created!');

    screen = blessed.screen({
        autoPadding: true,
        smartCSR: true,
    });
    const grid = new contrib.grid({ rows: 4, cols: 5, screen });

    // Set up widgets
    widgets["serviceThroughput"] = grid.set(...positions.serviceThroughput, contrib.line, {
        label: "Service Throughput (max last 5 minutes)",
        style: {
            line: "red",
            text: "green",
            baseline: "white"
        },
        showNthLabel: 60
    });

    widgets["totalThroughput"] = grid.set(...positions.totalThroughput, contrib.line, {
        label: "Total Throughput (max last 5 minutes)",
        style: {
            line: "green",
            text: "green",
            baseline: "white"
        },
        showNthLabel: 60
    });

    widgets["alerts"] = grid.set(...positions.alerts, blessed.list, {
        label: "Alerts (30s cached)",
        tags: true,
        items: ["Loading ..."],
        mouse: true,
        scrollable: true
    });

    widgets["messageList"] = grid.set(...positions.messageList, contrib.log, {
        fg: "green",
        selectedFg: "green",
        bufferLength: 50,
        label: "Messages (Throughput: 0/sec)"
    });

    widgets["serviceList"] = grid.set(...positions.serviceList, blessed.list, {
        keys: true,
        fg: 'white',
        selectedFg: 'white',
        selectedBg: 'blue',
        interactive: true,
        label: 'Available Services',
        mouse: true,
        border: { type: "line", fg: "cyan" },
        style: {
            selected: {
                bg: 'green',
                bold: true,
                underline: true,
            }
        }
    });

    widgets["serviceList"]?.on('select', options.onServiceChange);

    screen.render();

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
        fs.appendFileSync('exit.log', `ch: ${JSON.stringify(ch)}\nkey: ${JSON.stringify(key)}\n---\n"`);
        return process.exit(0);
    });
};

export function flush(serviceName: string, services: cloudrun.Service[]): void {
    Object.keys(widgets).forEach((key) => {
        const w = widgets[key]!;
        if (w === widgets['serviceList']) {
            const titles = services.map((s) => s.serviceName);
            w.setItems(titles);
            w.select(titles.indexOf(serviceName));
        } else {
            if ((w as any).setData) (w as any).setData({ x: ['0'], y: [0] });
            if (w.clearItems) w.clearItems();
        }
        if (w === widgets['messageList'] || w === widgets['serviceThroughput'] || w === widgets['alerts']) {
            const label = w.options?.label || '';
            w.setLabel?.(`${label.replace(/ \(Service: .*\)/, '')} (Service: ${serviceName})`);
        }
    });
    render();
};

export function getWidget(name: string): Widgets.ListElement {
    if (widgets[name]) {
        return widgets[name];
    }
    throw new Error(`Invalid widget name: ${name}. Available widgets: ${Object.keys(widgets)}`);
};

export function render(): void {
    screen.render();
};

