import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuToggle?: () => void;
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
      </div>
    </header>
  );
}
