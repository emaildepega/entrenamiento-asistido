-- El aviso de fin de temporizador (pitido y vibración) se puede apagar, y esa
-- preferencia viaja con la cuenta como el resto de ajustes.

alter table public.ajustes
  add column if not exists sonido    boolean not null default true,
  add column if not exists vibracion boolean not null default true;
