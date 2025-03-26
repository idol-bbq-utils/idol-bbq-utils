'use strict';

const forwarderManager = require('..');
const assert = require('assert').strict;

assert.strictEqual(forwarderManager(), 'Hello from forwarderManager');
console.info('forwarderManager tests passed');
