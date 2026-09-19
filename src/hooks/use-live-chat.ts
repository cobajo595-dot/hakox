"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export interface ChatMessage {
  id: number;
  userId?: string;
  sender: "user" | "admin";
  text: string;
  createdAt: string;
}

export interface LiveChatState {
  open: boolean;
  setOpen: (open: boolean) => void;
  connected: boolean;
  adminOnline: boolean;
  messages: ChatMessage[];
  unread: number;
  adminTyping: boolean;
  send: (text: string) => void;
  setTyping: (isTyping: boolean) => void;
}

interface LiveChatUser {
  id: string;
  name: string;
  email: string;
  /** Tamu (belum login): baru bergabung ke ruang chat saat dialog dibuka. */
  isGuest?: boolean;
}

/**
 * Live chat pengguna ↔ admin via chat-service (socket.io, port 3003).
 * Pengguna login langsung bergabung ke ruang chat begitu tersambung; TAMU
 * (belum login) baru bergabung saat pertama kali membuka dialog chat.
 * Riwayat dimuat via acknowledgement event "chat:history".
 */
export function useLiveChat(user: LiveChatUser | null): LiveChatState {
  const [open, setOpenState] = useState(false);
  const [connected, setConnected] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [adminTyping, setAdminTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const openRef = useRef(false);
  const joinFnRef = useRef<((force?: boolean) => void) | null>(null);

  /** Membuka/menutup dialog; membuka dialog otomatis menandai pesan terbaca.
   *  Tamu belum bergabung → bergabung dulu saat dialog dibuka (force). */
  const setOpen = useCallback((o: boolean) => {
    openRef.current = o;
    setOpenState(o);
    if (o) {
      joinFnRef.current?.(true);
      setUnread(0);
      socketRef.current?.emit("chat:user-read");
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Tamu: tidak boleh join otomatis; pengguna login: langsung join saat connect.
    const autoJoin = !user.isGuest;
    const identity = {
      userId: user.id,
      name: user.name || "Trader",
      email: user.email,
    };
    let joined = false;

    const tryJoin = (force = false) => {
      if (joined) return;
      if (!force && !autoJoin) return;
      joined = true;
      s.emit("chat:join", identity);
    };

    // Jalur wajib: URL relatif + XTransformPort, path default socket.io
    const s = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 8000,
      forceNew: true,
    });
    socketRef.current = s;
    joinFnRef.current = tryJoin;
    openRef.current = false;

    s.on("connect", () => {
      setConnected(true);
      tryJoin();
    });

    s.on("disconnect", () => {
      setConnected(false);
      setAdminOnline(false);
    });

    s.on("chat:joined", (d: { unreadUser?: number; adminOnline?: boolean }) => {
      setUnread(d?.unreadUser ?? 0);
      setAdminOnline(!!d?.adminOnline);
      s.emit("chat:history", {}, (res: { messages?: ChatMessage[] }) => {
        setMessages(res?.messages ?? []);
      });
    });

    s.on("chat:message", (m: ChatMessage) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.sender === "admin") {
        if (openRef.current) {
          s.emit("chat:user-read");
        } else {
          setUnread((u) => u + 1);
        }
      }
    });

    s.on("chat:admin-online", (d: { online?: boolean }) => setAdminOnline(!!d?.online));
    s.on("chat:typing", (d: { who?: string; isTyping?: boolean }) => {
      if (d?.who === "admin") setAdminTyping(!!d.isTyping);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      joinFnRef.current = null;
      setConnected(false);
    };
  }, [user?.id, user?.isGuest]);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    socketRef.current?.emit("chat:user-send", { text: t });
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    socketRef.current?.emit("chat:typing-user", { isTyping });
  }, []);

  return { open, setOpen, connected, adminOnline, messages, unread, adminTyping, send, setTyping };
}
