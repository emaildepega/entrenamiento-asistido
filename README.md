# Entrenamiento Asistido

App personal de entrenamiento: subes tu plan y te dice **qué toca hoy**, con la
animación de cada ejercicio de gimnasio.

- **Hoy** — la sesión del día ya resuelta para la semana del bloque en que estás,
  con series, pesos, temporizador de descanso y de intervalos.
- **Animaciones** — cada ejercicio muestra las dos posiciones (inicial y final)
  en bucle, del catálogo público [free-exercise-db][db] (873 ejercicios,
  dominio público). Se cachean para funcionar sin cobertura.
- **La última vez** — junto a cada ejercicio, el peso y las repeticiones de la
  sesión anterior.
- **Progreso** — cumplimiento semanal, evolución de fuerza por ejercicio y horas
  de bici acumuladas.

[db]: https://github.com/yuhonas/free-exercise-db

## Arrancar en local

```bash
npm install
npm run build:catalog   # solo la primera vez, o para actualizar el catálogo
npm run dev
```

## Variables de entorno

Se copian de `.env.example` a `.env.local`. **Sin ellas la app funciona igual**,
guardando los datos en el propio navegador; en cuanto están, pasa sola a modo
cuenta con sincronización.

| Variable                 | De dónde sale                                     |
| ------------------------ | ------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → Data API            |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys (publishable) |

En Vercel hay que poner esas mismas dos.

## Supabase

```bash
supabase link --project-ref <ref>
supabase db push                                  # aplica supabase/migrations
supabase functions deploy parse-plan              # lectura de PDF con IA
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... # clave de console.anthropic.com
```

La clave de Anthropic solo vive en el servidor: el navegador nunca la ve.

## Estructura

```
src/
  lib/        tipos, cálculo del plan, catálogo, acceso a datos
  hooks/      plan activo, ajustes, wake lock
  components/ animación, temporizadores, selector de fecha, navegación
  pages/      Hoy, Semana, Progreso, Historial, Planes, Ajustes, Ejercicio
supabase/
  migrations/ esquema + RLS
  functions/  parse-plan (Deno)
scripts/
  build-catalog.mjs   genera public/catalogo-ejercicios.json
```

## Notas

- Las fechas se muestran siempre en `dd/mm/yy` y se eligen con calendario;
  no se usa `input type="date"` en ninguna pantalla.
- La pantalla se mantiene encendida mientras hay una sesión abierta.
- Los datos se pueden exportar e importar en JSON desde Ajustes.
