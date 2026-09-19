"use client";

import { ArrowLeftRight, BarChart3, Home, Layers, Wallet } from "lucide-react";
import type { TabKey } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "home", label: "Beranda", icon: <Home className="h-5 w-5" /> },
  { key: "market", label: "Pasar", icon: <BarChart3 className="h-5 w-5" /> },
  { key: "trade", label: "Trade", icon: <ArrowLeftRight className="h-5 w-5" /> },
  { key: "contract", label: "Kontrak", icon: <Layers className="h-5 w-5" /> },
  { key: "assets", label: "Aset", icon: <Wallet className="h-5 w-5" /> },
];

/** Fixed bottom tab bar, centered to the mobile column width. */
export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("transition-transform", isActive && "-translate-y-0.5 scale-110")}>
                {tab.icon}
              </span>
              <span className={cn("text-[10px] leading-none", isActive && "font-semibold")}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
