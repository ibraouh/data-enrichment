export default function Header() {
  return (
    <header className="border-b border-border surface-glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo — purple box + wordmark, mirrors EliseAI's actual logo treatment */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-brand shadow-glow-sm flex-shrink-0">
            <span className="text-white font-bold text-sm leading-none select-none">E</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-foreground font-bold text-sm tracking-tight">Elise</span>
            <span className="text-primary font-bold text-sm tracking-tight">AI</span>
            <span className="text-muted-foreground text-xs font-normal ml-1 hidden sm:inline">
              / Lead Enrichment
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground hidden md:block">
            Powered by Claude AI
          </span>
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-slow" />
            <span>Live</span>
          </div>
        </div>

      </div>
    </header>
  );
}
