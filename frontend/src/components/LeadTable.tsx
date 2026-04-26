"use client";

import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { StoredLead } from "@/lib/types";

interface LeadTableProps {
  leads: StoredLead[];
  errors: string[];
  onEnrich: () => void;
  onBack: () => void;
}

export default function LeadTable({ leads, errors, onEnrich, onBack }: LeadTableProps) {
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">

      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Lead Preview</h2>
          <Badge variant="default">{leads.length} leads ready</Badge>
          {errors.length > 0 && (
            <Badge variant="destructive">{errors.length} skipped</Badge>
          )}
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Upload different file
        </button>
      </div>

      {/* Error banner */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
          <button
            onClick={() => setErrorsExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {errors.length} row{errors.length !== 1 ? "s" : ""} skipped due to missing required fields
            </span>
            {errorsExpanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {errorsExpanded && (
            <ul className="px-4 pb-3 space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-amber-700 font-mono">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Property Address</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
          Start over
        </Button>
        <Button onClick={onEnrich} className="font-semibold px-6">
          Enrich {leads.length} Lead{leads.length !== 1 ? "s" : ""}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
