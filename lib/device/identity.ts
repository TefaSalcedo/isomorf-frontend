const DATABASE_NAME = 'isomorf-device';
const STORE_NAME = 'identity';
const IDENTITY_KEY = 'current';

type StoredIdentity = {
  keyId: string;
  publicKey: JsonWebKey;
  privateKey: CryptoKey;
  fingerprint: string;
};

export type DeviceIdentity = StoredIdentity;

function encode(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function digest(value: string): Promise<string> {
  return encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIdentity(): Promise<DeviceIdentity | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(IDENTITY_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function saveIdentity(identity: DeviceIdentity): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(identity, IDENTITY_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function buildFingerprint(): Promise<string> {
  const navigatorData = [navigator.userAgent, navigator.language, navigator.platform, Intl.DateTimeFormat().resolvedOptions().timeZone, String(screen.width), String(screen.height), String(navigator.hardwareConcurrency ?? '')].join('|');
  return digest(navigatorData);
}

async function createIdentity(): Promise<DeviceIdentity> {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const identity = { keyId: crypto.randomUUID(), publicKey, privateKey: keyPair.privateKey, fingerprint: await buildFingerprint() };
  await saveIdentity(identity);
  return identity;
}

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  return (await readIdentity()) ?? createIdentity();
}

export async function regenerateDeviceIdentity(): Promise<DeviceIdentity> {
  return createIdentity();
}

export function base64UrlEncode(value: ArrayBuffer): string {
  return encode(value);
}

export async function signDeviceRequest(identity: DeviceIdentity, method: string, path: string): Promise<Record<string, string>> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const canonical = `${method}:${path}:${timestamp}:${nonce}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identity.privateKey, new TextEncoder().encode(canonical));
  return { 'X-Device-Key-Id': identity.keyId, 'X-Device-Timestamp': timestamp, 'X-Device-Nonce': nonce, 'X-Device-Signature': base64UrlEncode(signature) };
}
