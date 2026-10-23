import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptTokens, decryptTokens } from '../src/services/tokenEncryption.js';

test('Token Encryption - AES-256-GCM round trip matches original object', () => {
  const secretKey = 'my_super_secret_master_encryption_key';
  const originalTokens = {
    access_token: 'ya29.sample_access_token_123456789',
    refresh_token: '1//sample_refresh_token_abcdef',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    token_type: 'Bearer',
    expiry_date: 1700000000000,
  };

  const encrypted = encryptTokens(originalTokens, secretKey);

  assert.ok(encrypted.encryptedData, 'Should have ciphertext');
  assert.ok(encrypted.iv, 'Should have 12-byte IV');
  assert.ok(encrypted.authTag, 'Should have 16-byte auth tag');
  assert.notEqual(encrypted.encryptedData, JSON.stringify(originalTokens), 'Ciphertext must not be plaintext');

  const decrypted = decryptTokens(encrypted, secretKey);
  assert.deepEqual(decrypted, originalTokens, 'Decrypted tokens must strictly equal original payload');
});

test('Token Encryption - Unique IV per encryption call', () => {
  const secretKey = 'test_key';
  const data = { access_token: 'test' };

  const enc1 = encryptTokens(data, secretKey);
  const enc2 = encryptTokens(data, secretKey);

  assert.notEqual(enc1.iv, enc2.iv, 'Each encryption must use a unique random IV');
  assert.notEqual(enc1.encryptedData, enc2.encryptedData, 'Identical plaintext with distinct IVs produces distinct ciphertexts');
});

test('Token Encryption - Tampered ciphertext throws authentication tag error', () => {
  const secretKey = 'test_key';
  const data = { access_token: 'valid' };

  const enc = encryptTokens(data, secretKey);

  // Tamper with ciphertext by flipping last character
  const tamperedData = enc.encryptedData.slice(0, -2) + (enc.encryptedData.endsWith('00') ? 'ff' : '00');
  const tamperedRecord = { ...enc, encryptedData: tamperedData };

  assert.throws(() => {
    decryptTokens(tamperedRecord, secretKey);
  }, /unsupported state or unable to authenticate data|bad decrypt/i);
});

test('Token Encryption - Wrong secret key fails authentication', () => {
  const secretKey = 'correct_key';
  const wrongKey = 'wrong_key';
  const data = { access_token: 'secret_token' };

  const enc = encryptTokens(data, secretKey);

  assert.throws(() => {
    decryptTokens(enc, wrongKey);
  }, /unsupported state or unable to authenticate data|bad decrypt/i);
});
