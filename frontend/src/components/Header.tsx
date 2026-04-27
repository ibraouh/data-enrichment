"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Menu, Moon, Sun, Monitor } from "lucide-react";

interface HeaderProps {
  onMenuToggle?: () => void;
}

const THEMES = [
  { value: "light", icon: Sun,     label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark",  icon: Moon,    label: "Dark"  },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-[88px] h-7" />;

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
      {THEMES.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={label}
          className={`flex items-center justify-center w-7 h-6 rounded-md transition-colors
            ${theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

export default function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="border-b border-border surface-glass sticky top-0 z-50">
      <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-1.5 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <span className="text-sm text-foreground tracking-tight flex items-baseline gap-2">
          <span className="font-bold text-primary">EliseAI</span>
          <span className="font-normal text-muted-foreground">Lead Enrichment</span>
        </span>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
