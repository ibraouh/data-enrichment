import json
import logging
import os

from anthropic import AsyncAnthropic

from models import AIInsights, EnrichmentData, OutreachEmail, ScoreBreakdown, StoredLead

log = logging.getLogger(__name__)

_client: AsyncAnthropic | None = None

_SYSTEM_PROMPT = (
    "You are an EliseAI SDR assistant. EliseAI sells AI-powered leasing assistants "
    "(chat + voice) to multifamily property managers. You generate sales content that "
    "is specific, data-driven, and peer-to-peer in tone — never generic or salesy."
)


def _get_client() -> AsyncAnthropic | None:
    if not os.getenv("ANTHROPIC_API_KEY"):
        return None
    global _client
    if _client is None:
        _client = AsyncAnthropic()
    return _client


def _summarize_news(enrichment: EnrichmentData) -> str:
    if not enrichment.news_articles:
        return "No recent news found."
    headlines = [a.get("title", "") for a in enrichment.news_articles[:2] if a.get("title")]
    sentiment = enrichment.news_sentiment or "neutral"
    return f"{sentiment} sentiment — {'; '.join(headlines)}" if headlines else f"{sentiment} sentiment"


async def generate_outreach(
    lead: StoredLead,
    enrichment: EnrichmentData,
    score: ScoreBreakdown,
) -> AIInsights:
    client = _get_client()
    if not client:
        return AIInsights()

    try:
        income_str = f"${enrichment.median_household_income:,}" if enrichment.median_household_income else "unknown"
        renter_str = f"{enrichment.renter_percentage:.0f}%" if enrichment.renter_percentage is not None else "unknown"
        pop_str = f"{enrichment.total_population:,}" if enrichment.total_population else "unknown"
        location_parts = [p for p in [enrichment.osm_quarter, enrichment.osm_suburb, enrichment.osm_county] if p]
        location_str = ", ".join(location_parts) if location_parts else None
        postcode_str = enrichment.osm_postcode or None
        unemp_str = f"{enrichment.state_unemployment_rate}%" if enrichment.state_unemployment_rate is not None else "unknown"
        vacancy_str = f"{enrichment.rental_vacancy_rate}%" if enrichment.rental_vacancy_rate is not None else "unknown"
        hpi_str = str(enrichment.housing_price_index) if enrichment.housing_price_index is not None else "unknown"
        fmr_2br_str = f"${enrichment.fmr_2br:,}/mo" if enrichment.fmr_2br is not None else "unknown"
        fmr_1br_str = f"${enrichment.fmr_1br:,}/mo" if enrichment.fmr_1br is not None else "unknown"
        fmr_studio_str = f"${enrichment.fmr_studio:,}/mo" if enrichment.fmr_studio is not None else "unknown"
        multifamily_str = str(enrichment.nearby_multifamily_count) if enrichment.nearby_multifamily_count is not None else "unknown"
        avg_wage_str = f"${enrichment.avg_wage:,}" if enrichment.avg_wage else "unknown"
        poverty_str = f"{enrichment.poverty_rate:.1f}%" if enrichment.poverty_rate is not None else "unknown"

        user_prompt = f"""Lead context:
- Contact: {lead.name} at {lead.company}
- Property: {lead.property_address}, {lead.city}, {lead.state}{f" {postcode_str}" if postcode_str else ""}{"  (" + location_str + ")" if location_str else ""}
- Lead score: {score.total}/100 ({score.tier})
- Demographics: {income_str} median income, {avg_wage_str} avg wage, {renter_str} renter rate, pop {pop_str}, {poverty_str} poverty rate
- Fair market rents: studio {fmr_studio_str}, 1BR {fmr_1br_str}, 2BR {fmr_2br_str}
- Multifamily density: {multifamily_str} nearby multifamily buildings
- Market conditions: {unemp_str} unemployment, {vacancy_str} rental vacancy rate, HPI {hpi_str}
- Recent news: {_summarize_news(enrichment)}

Return ONLY valid JSON with exactly these keys:
{{
  "email_subject": "...",
  "email_body": "...",
  "score_rationale": "...",
  "sales_insights": ["...", "...", "..."]
}}

Email guidelines: 3-4 short paragraphs, under 200 words, reference at least one specific data point (city stat, news, or rental market data), end with a soft CTA for a 15-min call, sign as "the EliseAI team"."""

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
            extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"},
        )

        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)

        return AIInsights(
            email=OutreachEmail(
                subject=data.get("email_subject", ""),
                body=data.get("email_body", ""),
            ),
            score_rationale=data.get("score_rationale", ""),
            sales_insights=data.get("sales_insights", []),
        )

    except Exception:
        log.exception("Claude outreach generation failed for lead %s", lead.id)
        return AIInsights()
