import os
import httpx
import urllib.parse
from models import RawLead

_POSITIVE = {
    "growth", "expansion", "profit", "revenue", "success", "award", "launch",
    "partnership", "acquisition", "record", "milestone", "innovative",
    "investment", "funding", "raises", "hires", "opens", "expands", "wins",
    "breakthrough", "agreement", "deal", "promoted", "achieved",
}
_NEGATIVE = {
    "layoff", "layoffs", "lawsuit", "fraud", "bankruptcy", "decline", "loss",
    "scandal", "investigation", "fine", "penalty", "cuts", "closes", "shutdown",
    "bankrupt", "arrested", "charged", "violated", "misconduct", "recalled",
    "suspended", "breach", "hack", "leaked",
}


async def enrich_news(lead: RawLead, client: httpx.AsyncClient) -> dict:
    try:
        api_key = os.getenv("NEWS_API_KEY")
        if not api_key:
            return {}

        query = urllib.parse.quote(f'"{lead.company}"')
        url = (
            f"https://newsapi.org/v2/everything"
            f"?q={query}&sortBy=publishedAt&pageSize=5&language=en&apiKey={api_key}"
        )
        resp = await client.get(url, timeout=15.0)
        resp.raise_for_status()
        resp_json = resp.json()
        raw_articles = resp_json.get("articles", [])
        if not raw_articles:
            return {}

        # Full article objects for raw storage
        full_articles = [
            a for a in raw_articles[:5]
            if a.get("title") and a.get("title") != "[Removed]"
        ]
        if not full_articles:
            return {}

        # Trimmed version for the enrichment display
        articles = [
            {
                "title": a["title"],
                "url": a.get("url", ""),
                "publishedAt": a.get("publishedAt", ""),
            }
            for a in full_articles
        ]

        pos, neg = 0, 0
        for a in full_articles:
            words = set(a["title"].lower().split())
            pos += len(words & _POSITIVE)
            neg += len(words & _NEGATIVE)

        sentiment = "positive" if pos > neg else "negative" if neg > pos else "neutral"

        return {
            "news_sentiment": sentiment,
            "news_articles": articles,
            "_raw": {
                "source": "NewsAPI",
                "query": lead.company,
                "total_results": resp_json.get("totalResults", 0),
                "articles": full_articles,
            },
        }
    except Exception:
        return {}
