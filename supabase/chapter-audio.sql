alter table public.chapters
  add column if not exists audio_object_key text,
  add column if not exists subtitles_srt text,
  add column if not exists subtitle_page_map jsonb;

alter table public.chapters
  drop constraint if exists chapters_audio_metadata_complete;

alter table public.chapters
  add constraint chapters_audio_metadata_complete check (
    (audio_object_key is null and subtitles_srt is null and subtitle_page_map is null)
    or (
      audio_object_key is not null
      and subtitles_srt is not null
      and subtitle_page_map is not null
      and jsonb_typeof(subtitle_page_map) = 'object'
    )
  );
