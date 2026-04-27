"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { generateOutreach, getRawEnrichment } from "@/lib/api";
import type { AIInsights, EnrichedLead, RawEnrichmentData } from "@/lib/types";

interface LeadDetailProps {
  lead: EnrichedLead;
  allLeads: EnrichedLead[];
  onBack: () => void;
  onNavigate: (lead: EnrichedLead) => void;
  onAIGenerated: (leadId: string, ai: AIInsights) => void;
  onReenrich: (lead: EnrichedLead) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<string, string> = {
  HOT:           "text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950/60 dark:border-red-800",
  WARM:          "text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800",
  NURTURE:       "text-blue-600 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-950/60 dark:border-blue-800",
  NOT_QUALIFIED: "text-muted-foreground bg-muted border border-border",
};

const SENTIMENT_STYLES: Record<string, string> = {
  positive: "text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800",
  neutral:  "text-muted-foreground bg-muted border border-border",
  negative: "text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950/60 dark:border-red-800",
};

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {value}<span className="text-muted-foreground font-normal">/{max}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">
        {value != null ? value : <span className="text-muted-foreground/50 font-normal">—</span>}
      </p>
    </div>
  );
}

function fmt(n: number | null | undefined, prefix = "", suffix = "") {
  if (n == null) return null;
  return `${prefix}${n.toLocaleString()}${suffix}`;
}

function RawSection({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />}
          {title}
        </span>
        {data == null && <span className="text-xs text-muted-foreground font-normal">no data</span>}
      </button>
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          {data != null ? (
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">No data was returned from this API for this lead.</p>
          )}
        </div>
      )}
    </div>
  );
}

