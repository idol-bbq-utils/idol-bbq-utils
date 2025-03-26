'use strict';

const forwarderSpiderPool = require('..');
const assert = require('assert').strict;

assert.strictEqual(forwarderSpiderPool(), 'Hello from forwarderSpiderPool');
console.info('forwarderSpiderPool tests passed');
