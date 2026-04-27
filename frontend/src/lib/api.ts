import type { AIInsights, EnrichedLead, EnrichLeadsResponse, ParseLeadsResponse, Project, RawEnrichmentData, RawLead, StoredLead } from "./types";


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(body);
      message = json.detail ?? message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function fetchHello(): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/hello`);
  return handleResponse(res);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API_URL}/api/projects`);
  const data = await handleResponse<{ projects: Project[] }>(res);
  return data.projects;
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API_URL}/api/projects/${id}/detail`);
  return handleResponse(res);
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await handleResponse(res);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  await handleResponse(res);
}

export async function getProjectLeads(projectId: string): Promise<StoredLead[]> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/leads`);
  const data = await handleResponse<{ leads: StoredLead[] }>(res);
  return data.leads;
}

// ---------------------------------------------------------------------------
// Lead Ingestion (Phase 2)
// ---------------------------------------------------------------------------

export async function parseLeadsFromFile(file: File): Promise<ParseLeadsResponse> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_URL}/api/parse-leads`, { method: "POST", body });
  return handleResponse(res);
}

export async function parseLeadsFromCSV(csvText: string): Promise<ParseLeadsResponse> {
  const body = new FormData();
  body.append("csv_text", csvText);
  const res = await fetch(`${API_URL}/api/parse-leads`, { method: "POST", body });
  return handleResponse(res);
}

export async function parseLeadsSingle(lead: RawLead): Promise<ParseLeadsResponse> {
  const res = await fetch(`${API_URL}/api/parse-leads/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  return handleResponse(res);
}

// ---------------------------------------------------------------------------
// Enrichment (Phase 3)
// ---------------------------------------------------------------------------

export async function generateOutreach(lead: EnrichedLead): Promise<AIInsights> {
  const res = await fetch(`${API_URL}/api/leads/${lead.id}/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lead: {
        id: lead.id,
        project_id: lead.project_id,
        name: lead.name,
        email: lead.email,
        company: lead.company,
        property_address: lead.property_address,
        city: lead.city,
        state: lead.state,
        country: lead.country,
      },
      enrichment: lead.enrichment,
      score: lead.score,
    }),
  });
  return handleResponse(res);
}

export async function getRawEnrichment(leadId: string): Promise<RawEnrichmentData> {
  const res = await fetch(`${API_URL}/api/leads/${leadId}/raw-enrichment`);
  return handleResponse(res);
}

export async function getEnrichedLeads(projectId: string): Promise<EnrichLeadsResponse> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/enriched-leads`);
  return handleResponse(res);
}

export async function enrichLeads(
  projectId: string,
  leads?: StoredLead[],
): Promise<EnrichLeadsResponse> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/enrich`, {
    method: "POST",
    headers: leads ? { "Content-Type": "application/json" } : {},
    body: leads ? JSON.stringify({ leads }) : undefined,
  });
  return handleResponse(res);
}
