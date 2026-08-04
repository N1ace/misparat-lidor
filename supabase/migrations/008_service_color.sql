-- Service color for calendar identification
alter table services
  add column if not exists color text;

-- Seed missing colors from a fixed palette (cycle by sort_order)
with numbered as (
  select
    id,
    (row_number() over (order by sort_order, name) - 1) as idx
  from services
  where color is null or color = ''
),
palette as (
  select array[
    '#E28140',
    '#3E8E9E',
    '#2FA56A',
    '#E2A23A',
    '#D6453F',
    '#6B6660',
    '#CC6E30',
    '#A85724',
    '#E9AB78',
    '#4A4641'
  ]::text[] as colors
)
update services s
set color = p.colors[1 + (n.idx % array_length(p.colors, 1))]
from numbered n, palette p
where s.id = n.id;
