import React from 'react';
import {Newline, Text} from 'ink';
import { triggerNormalize } from '../../lib/gcp-cloudbuild.js';

export const alias = 'n';


export default function normalize() {
    triggerNormalize();
    return <Text>Normalizing list <Newline /></Text>;
}
