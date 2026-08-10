-- No todos los ejercicios se miden igual: la plancha se aguanta un tiempo, y
-- el peso ahí no significa nada. Las series pasan a poder guardar segundos.

alter table public.series
  add column if not exists segundos int check (segundos is null or segundos >= 0);

comment on column public.series.segundos is
  'Segundos aguantados. Se usa en ejercicios isométricos (planchas) y en los que se miden por tiempo (remo). En los de repeticiones va a null.';
