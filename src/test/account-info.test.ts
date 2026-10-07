import assert from 'node:assert/strict';
import { test } from 'node:test';
import { phoneFromLoginId } from '../libs/database/account-repository.js';

test('a numeric login id becomes an international phone number', () => {
	assert.equal(phoneFromLoginId('821000000002'), '+821000000002');
});

test('an email login id is not mistaken for a phone number', () => {
	assert.equal(phoneFromLoginId('someone@example.com'), null);
});

test('a short digit string or a missing id gives no phone number', () => {
	assert.equal(phoneFromLoginId('12345'), null);
	assert.equal(phoneFromLoginId(null), null);
});
