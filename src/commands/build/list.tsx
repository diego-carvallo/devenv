import React from 'react';
import {Text} from 'ink';
import { triggerList } from '../../lib/gcp-cloudbuild.js';

export default function list() {
    triggerList();
    return <Text>List build triggers</Text>;
}