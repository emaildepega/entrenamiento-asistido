-- Conexión con Strava: las salidas en bici (y el remo) dejan de apuntarse a
-- mano y se traen de allí.
--
-- Los tokens se guardan aquí porque hay que renovarlos cada seis horas desde el
-- servidor. El navegador NO puede leerlos: se le quita el permiso sobre esas
-- dos columnas y solo se le dejan las que necesita para pintar la pantalla.

/* ------------------------------------------------------------- la conexión */
create table if not exists public.strava_cuentas (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  atleta_id     bigint not null,
  nombre        text not null default '',
  access_token  text not null,
  refresh_token text not null,
  -- cuándo caduca el access_token; se renueva solo antes de usarlo
  expira_en     timestamptz not null,
  scope         text not null default '',
  ultima_sync   timestamptz,
  created_at    timestamptz not null default now()
);

/* ------------------------------------------------------------ actividades  */
create table if not exists public.strava_actividades (
  user_id            uuid   not null references auth.users (id) on delete cascade,
  -- id que le da Strava; es estable, así que sirve de clave
  actividad_id       bigint not null,
  nombre             text   not null default '',
  -- "Ride", "VirtualRide", "Rowing"… tal cual lo manda Strava
  deporte            text   not null default '',
  empezada_en        timestamptz not null,
  -- la fecha del día en la zona del propio entreno, para casarla con la sesión
  fecha_local        date   not null,
  segundos_movimiento int   not null default 0,
  segundos_total      int   not null default 0,
  metros             numeric(10, 1) not null default 0,
  desnivel_m         numeric(8, 1)  not null default 0,
  vatios_medios      numeric(6, 1),
  pulso_medio        numeric(5, 1),
  en_rodillo         boolean not null default false,
  primary key (user_id, actividad_id)
);

create index if not exists strava_actividades_fecha_idx
  on public.strava_actividades (user_id, fecha_local desc);

/* --------------------------------------------------------------------- RLS */
alter table public.strava_cuentas     enable row level security;
alter table public.strava_actividades enable row level security;

-- La cuenta la escribe solo la función (con la clave de servicio, que se salta
-- RLS). Desde la app se puede mirar y desconectar, nada más.
drop policy if exists propietario_select_strava_cuentas on public.strava_cuentas;
create policy propietario_select_strava_cuentas on public.strava_cuentas
  for select using (user_id = auth.uid());

drop policy if exists propietario_delete_strava_cuentas on public.strava_cuentas;
create policy propietario_delete_strava_cuentas on public.strava_cuentas
  for delete using (user_id = auth.uid());

drop policy if exists propietario_select_strava_actividades on public.strava_actividades;
create policy propietario_select_strava_actividades on public.strava_actividades
  for select using (user_id = auth.uid());

drop policy if exists propietario_delete_strava_actividades on public.strava_actividades;
create policy propietario_delete_strava_actividades on public.strava_actividades
  for delete using (user_id = auth.uid());

/* ----------------------------------------------- los tokens no salen de aquí */
-- Aunque la fila sea suya, el navegador no tiene por qué ver el token: si
-- alguien se hiciera con la sesión, no se llevaría además el acceso a Strava.
revoke select on public.strava_cuentas from anon, authenticated;
grant select (user_id, atleta_id, nombre, scope, ultima_sync, created_at)
  on public.strava_cuentas to authenticated;
grant delete on public.strava_cuentas to authenticated;
