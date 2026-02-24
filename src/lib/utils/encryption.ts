import crypto from "node:crypto";

function getKey() {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY 환경변수가 필요합니다.");
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const buffer = Buffer.from(raw, "base64");
  if (buffer.length === 32) {
    return buffer;
  }

  throw new Error("APP_ENCRYPTION_KEY는 64자리 hex 또는 32바이트 base64여야 합니다.");
}

export function encryptToBase64(plaintext: string) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptFromBase64(payload: string) {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function encryptWithIv(plaintext: string): { ciphertext: string; iv: string } {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return {
    ciphertext: `${encrypted}:${tag.toString("base64")}`,
    iv: iv.toString("base64"),
  };
}

export function decryptWithIv(ciphertext: string, iv: string): string {
  const [encrypted, tagBase64] = ciphertext.split(":");
  if (!encrypted || !tagBase64) {
    throw new Error("암호문 형식이 올바르지 않습니다.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
