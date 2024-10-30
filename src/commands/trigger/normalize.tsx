import React from 'react';
import {Newline, Text} from 'ink';
import * as cloudbuild from '../../lib/gcp-cloudbuild.js';

export const alias = 'n';


export default function normalize() {
    const summary = cloudbuild.triggerNormalize(cloudbuild.TriggerType.Tag);
    console.log(summary);
    return <Text>Normalizing list <Newline /></Text>;
}
