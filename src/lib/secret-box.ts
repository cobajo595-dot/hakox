import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Kata sandi diverifikasi memakai SHA-256 (algoritme sama dengan route auth),
 * sementara "cermin" yang bisa dilihat admin disimpan terenkripsi AES-256-GCM
 * sehingga database tidak pernah menyimpan kata sandi dalam bentuk polos.
 */

const PASSWORD_SALT = "hakox-demo-salt";

const KEY = createHash("sha256")
  .update(process.env.HAKOX_SECRET_KEY ?? "hakox-secret-key-2025")
  .digest();

/** SHA-256 kata sandi pengguna — identik dengan src/app/api/auth/login/route.ts. */
export function hashPassword(pw: string): string {
  return createHash("sha256").update(`${PASSWORD_SALT}:${pw}`).digest("hex");
}

/** Enkripsi AES-256-GCM → "v1.<iv>.<tag>.<cipher>" (base64). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

/** Dekripsi payload dari encryptSecret; null bila tidak valid / tidak ada. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(".");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return out || null;
  } catch {
    return null;
  }
}
