alter table public.pages
  add column if not exists text_overlays jsonb not null default '[]'::jsonb;

alter table public.pages
  drop constraint if exists pages_text_overlays_is_array;

alter table public.pages
  add constraint pages_text_overlays_is_array
  check (
    jsonb_typeof(text_overlays) = 'array'
    or (
      jsonb_typeof(text_overlays) = 'object'
      and jsonb_typeof(text_overlays -> 'overlays') = 'array'
      and (
        text_overlays -> 'interactiveMarkers' is null
        or jsonb_typeof(text_overlays -> 'interactiveMarkers') = 'array'
      )
    )
  );
