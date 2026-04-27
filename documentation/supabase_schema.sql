-- EliseAI Lead Enrichment — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- ============================================================
-- PROJECTS — each file upload or batch = one project
-- ============================================================
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'pending'
                check (status in ('pending', 'enriching', 'complete', 'failed')),
  total_leads integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- LEADS — raw lead data, many per project
-- ============================================================
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  name             text not null,
  email            text not null,
  company          text not null,
  property_address text not null,
  city             text not null,
  state            text not null,
  country          text not null default 'USA',
  created_at       timestamptz not null default now()
);

create index if not exists leads_project_id_idx on leads(project_id);

-- ============================================================
-- ENRICHMENT_RESULTS — one row per lead, all API data
-- ============================================================
create table if not exists enrichment_results (
  id                       uuid primary key default gen_random_uuid(),
  lead_id                  uuid not null unique references leads(id) on delete cascade,

  -- Census ACS5 demographics
  median_household_income  integer,
  total_population         integer,
  renter_percentage        numeric(5, 2),
  avg_wage                 integer,
  poverty_rate             numeric(5, 2),

  -- Nominatim geocoding
  latitude                 numeric(9, 6),
  longitude                numeric(9, 6),

  -- HUD Fair Market Rents
  fmr_studio               integer,
  fmr_1br                  integer,
  fmr_2br                  integer,

  -- Overpass — nearby multifamily building count
  nearby_multifamily_count integer,

  -- FRED economic indicators
  state_unemployment_rate  numeric(5, 2),
  rental_vacancy_rate      numeric(5, 2),
  housing_price_index      numeric(10, 2),

  -- NewsAPI
  news_sentiment           text check (news_sentiment in ('positive', 'neutral', 'negative')),
  news_articles            jsonb not null default '[]',

  -- Metadata
  enrichment_errors        text[] not null default '{}',
  enriched_at              timestamptz not null default now()
);

-- ============================================================
-- LEAD_SCORES — one row per lead, scoring breakdown
-- ============================================================
create table if not exists lead_scores (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid not null unique references leads(id) on delete cascade,
  demographics_score   integer not null default 0,
  market_health_score  integer not null default 0,
  walkability_score    integer not null default 0,
  news_score           integer not null default 0,
  geographic_score     integer not null default 0,
  total                integer not null default 0,
  tier                 text not null check (tier in ('HOT', 'WARM', 'NURTURE', 'NOT_QUALIFIED')),
  rationale            text,
  scored_at            timestamptz not null default now()
);

-- ============================================================
-- OUTREACH — one row per lead, AI-generated email + insights
-- ============================================================
create table if not exists outreach (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null unique references leads(id) on delete cascade,
  email_subject  text,
  email_body     text,
  sales_insights jsonb not null default '[]',
  generated_at   timestamptz not null default now()
);

-- ============================================================
-- ENRICHMENT_RAW — full API responses, one row per lead
-- ============================================================
create table if not exists enrichment_raw (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null unique references leads(id) on delete cascade,
  census       jsonb,
  nominatim    jsonb,
  hud_fmr      jsonb,
  permits      jsonb,
  fred         jsonb,
  news         jsonb,
  enriched_at  timestamptz not null default now()
);

-- ============================================================
-- Helpful view: fully joined lead data for a given project
-- Usage: select * from enriched_leads where project_id = '...';
-- ============================================================
create or replace view enriched_leads as
  select
    l.id,
    l.project_id,
    l.name,
    l.email,
    l.company,
    l.property_address,
    l.city,
    l.state,
    l.country,
    l.created_at,
    -- Score
    ls.total          as score,
    ls.tier,
    ls.demographics_score,
    ls.market_health_score,
    ls.walkability_score,
    ls.news_score,
    ls.geographic_score,
    ls.rationale      as score_rationale,
    -- Enrichment
    er.median_household_income,
    er.total_population,
    er.renter_percentage,
    er.avg_wage,
    er.poverty_rate,
    er.latitude,
    er.longitude,
    er.fmr_studio,
    er.fmr_1br,
    er.fmr_2br,
    er.nearby_multifamily_count,
    er.state_unemployment_rate,
    er.rental_vacancy_rate,
    er.housing_price_index,
    er.news_sentiment,
    er.news_articles,
    er.enrichment_errors,
    -- Outreach
    o.email_subject,
    o.email_body,
    o.sales_insights
  from leads l
  left join lead_scores ls       on ls.lead_id = l.id
  left join enrichment_results er on er.lead_id = l.id
  left join outreach o           on o.lead_id = l.id;
