-- La duración del entreno se preguntaba al terminar, de memoria. Ahora se
-- cronometra: se guarda cuándo se pulsó "Empezar entrenamiento" y al cerrar la
-- sesión se calcula sola.
--
-- Va en la fila de la sesión, no en el navegador, para que el cronómetro siga
-- bien aunque cambies de móvil a ordenador en mitad del entreno.

alter table public.sesiones
  add column if not exists empezada_en timestamptz;
