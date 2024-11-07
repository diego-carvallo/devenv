import moment from 'moment';


interface Alert {
    message: string;
    condition: { type: string; creator_user_id: string };
}

export interface Options {
    project: string;
    serviceName?: string;
    error?: string;
    pollInterval: number;
}
interface Message {
    message: string;
    timestamp: string;
}

export function pollServiceAlerts(options: Options): Promise<Alert[]> {
    let _randomAlerts = [];

    for (let i = 0; i < 10; i++) {
        _randomAlerts.push({
            message: "alert-" + options.project + "-" + generateRandomMessage(),
            condition: { type: "mild", creator_user_id: "diego" }
        });
    }

    return Promise.resolve(_randomAlerts);
};

export function pollLastMessagesOfService(options: Options): Promise<Message[]> {
    let _randomMessages = [];
    if (options.error) {
        _randomMessages.push({ "message": options.error, "timestamp": moment().format() });
    }
    for (let i = 0; i < 10; i++) {
        _randomMessages.push({ "message": options.serviceName + "-" + generateRandomMessage(), "timestamp": moment().format() });
    }

    return Promise.resolve(_randomMessages);
};

export function pollServiceThroughput(_: Options): Promise<number> {
    let _randomThroughput = Math.floor(Math.random() * 34);
    return Promise.resolve(_randomThroughput);
};

export function pollTotalThroughput(_: Options): Promise<number> {
    let _randomThroughput = Math.floor(Math.random() * 34);
    return Promise.resolve(_randomThroughput);
};



function generateRandomMessage(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let length = 10;
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
}
