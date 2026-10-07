import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindingFromSpaces } from '../libs/device/desktop-binding.js';

const BUNDLE = 'com.example.App';

test('no app-bindings dictionary means nothing is assigned', () => {
	assert.equal(bindingFromSpaces({ other: 1 }, BUNDLE), 'not-assigned');
});

test('an app that is missing from the bindings is not assigned', () => {
	assert.equal(bindingFromSpaces({ 'app-bindings': { 'com.other.App': 'AppBindingAllSpaces' } }, BUNDLE), 'not-assigned');
});

test('an all-spaces binding is recognised', () => {
	assert.equal(bindingFromSpaces({ 'app-bindings': { [BUNDLE]: 'AppBindingAllSpaces' } }, BUNDLE), 'all-desktops');
});

test('a binding to a single space does not count as all desktops', () => {
	assert.equal(bindingFromSpaces({ 'app-bindings': { [BUNDLE]: 'AppBindingThisSpace1234' } }, BUNDLE), 'not-assigned');
});

test('an unexpected shape is reported as unknown instead of guessed', () => {
	assert.equal(bindingFromSpaces({ 'app-bindings': 'oops' }, BUNDLE), 'unknown');
});
