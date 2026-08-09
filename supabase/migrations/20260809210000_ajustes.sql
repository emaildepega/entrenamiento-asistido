-- Los ajustes viajan con la cuenta: si pones el tema claro en el ordenador,
-- el móvil lo respeta. Una fila por usuario.

create table if not exists public.ajustes (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  tema         text not null default 'oscuro' check (tema in ('oscuro', 'claro')),
  descanso_seg int  not null default 90 check (descanso_seg between 10 and 600),
  updated_at   timestamptz not null default now()
);

alter table public.ajustes enable row level security;

drop policy if exists propietario_select_ajustes on public.ajustes;
create policy propietario_select_ajustes on public.ajustes
  for select using (user_id = auth.uid());

drop policy if exists propietario_insert_ajustes on public.ajustes;
create policy propietario_insert_ajustes on public.ajustes
  for insert with check (user_id = auth.uid());

drop policy if exists propietario_update_ajustes on public.ajustes;
create policy propietario_update_ajustes on public.ajustes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists propietario_delete_ajustes on public.ajustes;
create policy propietario_delete_ajustes on public.ajustes
  for delete using (user_id = auth.uid());
