"use client";

import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EnrichedLead, StoredLead } from "@/lib/types";

interface LeadTableProps {
  leads: StoredLead[];
  errors: string[];
  enrichError?: string | null;
  enrichedLeads?: EnrichedLead[];
  mode?: "preview" | "results";
  onEnrich: () => void;
  onBack: () => void;
  onRowClick?: (lead: EnrichedLead) => void;
  hideHeader?: boolean;
}

const TIER_STYLES: Record<string, string> = {
  HOT:           "text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950/60 dark:border-red-800",
  WARM:          "text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800",
  NURTURE:       "text-blue-600 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-950/60 dark:border-blue-800",
  NOT_QUALIFIED: "text-muted-foreground bg-muted border border-border",
};

export default function LeadTable({
  leads,
  errors,
  enrichError,
  enrichedLeads,
  mode = "preview",
  onEnrich,
  onBack,
  onRowClick,
  hideHeader = false,
}: LeadTableProps) {
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  const isResults = mode === "results" && enrichedLeads && enrichedLeads.length > 0;
  const enrichedMap = new Map(enrichedLeads?.map((l) => [l.id, l]) ?? []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">

      {/* Summary bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">
              {isResults ? "Enrichment Results" : "Lead Preview"}
            </h2>
            <Badge variant="default">{leads.length} leads</Badge>
            {isResults && (
              <>
                <Badge className="text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-950/60 dark:border-red-800">
                  {enrichedLeads!.filter((l) => l.score.tier === "HOT").length} HOT
                </Badge>
                <Badge className="text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800">
                  {enrichedLeads!.filter((l) => l.score.tier === "WARM").length} WARM
                </Badge>
                <Badge className="text-blue-600 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-950/60 dark:border-blue-800">
                  {enrichedLeads!.filter((l) => l.score.tier === "NURTURE").length} NURTURE
                </Badge>
                <Badge className="text-muted-foreground bg-muted border border-border">
                  {enrichedLeads!.filter((l) => l.score.tier === "NOT_QUALIFIED").length} NOT QUALIFIED
                </Badge>
              </>
            )}
            {errors.length > 0 && (
              <Badge variant="destructive">{errors.length} skipped</Badge>
            )}
          </div>
          <div />
        </div>
      )}

      {/* Error banner */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60 overflow-hidden">
          <button
            onClick={() => setErrorsExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950 transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {errors.length} row{errors.length !== 1 ? "s" : ""} skipped due to missing required fields
            </span>
            {errorsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {errorsExpanded && (
            <ul className="px-4 pb-3 space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-400 font-mono">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Enrich error */}
      {enrichError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/60 px-4 py-2.5">
          <p className="text-xs font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Enrichment failed: {enrichError}
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {isResults && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Property Address</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const enriched = enrichedMap.get(lead.id);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => enriched && onRowClick?.(enriched)}
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${enriched && onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {isResults && enriched && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground w-7 text-right">
                            {enriched.score.total}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_STYLES[enriched.score.tier] ?? TIER_STYLES.NOT_QUALIFIED}`}>
                            {enriched.score.tier.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{lead.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="truncate max-w-[180px] block">{lead.email}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <span className="truncate max-w-[160px] block">{lead.company}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      <span className="truncate max-w-[160px] block">{lead.property_address}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{lead.city}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{lead.state}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end pt-2">
        {isResults ? (
          <Button variant="outline" onClick={onEnrich} className="font-semibold px-6">
            <RefreshCw className="w-4 h-4" />
            Re-enrich all
          </Button>
        ) : (
          <Button onClick={onEnrich} className="font-semibold px-6">
            Enrich {leads.length} Lead{leads.length !== 1 ? "s" : ""}
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

    </div>
  );
}
