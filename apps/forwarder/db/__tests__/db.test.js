'use strict';

const db = require('..');
const assert = require('assert').strict;

assert.strictEqual(db(), 'Hello from db');
console.info('db tests passed');
