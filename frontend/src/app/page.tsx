"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import LeadUploader from "@/components/LeadUploader";
import LeadTable from "@/components/LeadTable";
import ProjectSidebar from "@/components/ProjectSidebar";
import { getProjectLeads } from "@/lib/api";
import type { ParseLeadsResponse, Project, StoredLead } from "@/lib/types";

type Step = "upload" | "preview" | "enriching" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [parsedLeads, setParsedLeads] = useState<StoredLead[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

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
    setStep("upload");
  }

  async function handleSelectProject(project: Project) {
    try {
      const leads = await getProjectLeads(project.id);
      setProjectId(project.id);
      setParsedLeads(leads);
      setParseErrors([]);
      const stepMap: Record<Project["status"], Step> = {
        pending: "preview",
        enriching: "enriching",
        complete: "preview",
        failed: "preview",
      };
      setStep(stepMap[project.status] ?? "preview");
    } catch {
      // silently ignore — user stays on current step
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          activeProjectId={projectId}
          refreshTrigger={sidebarRefresh}
          onSelect={handleSelectProject}
          onNew={handleBack}
          onDelete={(id) => { if (id === projectId) handleBack(); }}
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
              onEnrich={() => setStep("enriching")}
              onBack={handleBack}
            />
          )}

          {step === "enriching" && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Enrichment coming in Phase 3</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {parsedLeads.length} leads saved · project {projectId?.slice(0, 8)}…
                </p>
              </div>
              <button
                onClick={() => setStep("preview")}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                ← Back to preview
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
