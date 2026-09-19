"use client";

import { useState } from "react";
import { Check, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const LANG_STORAGE_KEY = "hakox_lang";

/** Bahasa dari berbagai negara (pilihan tersimpan di perangkat). */
const LANGUAGES: { code: string; native: string; region: string; flag: string }[] = [
  { code: "id", native: "Bahasa Indonesia", region: "Indonesia", flag: "🇮🇩" },
  { code: "en", native: "English", region: "United States", flag: "🇺🇸" },
  { code: "zh", native: "中文", region: "China", flag: "🇨🇳" },
  { code: "ja", native: "日本語", region: "Japan", flag: "🇯🇵" },
  { code: "ko", native: "한국어", region: "South Korea", flag: "🇰🇷" },
  { code: "ms", native: "Bahasa Melayu", region: "Malaysia", flag: "🇲🇾" },
  { code: "vi", native: "Tiếng Việt", region: "Vietnam", flag: "🇻🇳" },
  { code: "th", native: "ไทย", region: "Thailand", flag: "🇹🇭" },
  { code: "fil", native: "Filipino", region: "Philippines", flag: "🇵🇭" },
  { code: "hi", native: "हिन्दी", region: "India", flag: "🇮🇳" },
  { code: "ar", native: "العربية", region: "Saudi Arabia", flag: "🇸🇦" },
  { code: "tr", native: "Türkçe", region: "Türkiye", flag: "🇹🇷" },
  { code: "ru", native: "Русский", region: "Russia", flag: "🇷🇺" },
  { code: "es", native: "Español", region: "Spain", flag: "🇪🇸" },
  { code: "pt", native: "Português", region: "Brazil", flag: "🇧🇷" },
  { code: "fr", native: "Français", region: "France", flag: "🇫🇷" },
  { code: "de", native: "Deutsch", region: "Germany", flag: "🇩🇪" },
  { code: "it", native: "Italiano", region: "Italy", flag: "🇮🇹" },
];

/** Baca bahasa tersimpan (aman dipanggil di client). */
export function getSavedLang(): string {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) || "id";
  } catch {
    return "id";
  }
}

/** Nama asli bahasa yang sedang dipilih (untuk label tombol/menu). */
export function getLangNative(): string {
  const code = getSavedLang();
  return LANGUAGES.find((l) => l.code === code)?.native ?? "Bahasa Indonesia";
}

export function LanguageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  // Inisialisasi sekali per mount — setiap view memasang instance barunya,
  // jadi pilihan tersimpan selalu terbaca segar.
  const [selected, setSelected] = useState(() => getSavedLang());

  const pick = (code: string, native: string) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {
      /* penyimpanan penuh/blokir — abaikan */
    }
    setSelected(code);
    onOpenChange(false);
    toast({ title: `${native} dipilih`, description: "Pengaturan bahasa tersimpan di perangkat Anda." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border-border/60 p-0">
        <DialogTitle className="sr-only">Pilih Bahasa</DialogTitle>
        <DialogDescription className="sr-only">
          Pilih bahasa tampilan dari berbagai negara. Pilihan tersimpan otomatis.
        </DialogDescription>

        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Globe className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Pilih Bahasa</p>
            <p className="text-[11px] text-muted-foreground">Language · 言語 · Idioma · اللغة</p>
          </div>
        </div>

        {/* daftar bahasa */}
        <ul
          className="hx-scroll max-h-[52vh] divide-y divide-border/40 overflow-y-auto"
          role="listbox"
          aria-label="Daftar bahasa"
        >
          {LANGUAGES.map((l) => {
            const active = selected === l.code;
            return (
              <li key={l.code}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(l.code, l.native)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/60 active:bg-muted",
                    active && "bg-blue-50/60"
                  )}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {l.flag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-xs font-semibold", active && "text-blue-600")}>
                      {l.native}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">{l.region}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
