-- TravelDive Database Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor → New query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ═══ TOURS TABLE ═══
create table tours (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  
  -- Agent info
  agent_name text not null default 'Reiseberater',
  agent_company text default '',
  
  -- Customer info
  customer_name text not null,
  customer_email text,
  
  -- Trip basics
  destination text not null,
  destination_country text default '',
  date_from date,
  date_to date,
  nights integer default 7,
  departure_airport text default '',
  meal_plan text default 'All-Inclusive',
  
  -- Personalization
  preferences jsonb default '[]'::jsonb,
  personal_note text default '',
  
  -- Content (stored as JSONB arrays)
  hotels jsonb default '[]'::jsonb,
  pois jsonb default '[]'::jsonb,
  day_items jsonb default '[]'::jsonb,
  transfers jsonb default '[]'::jsonb,
  
  -- Weather data
  weather jsonb default '{}'::jsonb,
  
  -- Hero
  hero_video_url text default '',
  hero_title text default '',
  hero_subtitle text default '',
  
  -- Status
  status text default 'draft' check (status in ('draft', 'live')),
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══ TOUR EVENTS (Tracking) ═══
create table tour_events (
  id uuid primary key default uuid_generate_v4(),
  tour_id uuid references tours(id) on delete cascade,
  
  -- Event type: 'page_view', 'section_time', 'hotel_select', 'transfer_select', 'cta_click'
  event_type text not null,
  
  -- Flexible data payload
  data jsonb default '{}'::jsonb,
  
  -- Session identifier (generated client-side per visit)
  session_id text,
  
  created_at timestamptz default now()
);

-- ═══ INDEXES ═══
create index idx_tours_slug on tours(slug);
create index idx_tours_status on tours(status);
create index idx_events_tour on tour_events(tour_id);
create index idx_events_type on tour_events(event_type);
create index idx_events_session on tour_events(session_id);

-- ═══ AUTO-UPDATE updated_at ═══
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tours_updated_at
  before update on tours
  for each row execute function update_updated_at();

-- ═══ ROW LEVEL SECURITY ═══
-- Enable RLS
alter table tours enable row level security;
alter table tour_events enable row level security;

-- Public read access for live tours (customers need to see them)
create policy "Public can read live tours"
  on tours for select
  using (status = 'live');

-- Full access via service key (dashboard uses service key through Netlify Functions)
create policy "Service role full access tours"
  on tours for all
  using (true)
  with check (true);

-- Anyone can insert tracking events (customers track without auth)
create policy "Public can insert events"
  on tour_events for insert
  with check (true);

-- Read events via service key
create policy "Service role full access events"
  on tour_events for all
  using (true)
  with check (true);

-- ═══ VIEWS FOR ANALYTICS ═══
create or replace view tour_analytics as
select
  t.id as tour_id,
  t.slug,
  t.customer_name,
  t.destination,
  t.status,
  t.created_at,
  count(distinct case when e.event_type = 'page_view' then e.session_id end) as unique_views,
  count(case when e.event_type = 'page_view' then 1 end) as total_views,
  count(case when e.event_type = 'cta_click' then 1 end) as cta_clicks,
  max(case when e.event_type = 'hotel_select' then e.data->>'hotel_name' end) as last_hotel_viewed,
  max(case when e.event_type = 'transfer_select' then e.data->>'transfer_name' end) as transfer_choice
from tours t
left join tour_events e on e.tour_id = t.id
group by t.id, t.slug, t.customer_name, t.destination, t.status, t.created_at;

-- ═══ ENABLE REALTIME ═══
alter publication supabase_realtime add table tour_events;
