import httpx


async def enrich_overpass(lat: float | None, lon: float | None, client: httpx.AsyncClient) -> dict:
    """Count multifamily/apartment buildings within 1.5km of the property address.
    Requires lat/lon from a prior Nominatim geocoding call.
    """
    try:
        if lat is None or lon is None:
            return {}

        radius = 1500  # metres
        query = (
            f'[out:json][timeout:15];'
            f'(way["building"="apartments"](around:{radius},{lat},{lon});'
            f'way["building"="residential"](around:{radius},{lat},{lon});'
            f'relation["building"="apartments"](around:{radius},{lat},{lon}););'
            f'out count;'
        )

        resp = await client.get(
            "https://overpass-api.de/api/interpreter",
            params={"data": query},
            headers={"Accept": "application/json", "User-Agent": "EliseAI-LeadEnrichment/1.0"},
            timeout=20.0,
        )
        resp.raise_for_status()
        data = resp.json()

        elements = data.get("elements", [])
        if not elements:
            return {}

        tags = elements[0].get("tags", {})
        total = int(tags.get("total", 0))

        return {
            "nearby_multifamily_count": total,
            "_raw": {
                "source": "OpenStreetMap Overpass API",
                "radius_metres": radius,
                "coordinates": {"lat": lat, "lon": lon},
                "counts": {"ways": tags.get("ways"), "relations": tags.get("relations"), "total": total},
            },
        }
    except Exception:
        return {}
