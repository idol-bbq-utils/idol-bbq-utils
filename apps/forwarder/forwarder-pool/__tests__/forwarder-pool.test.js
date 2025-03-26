'use strict';

const forwarderPool = require('..');
const assert = require('assert').strict;

assert.strictEqual(forwarderPool(), 'Hello from forwarderPool');
console.info('forwarderPool tests passed');
