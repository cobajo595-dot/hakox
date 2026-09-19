"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CircleUserRound,
  MessageCircle,
  MessageSquareOff,
  SendHorizonal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { io, type Socket } from "socket.io-client";
import { getAdminToken } from "@/components/admin/admin-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ============================== TIPE ============================== */

interface Conv {
  userId: string;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastAt: string;
  unreadAdmin: number;
  unreadUser: number;
  userOnline: boolean;
}

interface ChatMsg {
  id: number;
  userId: string;
  sender: "user" | "admin";
  text: string;
  createdAt: string;
}

interface AdminLiveChatProps {
  /** Laporkan total pesan belum dibaca (untuk badge tab). */
  onUnreadChange?: (total: number) => void;
}

/* ============================ HELPERS ============================= */

function fmtRel(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/* ========================== KOMPONEN UTAMA ======================== */

export function AdminLiveChat({ onUnreadChange }: AdminLiveChatProps) {
  const { toast } = useToast();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const selectedRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedRef.current = selected?.userId ?? null;
  }, [selected?.userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, userTyping]);

  const applyConvs = useCallback(
    (rows: Conv[]) => {
      setConvs(rows);
      // segarkan baris terpilih (lastMessage/badge)
      const sel = selectedRef.current;
      if (sel) {
        const cur = rows.find((r) => r.userId === sel);
        if (cur) setSelected(cur);
      }
    },
    []
  );

  // total pesan belum dibaca admin — turunan dari daftar percakapan
  useEffect(() => {
    onUnreadChange?.(convs.reduce((a, r) => a + (r.unreadAdmin || 0), 0));
  }, [convs, onUnreadChange]);

  /* ---------- koneksi socket admin ---------- */
  useEffect(() => {
    const token = getAdminToken();

    const s = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 8000,
      forceNew: true,
    });

    s.on("connect", () => {
      setConnected(true);
      s.emit("chat:admin-join", { token });
    });
    s.on("disconnect", () => setConnected(false));

    s.on("chat:conversations", (d: { conversations?: Conv[] }) =>
      applyConvs(d?.conversations ?? [])
    );
    s.on("chat:conversation-update", (c: Conv) => {
      setConvs((prev) => {
        const next = prev.some((r) => r.userId === c.userId)
          ? prev.map((r) => (r.userId === c.userId ? c : r))
          : [c, ...prev];
        next.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
        return next;
      });
    });
    s.on("chat:unread-total", (d: { total?: number }) => onUnreadChange?.(d?.total ?? 0));
    s.on("chat:admin-denied", (d: { error?: string }) =>
      toast({ title: "Live chat", description: d?.error ?? "Akses ditolak.", variant: "destructive" })
    );

    s.on("chat:message", (m: ChatMsg) => {
      // pesan dari pengguna → tandai terbaca otomatis bila percakapan terbuka
      if (m.sender === "user") {
        if (selectedRef.current === m.userId) {
          s.emit("chat:admin-read", { userId: m.userId });
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
        }
      } else if (selectedRef.current === m.userId) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
      setConvs((prev) =>
        prev.map((r) =>
          r.userId === m.userId
            ? { ...r, lastMessage: m.text, lastAt: m.createdAt }
            : r
        )
      );
    });

    s.on("chat:typing", (d: { userId?: string; who?: string; isTyping?: boolean }) => {
      if (d?.who === "user" && d.userId === selectedRef.current) setUserTyping(!!d.isTyping);
    });
    s.on("chat:presence", (d: { userId?: string; online?: boolean }) => {
      setConvs((prev) =>
        prev.map((r) =>
          r.userId === d.userId ? { ...r, userOnline: !!d.online } : r
        )
      );
    });

    socketRef.current = s;

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [applyConvs, onUnreadChange, toast]);

  /* ---------- aksi ---------- */

  const openConv = (c: Conv) => {
    setSelected(c);
    setUserTyping(false);
    socketRef.current?.emit("chat:admin-read", { userId: c.userId });
    socketRef.current?.emit(
      "chat:admin-history",
      { userId: c.userId },
      (res: { messages?: ChatMsg[] }) => setMessages(res?.messages ?? [])
    );
  };

  const backToList = () => {
    setSelected(null);
    setMessages([]);
    setUserTyping(false);
  };

  const handleSend = () => {
    const t = draft.trim();
    if (!t || !selected || !connected) return;
    socketRef.current?.emit("chat:admin-send", { userId: selected.userId, text: t });
    setDraft("");
  };

  const handleDraftChange = (v: string) => {
    setDraft(v);
    if (!selected) return;
    socketRef.current?.emit("chat:typing-admin", { userId: selected.userId, isTyping: v.trim().length > 0 });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (selectedRef.current) {
        socketRef.current?.emit("chat:typing-admin", { userId: selectedRef.current, isTyping: false });
      }
    }, 2500);
  };

  /* ============================ RENDER ============================= */

  const sortedConvs = convs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <MessageCircle className="h-5 w-5 text-blue-600" /> Live Chat
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Balas pesan &amp; pertanyaan pengguna aplikasi secara real-time.
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
            connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
          {connected ? "Terhubung" : "Menghubungkan…"}
        </span>
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm md:h-[600px] md:grid-cols-[300px_1fr]">
        {/* ==== daftar percakapan ==== */}
        <div
          className={cn(
            "flex min-h-[320px] flex-col border-border/60 md:border-r",
            selected && "hidden md:flex"
          )}
        >
          <div className="border-b border-border/60 px-4 py-3 text-xs font-bold">
            Percakapan
            {convs.some((c) => c.unreadAdmin > 0) && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                {convs.reduce((a, c) => a + (c.unreadAdmin > 0 ? 1 : 0), 0)} belum dibaca
              </span>
            )}
          </div>
          <div className="max-h-[380px] flex-1 overflow-y-auto md:max-h-none hx-scroll">
            {sortedConvs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <MessageSquareOff className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs font-semibold text-muted-foreground">Belum ada percakapan</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                  Pesan pengguna dari live chat aplikasi akan muncul di sini.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {sortedConvs.map((c) => (
                  <li key={c.userId}>
                    <button
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
                        selected?.userId === c.userId && "bg-blue-50/70 hover:bg-blue-50"
                      )}
                      onClick={() => openConv(c)}
                    >
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white">
                        {(c.userName || "?").charAt(0).toUpperCase()}
                        {c.userOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold">{c.userName || "Tanpa nama"}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {fmtRel(c.lastAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-muted-foreground">
                            {c.lastMessage || c.userEmail || "—"}
                          </span>
                          {c.unreadAdmin > 0 && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {c.unreadAdmin > 9 ? "9+" : c.unreadAdmin}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ==== jendela chat ==== */}
        <div
          className={cn(
            "flex min-h-[380px] flex-col",
            !selected && "hidden md:flex"
          )}
        >
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <CircleUserRound className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-xs font-semibold text-muted-foreground">Pilih percakapan</p>
              <p className="max-w-[260px] text-[11px] leading-relaxed text-muted-foreground/70">
                Pilih pengguna di sebelah kiri untuk membuka dan membalas pesannya.
              </p>
            </div>
          ) : (
            <>
              {/* header chat */}
              <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
                <button
                  aria-label="Kembali ke daftar percakapan"
                  className="rounded-full p-1.5 text-muted-foreground transition hover:bg-slate-100 md:hidden"
                  onClick={backToList}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white">
                  {(selected.userName || "?").charAt(0).toUpperCase()}
                  {selected.userOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-bold">{selected.userName || "Tanpa nama"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{selected.userEmail}</p>
                </div>
              </div>

              {/* pesan */}
              <div className="h-[320px] flex-1 space-y-2.5 overflow-y-auto bg-slate-50 px-4 py-4 md:h-auto hx-scroll">
                {messages.length === 0 && !userTyping ? (
                  <p className="pt-10 text-center text-[11px] text-muted-foreground">
                    Belum ada pesan pada sesi ini.
                  </p>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[72%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
                            m.sender === "admin"
                              ? "rounded-br-md bg-blue-600 text-white"
                              : "rounded-bl-md border border-border/60 bg-white text-foreground"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              m.sender === "admin" ? "text-white/70" : "text-muted-foreground"
                            )}
                          >
                            {fmtTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {userTyping && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/60 bg-white px-3.5 py-2.5 shadow-sm">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* input */}
              <div className="flex items-center gap-2 border-t border-border/60 p-3">
                <Input
                  aria-label="Balas pesan pengguna"
                  className="h-10 flex-1 rounded-full border-border/70"
                  placeholder="Tulis balasan…"
                  value={draft}
                  disabled={!connected}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  maxLength={1000}
                />
                <button
                  aria-label="Kirim balasan"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!draft.trim() || !connected}
                  onClick={handleSend}
                >
                  <SendHorizonal className="h-4.5 w-4.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
