"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import Header from "@/components/Header";
import LeadTable from "@/components/LeadTable";
import LeadDetail from "@/components/LeadDetail";
import ProjectSidebar from "@/components/ProjectSidebar";
import { Button } from "@/components/ui/button";
import { enrichLeads, getEnrichedLeads, getProject, getProjectLeads, syncSheetRows } from "@/lib/api";
import { mergeAIInsights, saveAIInsights } from "@/lib/ai-cache";
import type { AIInsights, EnrichedLead, Project, StoredLead } from "@/lib/types";

type Step = "loading" | "preview" | "enriching" | "results";

// ---------------------------------------------------------------------------
// Date-grouped results view for Google Sheet projects
// ---------------------------------------------------------------------------

interface SheetResultsViewProps {
  enrichedLeads: EnrichedLead[];
  onRowClick: (lead: EnrichedLead) => void;
  onEnrich: () => void;
  onBack: () => void;
}

function SheetResultsView({ enrichedLeads, onRowClick, onEnrich, onBack }: SheetResultsViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = groupByDate(enrichedLeads);
  const sortedDates = [...groups.keys()].sort((a, b) => b.localeCompare(a));

  function toggleGroup(date: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  if (sortedDates.length === 0) {
    return (
      <LeadTable
        leads={[]}
        errors={[]}
        enrichedLeads={[]}
        mode="results"
        onEnrich={onEnrich}
        onBack={onBack}
        onRowClick={onRowClick}
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-3">
      {sortedDates.map((date, i) => {
        const groupLeads = groups.get(date)!;
        const isCollapsed = collapsed.has(date);
        const tierCounts = countTiers(groupLeads);

        return (
          <div key={date} className="rounded-xl border border-border overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(date)}
              className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-foreground">
                  {formatGroupDate(date)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {groupLeads.length} lead{groupLeads.length !== 1 ? "s" : ""}
                  {i === 0 ? " · latest" : ""}
                </span>
                {tierCounts.map(({ tier, count }) => (
                  <span key={tier} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_STYLES[tier]}`}>
                    {count} {tier.replace("_", " ")}
                  </span>
                ))}
              </div>
              {isCollapsed
                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>

            {/* Inline table — no extra wrapper, no footer chrome */}
            {!isCollapsed && (
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Property Address</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => onRowClick(lead)}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground w-7 text-right">
                              {lead.score.total}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIER_STYLES[lead.score.tier] ?? TIER_STYLES.NOT_QUALIFIED}`}>
                              {lead.score.tier.replace("_", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{lead.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          <span className="truncate max-w-[180px] block">{lead.email}</span>
                        </td>
                        <td className="px-5 py-3 text-foreground">
                          <span className="truncate max-w-[160px] block">{lead.company}</span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                          <span className="truncate max-w-[160px] block">{lead.property_address}</span>
                        </td>
                        <td className="px-5 py-3 text-foreground whitespace-nowrap">{lead.city}</td>
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{lead.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function groupByDate(leads: EnrichedLead[]): Map<string, EnrichedLead[]> {
  const map = new Map<string, EnrichedLead[]>();
  for (const lead of leads) {
    const date = lead.imported_at ? lead.imported_at.split("T")[0] : "unknown";
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(lead);
  }
  return map;
}

function formatGroupDate(isoDate: string): string {
  if (isoDate === "unknown") return "Unknown Date";
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function countTiers(leads: EnrichedLead[]): { tier: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const l of leads) {
    const tier = l.score?.tier ?? "NOT_QUALIFIED";
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return (["HOT", "WARM", "NURTURE", "NOT_QUALIFIED"] as const)
    .filter((t) => counts[t])
    .map((t) => ({ tier: t, count: counts[t] }));
}

const TIER_STYLES: Record<string, string> = {
  HOT:           "text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950/60 dark:border-red-800",
  WARM:          "text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800",
  NURTURE:       "text-blue-600 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-950/60 dark:border-blue-800",
  NOT_QUALIFIED: "text-muted-foreground bg-muted border border-border",
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [step, setStep] = useState<Step>("loading");
  const [project, setProject] = useState<Project | null>(null);
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [enrichedLeads, setEnrichedLeads] = useState<EnrichedLead[]>([]);
  const [pendingSyncLeads, setPendingSyncLeads] = useState<StoredLead[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [enrichingNewRows, setEnrichingNewRows] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<EnrichedLead | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    setStep("loading");
    setEnrichedLeads([]);
    setLeads([]);
    setSelectedLead(null);
    setPendingSyncLeads([]);
    setSyncMessage(null);

    const [projectData, rawLeads] = await Promise.allSettled([
      getProject(projectId),
      getProjectLeads(projectId),
    ]);
    if (projectData.status === "fulfilled") setProject(projectData.value);
    const rawLeadsList = rawLeads.status === "fulfilled" ? rawLeads.value : [];
    const rawById = new Map(rawLeadsList.map((l) => [l.id, l]));

    try {
      const result = await getEnrichedLeads(projectId);
      const withImportedAt = result.leads.map((l) => ({
        ...l,
        imported_at: rawById.get(l.id)?.imported_at ?? l.imported_at,
      }));
      const merged = mergeAIInsights(withImportedAt);
      setLeads(merged);
      setEnrichedLeads(merged);
      sessionStorage.setItem("enriched_leads", JSON.stringify(merged));
      setStep("results");
      return;
    } catch {
      // not enriched yet
    }

    if (rawLeadsList.length === 0) {
      router.replace("/");
      return;
    }
    setLeads(rawLeadsList);
    setStep("preview");
  }

  async function handleEnrich() {
    setEnrichError(null);
    setStep("enriching");
    try {
      const result = await enrichLeads(projectId, leads as StoredLead[]);
      saveAIInsights(result.leads);
      setEnrichedLeads(result.leads);
      sessionStorage.setItem("enriched_leads", JSON.stringify(result.leads));
      setSidebarRefresh((n) => n + 1);
      setStep("results");
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Enrichment failed.");
      setStep("preview");
    }
  }

  async function handleReenrichLead(lead: EnrichedLead) {
    try {
      const result = await enrichLeads(projectId, [lead]);
      const updated = result.leads[0];
      if (!updated) return;
      const newList = enrichedLeads.map((l) => l.id === updated.id ? updated : l);
      setEnrichedLeads(newList);
      setSelectedLead(updated);
      saveAIInsights(newList);
      sessionStorage.setItem("enriched_leads", JSON.stringify(newList));
    } catch {
      // silently ignore — lead stays as-is
    }
  }

  async function handleSync() {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const result = await syncSheetRows(projectId);
      if (result.new_count === 0) {
        setSyncMessage("No new rows found.");
      } else {
        setPendingSyncLeads(result.new_leads);
        setSyncMessage(`${result.new_count} new row${result.new_count !== 1 ? "s" : ""} synced from sheet.`);
      }
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleEnrichNewRows() {
    if (!pendingSyncLeads.length) return;
    setEnrichError(null);
    setEnrichingNewRows(true);
    try {
      const result = await enrichLeads(projectId, pendingSyncLeads);
      const newEnriched = result.leads.map((l) => ({
        ...l,
        imported_at: pendingSyncLeads.find((p) => p.id === l.id)?.imported_at ?? l.imported_at,
      }));
      saveAIInsights(newEnriched);
      const updated = [...enrichedLeads, ...newEnriched];
      setEnrichedLeads(updated);
      setLeads(updated);
      sessionStorage.setItem("enriched_leads", JSON.stringify(updated));
      setPendingSyncLeads([]);
      setSyncMessage(null);
      setSidebarRefresh((n) => n + 1);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Enrichment failed.");
    } finally {
      setEnrichingNewRows(false);
    }
  }

  function handleAIGenerated(leadId: string, ai: AIInsights) {
    const updated = enrichedLeads.map((l) => l.id === leadId ? { ...l, ai } : l);
    setEnrichedLeads(updated);
    if (selectedLead?.id === leadId) setSelectedLead((prev) => prev ? { ...prev, ai } : prev);
    saveAIInsights(updated);
    sessionStorage.setItem("enriched_leads", JSON.stringify(updated));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          activeProjectId={projectId}
          refreshTrigger={sidebarRefresh}
          onNew={() => router.push("/")}
          onDelete={(id) => { if (id === projectId) router.push("/"); }}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto px-6 py-10">

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading project…</p>
            </div>
          )}

          {step === "preview" && (
            <LeadTable
              leads={leads}
              errors={[]}
              enrichError={enrichError}
              onEnrich={handleEnrich}
              onBack={() => router.push("/")}
            />
          )}

          {step === "enriching" && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  Enriching {leads.length} lead{leads.length !== 1 ? "s" : ""}…
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fetching data from enrichment APIs — this takes ~15s
                </p>
              </div>
            </div>
          )}

          {step === "results" && !selectedLead && (
            <div className="space-y-6">
              {/* Sync controls — Google Sheet projects only */}
              {project?.source === "google_sheet" && (
                <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
                  {syncMessage && !pendingSyncLeads.length && (
                    <p className="text-xs text-muted-foreground">{syncMessage}</p>
                  )}
                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSync}
                      disabled={syncLoading || pendingSyncLeads.length > 0}
                      className="flex items-center gap-1.5 font-semibold"
                    >
                      {syncLoading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                        : <><RefreshCw className="w-3.5 h-3.5" /> Sync New Rows</>}
                    </Button>
                  </div>
                </div>
              )}

              {/* Pending sync rows — shown before enrichment */}
              {pendingSyncLeads.length > 0 && (
                <div className="w-full max-w-6xl mx-auto rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-primary/20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-sm font-semibold text-foreground">
                        {pendingSyncLeads.length} new row{pendingSyncLeads.length !== 1 ? "s" : ""} from sheet
                      </span>
                      <span className="text-xs text-muted-foreground">Ready to enrich</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setPendingSyncLeads([]); setSyncMessage(null); }} className="text-xs text-muted-foreground h-7">
                        Dismiss
                      </Button>
                      <Button size="sm" onClick={handleEnrichNewRows} disabled={enrichingNewRows} className="font-semibold h-7">
                        {enrichingNewRows
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enriching…</>
                          : <>Enrich {pendingSyncLeads.length} Row{pendingSyncLeads.length !== 1 ? "s" : ""}</>}
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-primary/10 bg-primary/5">
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Property Address</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingSyncLeads.map((lead) => (
                          <tr key={lead.id} className="border-b border-primary/10 last:border-0">
                            <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{lead.name}</td>
                            <td className="px-5 py-3 text-muted-foreground">
                              <span className="truncate max-w-[180px] block">{lead.email}</span>
                            </td>
                            <td className="px-5 py-3 text-foreground">
                              <span className="truncate max-w-[160px] block">{lead.company}</span>
                            </td>
                            <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                              <span className="truncate max-w-[160px] block">{lead.property_address}</span>
                            </td>
                            <td className="px-5 py-3 text-foreground whitespace-nowrap">{lead.city}</td>
                            <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{lead.state}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Date-grouped view (Google Sheet only) or flat table */}
              {project?.source === "google_sheet"
                ? <SheetResultsView
                    enrichedLeads={enrichedLeads}
                    onRowClick={setSelectedLead}
                    onEnrich={handleEnrich}
                    onBack={() => router.push("/")}
                  />
                : <LeadTable
                    leads={leads}
                    errors={[]}
                    enrichedLeads={enrichedLeads}
                    mode="results"
                    onEnrich={handleEnrich}
                    onBack={() => router.push("/")}
                    onRowClick={setSelectedLead}
                  />}
            </div>
          )}

          {step === "results" && selectedLead && (
            <LeadDetail
              lead={selectedLead}
              allLeads={enrichedLeads}
              onBack={() => setSelectedLead(null)}
              onNavigate={setSelectedLead}
              onAIGenerated={handleAIGenerated}
              onReenrich={handleReenrichLead}
            />
          )}

        </main>
      </div>
    </div>
  );
}
