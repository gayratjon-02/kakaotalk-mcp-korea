import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseType, isDeletedType, sourceLogId } from '../libs/database/message-verify.js';

test('the quoted message id keeps all 19 digits even though JSON.parse would round it', () => {
	const raw = '{"src_linkId":0,"src_userId":1,"src_logId":3946096487573825537,"src_type":1,"src_message":"okay"}';
	assert.equal(sourceLogId(raw), '3946096487573825537');
	assert.notEqual(String((JSON.parse(raw) as { src_logId: number }).src_logId), '3946096487573825537');
});

test('a missing or broken attachment gives no quoted id', () => {
	assert.equal(sourceLogId(null), null);
	assert.equal(sourceLogId('not json'), null);
});

test('the deleted flag is recognised and stripped from the stored kind', () => {
	assert.equal(isDeletedType(16385), true);
	assert.equal(isDeletedType(1), false);
	assert.equal(baseType(16385), 1);
	assert.equal(baseType(26), 26);
});
