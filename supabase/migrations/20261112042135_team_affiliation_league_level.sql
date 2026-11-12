-- Additive league level for the strength guide.
-- Safe to apply before the app deploy: both columns are nullable, rows that
-- omit them stay valid, and existing team ranks are not rewritten.
-- Leaves existing tables, columns, and rows in place, and does not change RLS policies.
-- Apply after 20261111193000_team_affiliation_standings.sql.

alter table public.team_affiliations
  add column league_level text,
  add column league_division smallint;

comment on column public.team_affiliations.league_level is
  'Guide league: prefecture (都・県リーグ), district (地域リーグ), or other (リーグなし・その他). Null until the team chooses. Does not rewrite the team rank.';

comment on column public.team_affiliations.league_division is
  'Division 1-4 when league_level is prefecture or district. Null for other or when unset.';

alter table public.team_affiliations
  add constraint team_affiliations_league_level check (
    (
      status = 'none'
      and league_level is null
      and league_division is null
    )
    or (
      status = 'affiliated'
      and (
        (league_level is null and league_division is null)
        or (league_level = 'other' and league_division is null)
        or (
          league_level in ('prefecture', 'district')
          and league_division between 1 and 4
        )
      )
    )
  );
