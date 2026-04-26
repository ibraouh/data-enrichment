"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import LeadUploader from "@/components/LeadUploader";
import LeadTable from "@/components/LeadTable";
import ProjectSidebar from "@/components/ProjectSidebar";
import { enrichLeads } from "@/lib/api";
import { saveAIInsights } from "@/lib/ai-cache";
import type { ParseLeadsResponse, StoredLead } from "@/lib/types";

type Step = "upload" | "preview" | "enriching";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [parsedLeads, setParsedLeads] = useState<StoredLead[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleParseSuccess(response: ParseLeadsResponse) {
    setProjectId(response.project_id);
    setParsedLeads(response.leads);
    setParseErrors(response.errors);
    setStep("preview");
    setSidebarRefresh((n) => n + 1);
  }

  function handleBack() {
    setProjectId(null);
    setParsedLeads([]);
    setParseErrors([]);
    setEnrichError(null);
    setStep("upload");
  }

  async function handleEnrich() {
    if (!projectId) return;
    setEnrichError(null);
    setStep("enriching");
    try {
      const result = await enrichLeads(projectId, parsedLeads);
      saveAIInsights(result.leads);
      sessionStorage.setItem("enriched_leads", JSON.stringify(result.leads));
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : "Enrichment failed.");
      setStep("preview");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          activeProjectId={projectId}
          refreshTrigger={sidebarRefresh}
          onNew={handleBack}
          onDelete={(id) => { if (id === projectId) handleBack(); }}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto px-6 py-10">

          {step === "upload" && (
            <div className="max-w-xl mx-auto">
              <div className="mb-6">
                <h1 className="text-lg font-semibold text-foreground">Import Leads</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a file, paste CSV, or add a single lead.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <LeadUploader onSuccess={handleParseSuccess} />
              </div>
            </div>
          )}

          {step === "preview" && (
            <LeadTable
              leads={parsedLeads}
              errors={parseErrors}
              enrichError={enrichError}
              onEnrich={handleEnrich}
              onBack={handleBack}
            />
          )}

          {step === "enriching" && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  Enriching {parsedLeads.length} lead{parsedLeads.length !== 1 ? "s" : ""}…
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Calling Census, WalkScore, FRED, NewsAPI, and Claude AI — this takes ~20s
                </p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
