import "server-only";
import { NextRequest } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

const ADMIN_SALT = "hakox-admin-salt";
const SECRET = process.env.ADMIN_SECRET ?? "hakox-admin-secret-key-2025";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin123";

export function adminHash(pw: string): string {
  return createHash("sha256").update(`${ADMIN_SALT}:${pw}`).digest("hex");
}

/** Seed akun admin default (admin / admin123) jika belum ada. */
export async function ensureAdmin(): Promise<void> {
  const count = await db.admin.count();
  if (count > 0) return;
  await db.admin.create({
    data: {
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash: adminHash(DEFAULT_ADMIN_PASSWORD),
    },
  }).catch(() => {
    /* race condition antar request — aman diabaikan */
  });
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Token format: base64url(payload).hmac — payload berisi username & expiry. */
export function makeToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Kembalikan username jika token valid & belum kedaluwarsa, selain itu null. */
export function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      u?: string;
      exp?: number;
    };
    if (!data.u || !data.exp || data.exp < Date.now()) return null;
    return data.u;
  } catch {
    return null;
  }
}

/** Guard untuk route admin: ambil username dari header Authorization Bearer. */
export function requireAdmin(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  return verifyToken(token);
}
