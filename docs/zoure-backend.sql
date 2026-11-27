create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  image text,
  venue text not null,
  starts_at timestamptz not null,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists event_attendees (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'going'
    check (status in ('going', 'cancelled')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  user_id uuid not null,
  party_size integer not null check (party_size between 1 and 20),
  booking_at timestamptz not null,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create or replace view trending_events as
select
  e.*,
  count(a.user_id) filter (where a.status = 'going')::integer as going
from events e
left join event_attendees a on a.event_id = e.id
group by e.id;
