"use client";

export const ADMIN_TOKEN_KEY = "hakox_admin_token";
export const ADMIN_USERNAME_KEY = "hakox_admin_username";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeAdminSession(token: string, username: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USERNAME_KEY, username);
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USERNAME_KEY);
}

export function getAdminUsername(): string {
  try {
    return localStorage.getItem(ADMIN_USERNAME_KEY) ?? "admin";
  } catch {
    return "admin";
  }
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Fetch dengan token admin; lempar AdminApiError(401) jika sesi habis. */
export function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body) headers["Content-Type"] = "application/json";
  return fetch(url, { ...init, headers, cache: "no-store" });
}

/** Helper JSON: parse & lempar error bila !ok. */
export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(url, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* body kosong */
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error ??
      (res.status === 401 ? "Sesi berakhir. Silakan masuk lagi." : "Kesalahan server.");
    throw new AdminApiError(msg, res.status);
  }
  return data as T;
}
