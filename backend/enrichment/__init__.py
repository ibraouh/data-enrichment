# Enrichment modules — each exports a single async function:
#   async def enrich_*(lead: RawLead, client: httpx.AsyncClient) -> dict
#
# Failures are caught internally and return {} so one bad API never
# crashes the full enrichment pipeline.
