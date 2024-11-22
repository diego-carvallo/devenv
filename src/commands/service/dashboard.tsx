import * as gcloudpipeline from '../../lib/gcp-cloudpipeline.js';
import * as cloudrun from '../../lib/gcp-cloudrun-googleapis.js';
import * as tui from '../../dashboard/tui.js';
import * as handlers from '../../dashboard/handlers.js';
import * as fs from 'fs';


let config: gcloudpipeline.Options = { project: "XXYY", pollInterval: 1000 };

let services: cloudrun.Service[];

function loadServices(_services: cloudrun.Service[]) {
    services = _services;
    if (!config.serviceName) {
        // Could happen on startup
        config.serviceName = services[0]?.serviceName ?? '';
    }
    const thisService = services.find((s) => s.serviceName === config.serviceName) || { serviceName: '???' };
    tui.flush(thisService.serviceName, services);
}

function onServiceChange(blessedEl: { content: string }) {
    const serviceName = blessedEl.content;
    config.serviceName = serviceName;
    tui.flush(serviceName, services);
}

async function poll(): Promise<void> {
    try {
        const [messages, serviceThroughput, totalThroughput, alerts] = await Promise.all([
            gcloudpipeline.pollLastMessagesOfService(config),
            gcloudpipeline.pollServiceThroughput(config),
            gcloudpipeline.pollTotalThroughput(config),
            gcloudpipeline.pollServiceAlerts(config),
        ]);
        handlers.updateMessagesList(messages);
        handlers.updateServiceThroughput(serviceThroughput);
        handlers.updateTotalThroughputLine(totalThroughput);
        handlers.updateAlerts(alerts);
        tui.render();
    } catch (e: any) {
        fs.appendFileSync('error.log', `${JSON.stringify(e)}\n`);
        console.error(e);
    } finally {
        setTimeout(poll, config.pollInterval);
    }
}

async function renderDashboard() {
    try {
        tui.create({ onServiceChange });
        const services = await cloudrun.enumerateServices(false);
        loadServices(services);
        handlers.updateServicesList(services);
        await poll();
    } catch (e: any) {
        fs.appendFileSync('error.log', `${JSON.stringify(e)}\n`);
        console.error(e);
        if ((tui as any).screen) (tui as any).screen.destroy();
        process.exit(1);
    }
};

// CLI params definition
export const alias = 'd';

export default function devenv_service_dashboard() {
    renderDashboard();
    return '';
}
