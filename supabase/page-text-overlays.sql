alter table public.pages
  add column if not exists text_overlays jsonb not null default '[]'::jsonb;

alter table public.pages
  drop constraint if exists pages_text_overlays_is_array;

alter table public.pages
  add constraint pages_text_overlays_is_array
  check (jsonb_typeof(text_overlays) = 'array');