function RawDataTab({ raw }: { raw: RawEnrichmentData | null }) {
  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs text-muted-foreground pb-1">Full API responses as received — click a source to expand.</p>
      <RawSection title="Census ACS5" data={raw?.census ?? null} />
      <RawSection title="Nominatim (Geocoding)" data={raw?.nominatim ?? null} />
      <RawSection title="Overpass (Multifamily Density)" data={raw?.overpass ?? null} />
      <RawSection title="HUD Fair Market Rents" data={raw?.hud_fmr ?? null} />
      <RawSection title="FRED" data={raw?.fred ?? null} />
      <RawSection title="NewsAPI" data={raw?.news ?? null} />
      {raw?.enriched_at && (
        <p className="text-xs text-muted-foreground pt-1">
          Enriched at {new Date(raw.enriched_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function NominatimSection({ enrichment, raw }: { enrichment: EnrichedLead["enrichment"]; raw: RawEnrichmentData | null }) {
  // Prefer stored model fields; fall back to raw Nominatim response for older leads
  const rawAddr = (raw?.nominatim as Record<string, unknown> | null | undefined)
    ?.result as Record<string, unknown> | undefined;
  const rawAddress = rawAddr?.address as Record<string, string> | undefined;

  const suburb   = enrichment.osm_suburb   ?? rawAddress?.suburb   ?? null;
  const quarter  = enrichment.osm_quarter  ?? rawAddress?.quarter  ?? null;
  const postcode = enrichment.osm_postcode ?? rawAddress?.postcode ?? null;
  const county   = enrichment.osm_county   ?? rawAddress?.county   ?? null;
  const displayName = rawAddr?.display_name as string | undefined;

  if (!suburb && !quarter && !postcode && !county) return null;

  return (
    <>
      <div className="h-px bg-border" />
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Property Location <span className="normal-case font-normal">(OpenStreetMap)</span>
        </h3>
        {displayName && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{displayName}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {postcode && <Stat label="ZIP / Postcode" value={postcode} />}
          {suburb && <Stat label="Borough / Suburb" value={suburb} />}
          {quarter && <Stat label="Neighborhood" value={quarter} />}
          {county && <Stat label="County" value={county} />}
        </div>
      </section>
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LeadDetail({ lead, allLeads, onBack, onNavigate, onAIGenerated, onReenrich }: LeadDetailProps) {
  const { enrichment: e, score: s, ai } = lead;
  const currentIndex = allLeads.findIndex((l) => l.id === lead.id);
  const prevLead = currentIndex > 0 ? allLeads[currentIndex - 1] : null;
  const nextLead = currentIndex < allLeads.length - 1 ? allLeads[currentIndex + 1] : null;
  const hasAI = ai.score_rationale || ai.sales_insights.length > 0 || ai.email.subject;

  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [reenriching, setReenriching] = useState(false);
  const [rawData, setRawData] = useState<RawEnrichmentData | null>(null);

  useEffect(() => {
    setRawData(null);
    getRawEnrichment(lead.id)
      .then(setRawData)
      .catch(() => {});
  }, [lead.id]);

  async function handleReenrich() {
    setReenriching(true);
    await onReenrich(lead);
    setReenriching(false);
  }

  async function handleRunAI() {
    setAILoading(true);
    setAIError(null);
    try {
      const result = await generateOutreach(lead);
      onAIGenerated(lead.id, result);
    } catch (err) {
      setAIError(err instanceof Error ? err.message : "AI generation failed.");
    } finally {
      setAILoading(false);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Nav bar — sticky within the scrolling content area */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 mb-6 border-b border-border bg-background/90 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to leads
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReenrich}
            disabled={reenriching}
            className="gap-1.5 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reenriching ? "animate-spin" : ""}`} />
            {reenriching ? "Re-enriching…" : "Re-enrich"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!prevLead}
            onClick={() => prevLead && onNavigate(prevLead)}
            className="text-muted-foreground gap-1.5 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline truncate max-w-[120px]">
              {prevLead ? prevLead.name : "Previous"}
            </span>
          </Button>
          <span className="text-xs text-muted-foreground/50 tabular-nums">
            {currentIndex + 1} / {allLeads.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!nextLead}
            onClick={() => nextLead && onNavigate(nextLead)}
            className="text-muted-foreground gap-1.5 disabled:opacity-30"
          >
            <span className="hidden sm:inline truncate max-w-[120px]">
              {nextLead ? nextLead.name : "Next"}
            </span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Lead header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
          <p className="text-base text-muted-foreground mt-0.5">{lead.company}</p>
          <p className="text-sm text-muted-foreground">{lead.email}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {lead.property_address}, {lead.city}, {lead.state}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-4xl font-extrabold text-foreground">{s.total}</span>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${TIER_STYLES[s.tier]}`}>
            {s.tier.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="outreach" className="flex-1">Outreach</TabsTrigger>
          <TabsTrigger value="raw" className="flex-1">Raw Data</TabsTrigger>
        </TabsList>

        {/* ---- Details ---- */}
        <TabsContent value="details" className="space-y-6 pt-6">
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Score Breakdown</h3>
            <div className="space-y-2.5">
              <ScoreBar label="Demographics" value={s.demographics_score} max={35} />
              <ScoreBar label="Market Health" value={s.market_health_score} max={35} />
              <ScoreBar label="News Sentiment" value={s.news_score} max={20} />
              <ScoreBar label="Geographic" value={s.geographic_score} max={10} />
            </div>
          </section>

          <div className="h-px bg-border" />

          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Demographics (Census ACS5)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Median Household Income" value={fmt(e.median_household_income, "$")} />
              <Stat label="Mean Household Income" value={fmt(e.avg_wage, "$")} />
              <Stat label="Renter Occupied" value={fmt(e.renter_percentage, "", "%")} />
              <Stat label="Total Population" value={fmt(e.total_population)} />
              <Stat label="Poverty Rate" value={fmt(e.poverty_rate, "", "%")} />
            </div>
          </section>

          <div className="h-px bg-border" />

          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Market Health</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat label="State Unemployment Rate" value={fmt(e.state_unemployment_rate, "", "%")} />
              <Stat label="Rental Vacancy Rate" value={fmt(e.rental_vacancy_rate, "", "%")} />
              <Stat label="House Price Index" value={fmt(e.housing_price_index)} />
              <Stat label="Fair Market Rent (2BR)" value={fmt(e.fmr_2br, "$", "/mo")} />
              <Stat label="Fair Market Rent (1BR)" value={fmt(e.fmr_1br, "$", "/mo")} />
              <Stat label="Fair Market Rent (Studio)" value={fmt(e.fmr_studio, "$", "/mo")} />
              <Stat label="Nearby Multifamily Buildings" value={fmt(e.nearby_multifamily_count, "", " within 1.5km")} />
            </div>
          </section>

          <div className="h-px bg-border" />

          <section>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">News (NewsAPI)</h3>
              {e.news_sentiment && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SENTIMENT_STYLES[e.news_sentiment] ?? SENTIMENT_STYLES.neutral}`}>
                  {e.news_sentiment}
                </span>
              )}
            </div>
            {e.news_articles.length > 0 ? (
              <ul className="space-y-2">
                {e.news_articles.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground/40 mt-0.5 shrink-0">•</span>
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1">
                        {a.title}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-foreground">{a.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/50">No recent news found.</p>
            )}
          </section>

          <NominatimSection enrichment={e} raw={rawData} />

          {e.enrichment_errors.length > 0 && (
            <>
              <div className="h-px bg-border" />
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Enrichment Errors</h3>
                <ul className="space-y-1">
                  {e.enrichment_errors.map((err, i) => (
                    <li key={i} className="text-xs text-muted-foreground font-mono">{err}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </TabsContent>

        {/* ---- Outreach ---- */}
        <TabsContent value="outreach" className="space-y-6 pt-6">
          {!hasAI ? (
            <div className="rounded-lg border border-border bg-muted/30 px-6 py-10 flex flex-col items-center gap-4 text-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Generate AI insights for this lead</p>
                <p className="text-xs text-muted-foreground">
                  Creates a personalized outreach email, score rationale, and sales talking points using Claude.
                </p>
              </div>
              {aiError && (
                <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>
              )}
              <button
                onClick={handleRunAI}
                disabled={aiLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {aiLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {aiLoading ? "Generating…" : "Run AI"}
              </button>
            </div>
          ) : (
            <>
              {ai.score_rationale && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Why This Score</h3>
                  <p className="text-sm text-foreground leading-relaxed">{ai.score_rationale}</p>
                </section>
              )}

              {ai.sales_insights.length > 0 && (
                <>
                  <div className="h-px bg-border" />
                  <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sales Insights</h3>
                    <ul className="space-y-2">
                      {ai.sales_insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                          <span className="text-primary mt-0.5 shrink-0">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              {ai.email.subject && (
                <>
                  <div className="h-px bg-border" />
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Draft</h3>
                      <CopyButton text={`Subject: ${ai.email.subject}\n\n${ai.email.body}`} />
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border bg-muted/40">
                        <p className="text-xs text-muted-foreground">
                          Subject: <span className="font-medium text-foreground">{ai.email.subject}</span>
                        </p>
                      </div>
                      <div className="px-4 py-4">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{ai.email.body}</p>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* ---- Raw Data ---- */}
        <TabsContent value="raw">
          {rawData === null ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading raw API responses…</span>
            </div>
          ) : (
            <RawDataTab raw={rawData} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
