"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, SendHorizonal, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LiveChatState } from "@/hooks/use-live-chat";
import { cn } from "@/lib/utils";

interface LiveChatDialogProps {
  chat: LiveChatState;
  userName: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function LiveChatDialog({ chat, userName }: LiveChatDialogProps) {
  const { messages, send, adminTyping, adminOnline, connected } = chat;
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, adminTyping, chat.open]);

  const handleSend = () => {
    const t = draft.trim();
    if (!t || !connected) return;
    send(t);
    setDraft("");
    chat.setTyping(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
  };

  const handleDraftChange = (v: string) => {
    setDraft(v);
    chat.setTyping(v.trim().length > 0);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => chat.setTyping(false), 2500);
  };

  return (
    <Dialog open={chat.open} onOpenChange={chat.setOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden rounded-2xl border-border/60 p-0"
      >
        <DialogTitle className="sr-only">Live Chat HakoX</DialogTitle>
        <DialogDescription className="sr-only">
          Chat langsung dengan tim dukungan HakoX.
        </DialogDescription>

        {/* header */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-white">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Headphones className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-bold">Bantuan HakoX</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/85">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  adminOnline ? "bg-emerald-300" : "bg-white/50"
                )}
              />
              {adminOnline ? "Admin online — siap membantu" : "Admin tidak sedang online"}
            </p>
          </div>
          <button
            aria-label="Tutup live chat"
            className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            onClick={() => chat.setOpen(false)}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* messages */}
        <div className="h-[380px] space-y-2.5 overflow-y-auto bg-slate-50 px-4 py-4 hx-scroll">
          {messages.length === 0 && !adminTyping ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Headphones className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold">Halo, {userName || "Trader"}! 👋</p>
              <p className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
                Ada kendala atau pertanyaan? Tulis pesan Anda di bawah — tim kami akan
                membalas di sini.
              </p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
                      m.sender === "user"
                        ? "rounded-br-md bg-blue-600 text-white"
                        : "rounded-bl-md border border-border/60 bg-white text-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        m.sender === "user" ? "text-white/70" : "text-muted-foreground"
                      )}
                    >
                      {fmtTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}

              {adminTyping && (
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
        <div className="flex items-center gap-2 border-t border-border/60 bg-white p-3">
          <Input
            aria-label="Tulis pesan"
            className="h-10 flex-1 rounded-full border-border/70"
            placeholder={connected ? "Tulis pesan…" : "Menghubungkan…"}
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
            aria-label="Kirim pesan"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!draft.trim() || !connected}
            onClick={handleSend}
          >
            <SendHorizonal className="h-4.5 w-4.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
