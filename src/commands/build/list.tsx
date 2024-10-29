import React from 'react';
import {Text} from 'ink';
import { printTriggerTable } from '../../lib/gcp-cloudbuild.js';

export default function list() {
    printTriggerTable();
    return <Text>List build triggers</Text>;
}