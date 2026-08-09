-- Esquema de Entrenamiento Asistido.
-- Todo cuelga de user_id y está protegido con RLS: cada usuario solo ve lo suyo.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ planes */
create table if not exists public.planes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  nombre       text not null,
  descripcion  text not null default '',
  semanas      int  not null default 4 check (semanas between 1 and 52),
  fecha_inicio date not null,
  activo       boolean not null default false,
  -- El plan se guarda como documento: siempre se lee entero.
  estructura   jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists planes_user_idx on public.planes (user_id, created_at desc);

/* ---------------------------------------------------------------- sesiones */
create table if not exists public.sesiones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_id      uuid not null references public.planes (id) on delete cascade,
  fecha        date not null,
  dia_key      text not null,
  semana       int  not null,
  estado       text not null default 'parcial'
                 check (estado in ('hecha', 'saltada', 'parcial')),
  duracion_min int,
  notas        text,
  created_at   timestamptz not null default now(),
  -- una sesión por día y plan
  unique (user_id, plan_id, fecha)
);

create index if not exists sesiones_user_fecha_idx
  on public.sesiones (user_id, fecha desc);

/* ------------------------------------------------------------------ series */
create table if not exists public.series (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  sesion_id        uuid not null references public.sesiones (id) on delete cascade,
  -- slug estable: permite seguir un ejercicio aunque cambie de plan
  ejercicio_slug   text not null,
  ejercicio_nombre text not null,
  serie            int  not null,
  reps             int,
  peso_kg          numeric(6, 2),
  hecha            boolean not null default false,
  unique (sesion_id, ejercicio_slug, serie)
);

create index if not exists series_ejercicio_idx
  on public.series (user_id, ejercicio_slug);

/* -------------------------------------------------------- media_ejercicios */
-- Correcciones manuales de la animación o el vídeo de un ejercicio.
create table if not exists public.media_ejercicios (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  ejercicio_slug text not null,
  catalogo_id    text,
  youtube_id     text,
  unique (user_id, ejercicio_slug)
);

/* --------------------------------------------------------------------- RLS */
alter table public.planes           enable row level security;
alter table public.sesiones         enable row level security;
alter table public.series           enable row level security;
alter table public.media_ejercicios enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['planes', 'sesiones', 'series', 'media_ejercicios']
  loop
    execute format(
      'drop policy if exists %I on public.%I', 'propietario_select_' || t, t);
    execute format(
      'create policy %I on public.%I for select using (user_id = auth.uid())',
      'propietario_select_' || t, t);

    execute format(
      'drop policy if exists %I on public.%I', 'propietario_insert_' || t, t);
    execute format(
      'create policy %I on public.%I for insert with check (user_id = auth.uid())',
      'propietario_insert_' || t, t);

    execute format(
      'drop policy if exists %I on public.%I', 'propietario_update_' || t, t);
    execute format(
      'create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())',
      'propietario_update_' || t, t);

    execute format(
      'drop policy if exists %I on public.%I', 'propietario_delete_' || t, t);
    execute format(
      'create policy %I on public.%I for delete using (user_id = auth.uid())',
      'propietario_delete_' || t, t);
  end loop;
end $$;

/* ----------------------------------------------------------------- storage */
-- Bucket privado para guardar el PDF original de cada plan importado.
insert into storage.buckets (id, name, public)
values ('planes-pdf', 'planes-pdf', false)
on conflict (id) do nothing;

drop policy if exists "pdf propietario" on storage.objects;
create policy "pdf propietario" on storage.objects
  for all
  using (
    bucket_id = 'planes-pdf'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'planes-pdf'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
