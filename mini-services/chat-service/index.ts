/**
 * HakoX Live Chat Service (port 3003)
 * ------------------------------------
 * Menghubungkan live chat aplikasi utama (pengguna) dengan panel admin.
 * - Socket.IO (path "/") untuk real-time, diakses via gateway: /?XTransformPort=3003
 *   (gateway hanya mengekspos 1 port, dan path "/" dipakai socket.io — sehingga
 *    pemuatan riwayat memakai acknowledgement event, bukan REST terpisah)
 * - Persistensi SQLite (bun:sqlite) di chat.db milik service ini.
 */
import { createServer } from "http";
import { Server, type Socket as IoSocket } from "socket.io";
import { createHmac, timingSafeEqual } from "crypto";
import { join } from "path";
import { Database } from "bun:sqlite";

const PORT = 3003;
const SECRET = process.env.ADMIN_SECRET ?? "hakox-admin-secret-key-2025";
const MAX_TEXT = 1000;

/* ============================ DATABASE ============================ */

const db = new Database(join(import.meta.dir, "chat.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  userId       TEXT PRIMARY KEY,
  userName     TEXT NOT NULL DEFAULT '',
  userEmail    TEXT NOT NULL DEFAULT '',
  lastMessage  TEXT NOT NULL DEFAULT '',
  lastAt       TEXT NOT NULL,
  unreadAdmin  INTEGER NOT NULL DEFAULT 0,
  unreadUser   INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  userId    TEXT NOT NULL,
  sender    TEXT NOT NULL,
  text      TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(userId, id);
`);

interface ConvRow {
  userId: string;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastAt: string;
  unreadAdmin: number;
  unreadUser: number;
}
interface MsgRow {
  id: number;
  userId: string;
  sender: "user" | "admin";
  text: string;
  createdAt: string;
}

const getConv = db.prepare("SELECT * FROM conversations WHERE userId = ?");
const upsertConv = db.prepare(`
  INSERT INTO conversations (userId, userName, userEmail, lastMessage, lastAt, unreadAdmin, unreadUser)
  VALUES ($userId, $userName, $userEmail, $lastMessage, $lastAt, $unreadAdmin, $unreadUser)
  ON CONFLICT(userId) DO UPDATE SET
    userName = excluded.userName, userEmail = excluded.userEmail
`);
const touchConv = db.prepare(
  "UPDATE conversations SET lastMessage = ?, lastAt = ? WHERE userId = ?"
);
const bumpUnreadAdmin = db.prepare(
  "UPDATE conversations SET unreadAdmin = unreadAdmin + 1 WHERE userId = ?"
);
const bumpUnreadUser = db.prepare(
  "UPDATE conversations SET unreadUser = unreadUser + 1 WHERE userId = ?"
);
const clearUnreadAdmin = db.prepare(
  "UPDATE conversations SET unreadAdmin = 0 WHERE userId = ?"
);
const clearUnreadUser = db.prepare(
  "UPDATE conversations SET unreadUser = 0 WHERE userId = ?"
);
const listConvs = db.prepare("SELECT * FROM conversations ORDER BY lastAt DESC");
const listMsgs = db.prepare(
  "SELECT * FROM messages WHERE userId = ? ORDER BY id DESC LIMIT ?"
);
const insertMsg = db.prepare(
  "INSERT INTO messages (userId, sender, text, createdAt) VALUES (?, ?, ?, ?)"
);
const unreadTotalStmt = db.prepare(
  "SELECT COALESCE(SUM(unreadAdmin), 0) AS total FROM conversations"
);

/* ======================= ADMIN TOKEN VERIFY ======================= */
/** Identik dengan verifyToken di src/lib/admin-auth.ts (HMAC-SHA256 base64url). */
function verifyAdminToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
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

/* ============================ SOCKET.IO =========================== */

const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

/* ============================= STATE ============================== */

const userSockets = new Map<string, Set<string>>(); // userId -> socketIds
const adminSockets = new Set<string>();
const typingState = new Map<string, { user: boolean; admin: boolean }>();

function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}
function unreadTotal(): number {
  return (unreadTotalStmt.get() as { total: number }).total;
}
function emitUnreadTotal() {
  io.to("admins").emit("chat:unread-total", { total: unreadTotal() });
}
function convPayload(userId: string) {
  const row = getConv.get(userId) as ConvRow | null;
  if (!row) return null;
  return { ...row, userOnline: isUserOnline(userId) };
}
function pushConvToAdmins(userId: string) {
  const payload = convPayload(userId);
  if (payload) io.to("admins").emit("chat:conversation-update", payload);
}
function setTyping(userId: string, who: "user" | "admin", v: boolean) {
  const st = typingState.get(userId) ?? { user: false, admin: false };
  st[who] = v;
  typingState.set(userId, st);
  return st;
}
function convListForAdmin() {
  return (listConvs.all() as ConvRow[]).map((r) => ({
    ...r,
    userOnline: isUserOnline(r.userId),
  }));
}

/* ============================ HANDLERS ============================ */

io.on("connection", (socket: IoSocket) => {
  let joinedUserId: string | null = null;
  let isAdmin = false;

  /* ================= pengguna aplikasi ================= */

  socket.on("chat:join", (data: { userId?: string; name?: string; email?: string }) => {
    const userId = (data?.userId ?? "").trim();
    if (!userId) return;
    joinedUserId = userId;
    socket.join(`u:${userId}`);
    const set = userSockets.get(userId) ?? new Set<string>();
    set.add(socket.id);
    userSockets.set(userId, set);
    console.log(`[chat] join user=${userId} socket=${socket.id} roomSize=${set.size}`);

    const existing = getConv.get(userId) as ConvRow | null;
    upsertConv.run({
      $userId: userId,
      $userName: (data.name || existing?.userName || "Trader").slice(0, 80),
      $userEmail: (data.email || existing?.userEmail || "").slice(0, 120),
      $lastMessage: existing?.lastMessage ?? "",
      $lastAt: existing?.lastAt ?? new Date().toISOString(),
      $unreadAdmin: existing?.unreadAdmin ?? 0,
      $unreadUser: existing?.unreadUser ?? 0,
    });

    socket.emit("chat:joined", {
      unreadUser: (getConv.get(userId) as ConvRow).unreadUser,
      adminOnline: adminSockets.size > 0,
    });
    pushConvToAdmins(userId);
    io.to("admins").emit("chat:presence", { userId, online: true });
  });

  // Riwayat milik pengguna sendiri (ack)
  socket.on("chat:history", (_data: unknown, ack?: (res: unknown) => void) => {
    if (!joinedUserId || typeof ack !== "function") return;
    const rows = (listMsgs.all(joinedUserId, 100) as MsgRow[]).reverse();
    ack({ messages: rows });
  });

  socket.on("chat:user-send", (data: { text?: string }) => {
    if (!joinedUserId) return;
    const text = (data?.text ?? "").trim().slice(0, MAX_TEXT);
    if (!text) return;
    const now = new Date().toISOString();
    const info = insertMsg.run(joinedUserId, "user", text, now);
    touchConv.run(text, now, joinedUserId);
    bumpUnreadAdmin.run(joinedUserId); // menunggu dibaca admin
    setTyping(joinedUserId, "user", false);

    const msg: MsgRow = {
      id: Number(info.lastInsertRowid),
      userId: joinedUserId,
      sender: "user",
      text,
      createdAt: now,
    };
    io.to(`u:${joinedUserId}`).emit("chat:message", msg);
    io.to("admins").emit("chat:message", msg);
    console.log(`[chat] user-send delivered to room u:${joinedUserId} (sockets=${userSockets.get(joinedUserId)?.size ?? 0}) id=${msg.id}`);
    pushConvToAdmins(joinedUserId);
    emitUnreadTotal();
  });

  socket.on("chat:user-read", () => {
    if (!joinedUserId) return;
    clearUnreadUser.run(joinedUserId);
    pushConvToAdmins(joinedUserId);
  });

  socket.on("chat:typing-user", (data: { isTyping?: boolean }) => {
    if (!joinedUserId) return;
    const st = setTyping(joinedUserId, "user", !!data?.isTyping);
    io.to("admins").emit("chat:typing", {
      userId: joinedUserId,
      who: "user",
      isTyping: st.user,
    });
  });

  /* ================= admin panel ================= */

  socket.on("chat:admin-join", (data: { token?: string }) => {
    const username = data?.token ? verifyAdminToken(data.token) : null;
    if (!username) {
      socket.emit("chat:admin-denied", { error: "Token admin tidak valid." });
      return;
    }
    isAdmin = true;
    socket.join("admins");
    const wasOffline = adminSockets.size === 0;
    adminSockets.add(socket.id);

    socket.emit("chat:conversations", {
      conversations: convListForAdmin(),
      unreadTotal: unreadTotal(),
    });
    socket.emit("chat:unread-total", { total: unreadTotal() });
    if (wasOffline) io.emit("chat:admin-online", { online: true });
  });

  // Riwayat percakapan untuk admin (ack) — hanya admin terverifikasi
  socket.on(
    "chat:admin-history",
    (data: { userId?: string }, ack?: (res: unknown) => void) => {
      if (!isAdmin || typeof ack !== "function") return;
      const userId = (data?.userId ?? "").trim();
      if (!userId) return void ack({ messages: [] });
      const rows = (listMsgs.all(userId, 100) as MsgRow[]).reverse();
      ack({ messages: rows });
    }
  );

  socket.on("chat:admin-send", (data: { userId?: string; text?: string }) => {
    if (!isAdmin) return;
    const userId = (data?.userId ?? "").trim();
    const text = (data?.text ?? "").trim().slice(0, MAX_TEXT);
    if (!userId || !text) return;
    if (!(getConv.get(userId) as ConvRow | null)) return;
    const now = new Date().toISOString();
    const info = insertMsg.run(userId, "admin", text, now);
    touchConv.run(text, now, userId);
    clearUnreadAdmin.run(userId); // admin sedang menangani percakapan ini
    bumpUnreadUser.run(userId);
    setTyping(userId, "admin", false);

    const msg: MsgRow = {
      id: Number(info.lastInsertRowid),
      userId,
      sender: "admin",
      text,
      createdAt: now,
    };
    io.to(`u:${userId}`).emit("chat:message", msg);
    io.to("admins").emit("chat:message", msg);
    console.log(`[chat] admin-send delivered to room u:${userId} (sockets=${userSockets.get(userId)?.size ?? 0}) id=${msg.id} unreadUser bumped`);
    pushConvToAdmins(userId);
    emitUnreadTotal();
  });

  socket.on("chat:admin-read", (data: { userId?: string }) => {
    if (!isAdmin) return;
    const userId = (data?.userId ?? "").trim();
    if (!userId) return;
    clearUnreadAdmin.run(userId);
    pushConvToAdmins(userId);
    emitUnreadTotal();
  });

  socket.on("chat:typing-admin", (data: { userId?: string; isTyping?: boolean }) => {
    if (!isAdmin) return;
    const userId = (data?.userId ?? "").trim();
    if (!userId) return;
    const st = setTyping(userId, "admin", !!data?.isTyping);
    io.to(`u:${userId}`).emit("chat:typing", { who: "admin", isTyping: st.admin });
  });

  /* ================= putus koneksi ================= */

  socket.on("disconnect", () => {
    if (isAdmin) {
      adminSockets.delete(socket.id);
      if (adminSockets.size === 0) io.emit("chat:admin-online", { online: false });
    }
    if (joinedUserId) {
      const set = userSockets.get(joinedUserId);
      set?.delete(socket.id);
      if (set && set.size === 0) {
        userSockets.delete(joinedUserId);
        io.to("admins").emit("chat:presence", { userId: joinedUserId, online: false });
      }
    }
  });

  socket.on("error", (err) => console.error(`socket error ${socket.id}:`, err));
});

httpServer.listen(PORT, () => {
  console.log(`✅ HakoX chat service listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
