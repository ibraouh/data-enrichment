"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import LeadTable from "@/components/LeadTable";
import LeadDetail from "@/components/LeadDetail";
import ProjectSidebar from "@/components/ProjectSidebar";
import { enrichLeads, getEnrichedLeads, getProjectLeads } from "@/lib/api";
import { mergeAIInsights, saveAIInsights } from "@/lib/ai-cache";
import type { AIInsights, EnrichedLead, StoredLead } from "@/lib/types";

type Step = "loading" | "preview" | "enriching" | "results";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [step, setStep] = useState<Step>("loading");
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [enrichedLeads, setEnrichedLeads] = useState<EnrichedLead[]>([]);
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

    try {
      const result = await getEnrichedLeads(projectId);
      const merged = mergeAIInsights(result.leads);
      setLeads(merged);
      setEnrichedLeads(merged);
      sessionStorage.setItem("enriched_leads", JSON.stringify(merged));
      setStep("results");
      return;
    } catch {
      // not enriched yet
    }

    try {
      const rawLeads = await getProjectLeads(projectId);
      if (rawLeads.length === 0) throw new Error("empty");
      setLeads(rawLeads);
      setStep("preview");
    } catch {
      router.replace("/");
    }
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
            <LeadTable
              leads={leads}
              errors={[]}
              enrichedLeads={enrichedLeads}
              mode="results"
              onEnrich={handleEnrich}
              onBack={() => router.push("/")}
              onRowClick={setSelectedLead}
            />
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
