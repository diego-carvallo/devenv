import React from 'react';
import {Text, Newline} from 'ink';
import zod from 'zod';

export const options = zod.object({
    verbose: zod.string().default('false').describe('Run with extra debug output'),
    dryrun: zod.string().default('false').describe('Dos not run, only prints the execution plan')
});

type Properties = {
    options: zod.infer<typeof options>;
};

export default function Index({options}: Readonly<Properties>) {
    return (
        <Text>
            Try running: <Newline />
                devenv <Text color="green">-h</Text><Newline />
                devenv <Text color="green">--dryrun {options.dryrun}</Text>
        </Text>
        
    );
}
