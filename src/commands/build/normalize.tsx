import React from 'react';
import {Newline, Text} from 'ink';
import { triggerNormalize, TriggerType } from '../../lib/gcp-cloudbuild.js';

export const alias = 'n';


export default function normalize() {
    triggerNormalize(TriggerType.Tag);
    return <Text>Normalizing list <Newline /></Text>;
}
