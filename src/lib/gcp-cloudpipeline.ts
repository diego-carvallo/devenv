import moment from 'moment';


interface Alert {
    message: string;
    condition: { type: string; creator_user_id: string };
}

export interface Settings {
    project: string;
    serviceName?: string;
    error?: string;
    pollInterval: number;
}
interface Message {
    message: string;
    timestamp: string;
}

export function pollServiceAlerts(settings: Settings): Promise<Alert[]> {
    let _randomAlerts = [];

    for (let i = 0; i < 10; i++) {
        _randomAlerts.push({
            message: "alert-" + settings.project + "-" + generateRandomMessage(),
            condition: { type: "error", creator_user_id: "diego" }
        });
    }

    return Promise.resolve(_randomAlerts);
};

export function pollLastMessagesOfService(settings: Settings): Promise<Message[]> {
    let _randomMessages = [];
    if (settings.error) {
        _randomMessages.push({ "message": settings.error, "timestamp": moment().format() });
    }
    for (let i = 0; i < 30; i++) {
        _randomMessages.push({ "message": settings.serviceName + "-" + generateRandomMessage(), "timestamp": moment().format() });
    }

    return Promise.resolve(_randomMessages);
};

export function pollServiceThroughput(_: Settings): Promise<number> {
    let _randomThroughput = Math.floor(Math.random() * 34);
    return Promise.resolve(_randomThroughput);
};

export function pollTotalThroughput(_: Settings): Promise<number> {
    let _randomThroughput = Math.floor(Math.random() * 34);
    return Promise.resolve(_randomThroughput);
};



function generateRandomMessage(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let length = 40;
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}
