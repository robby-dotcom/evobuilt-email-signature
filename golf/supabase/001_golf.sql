-- Hollywood golf. Self-contained: no dependency on any other schema, so this
-- file replays as-is onto a fresh project when the golf data moves out.

create schema if not exists golf;

create table if not exists golf.courses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  location      text not null default '',
  pars          smallint[] not null,
  stroke_index  smallint[] not null,
  -- A tee's rating and slope turn a GA index into shots. Nullable: a course
  -- entered without a card still works on typed-in shots.
  tee           text,
  rating        numeric(4,1),
  slope         smallint check (slope is null or slope between 55 and 155),
  created_at    timestamptz not null default now(),
  constraint courses_18_pars  check (array_length(pars, 1) = 18),
  constraint courses_18_index check (array_length(stroke_index, 1) = 18)
);
create unique index if not exists courses_name_key on golf.courses (lower(name));

create table if not exists golf.rounds (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  series_code           text not null default '',
  course_id             uuid not null references golf.courses(id) on delete restrict,
  name                  text not null default '',
  played_on             date not null default current_date,
  stake_cents           integer not null default 500,
  carry_across_segments boolean not null default true,
  one_skin_per_team     boolean not null default true,
  handicap_allowance    smallint not null default 100,
  status                text not null default 'in_progress',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists rounds_series_idx on golf.rounds (series_code);

create table if not exists golf.round_players (
  round_id  uuid not null references golf.rounds(id) on delete cascade,
  slot      smallint not null check (slot between 0 and 3),
  name            text not null,
  -- handicap is the shots actually received and is what the engine uses;
  -- handicap_index records what the player typed, when the course is rated.
  handicap        smallint not null default 0,
  handicap_index  numeric(4,1),
  primary key (round_id, slot)
);

-- Only the facts. Skins, points, carryover and money are derived on read, so a
-- score corrected on the 17th tee recomputes the whole weekend correctly.
create table if not exists golf.hole_results (
  round_id         uuid not null references golf.rounds(id) on delete cascade,
  hole             smallint not null check (hole between 1 and 18),
  strokes          smallint[] not null,
  in_sand          boolean[] not null default '{false,false,false,false}',
  ctp_slot         smallint check (ctp_slot between 0 and 3),
  long_drive_slot  smallint check (long_drive_slot between 0 and 3),
  updated_at       timestamptz not null default now(),
  primary key (round_id, hole)
);

-- Every request arrives through the app server on the service role, which
-- bypasses RLS. Enabled with no policies so a stray anon key still reads nothing.
alter table golf.courses       enable row level security;
alter table golf.rounds        enable row level security;
alter table golf.round_players enable row level security;
alter table golf.hole_results  enable row level security;
