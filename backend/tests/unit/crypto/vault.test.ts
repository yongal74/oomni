/**
 * TDD: Credential Vault — AES-256-GCM 암호화/복호화
 * 상업용 제품: API 키, OAuth 토큰 등 민감 정보를 DB에 암호화 저장
 */
import { Vault } from '../../../src/crypto/vault';

describe('Vault — AES-256-GCM 암호화', () => {
  let vault: Vault;

  beforeEach(() => {
    vault = new Vault('test-master-key-32-chars-exactly!!');
  });

  test('encrypt()는 plaintext와 다른 값을 반환한다', () => {
    const plain = 'sk-ant-secret-api-key-12345';
    const encrypted = vault.encrypt(plain);
    expect(encrypted).not.toBe(plain);
  });

  test('encrypt()는 매번 다른 결과를 반환한다 (random IV)', () => {
    const plain = 'same-secret';
    const enc1 = vault.encrypt(plain);
    const enc2 = vault.encrypt(plain);
    expect(enc1).not.toBe(enc2);
  });

  test('decrypt(encrypt(x)) === x', () => {
    const plain = 'sk-ant-real-api-key-test';
    const encrypted = vault.encrypt(plain);
    const decrypted = vault.decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  test('잘못된 키로 복호화하면 에러가 발생한다', () => {
    const encrypted = vault.encrypt('my-secret');
    const evilVault = new Vault('wrong-master-key-32-chars-exactly!');
    expect(() => evilVault.decrypt(encrypted)).toThrow();
  });

  test('빈 문자열도 암호화/복호화 가능하다', () => {
    const plain = '';
    const encrypted = vault.encrypt(plain);
    expect(vault.decrypt(encrypted)).toBe(plain);
  });

  test('한글 포함 문자열도 정상 동작한다', () => {
    const plain = '내 API 키 abc-123';
    expect(vault.decrypt(vault.encrypt(plain))).toBe(plain);
  });

  test('JSON 객체 형태의 credentials도 암호화 가능하다', () => {
    const creds = JSON.stringify({ token: 'abc', refresh: 'xyz', expires: 9999 });
    expect(vault.decrypt(vault.encrypt(creds))).toBe(creds);
  });

  test('encryptObject / decryptObject 헬퍼가 동작한다', () => {
    const obj = { token: 'abc', apiKey: 'sk-123', workspace: 'my-slack' };
    const enc = vault.encryptObject(obj);
    const dec = vault.decryptObject<typeof obj>(enc);
    expect(dec).toEqual(obj);
  });
});
