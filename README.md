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

## De dónde salen los planes

De tres maneras, y todas acaban en la misma pantalla de revisión editable:

1. **Subiendo un PDF.** Va entero a Claude (no se extrae el texto en el
   navegador: los planes traen tablas de progresión y el texto plano las
   destroza), que devuelve los días, los ejercicios y lo que toca cada semana.
2. **A mano**, en `/plan/nuevo`.
3. **Cargando el plan de ejemplo**, si solo quieres ver cómo funciona.

Al añadir un ejercicio puedes tirar de los que ya has usado en algún plan,
buscarlo en el catálogo, o escribir uno nuevo y dejar que la IA le busque
animación y vídeo. **Las dos cosas se verifican antes de darlas por buenas**:
el id contra el catálogo real y el vídeo contra la API de YouTube, así que lo
que no se pueda comprobar vuelve vacío en lugar de dejar un enlace roto.

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

La URL es la del proyecto (`https://<ref>.supabase.co`), **sin** `/rest/v1/`:
la librería añade esa parte y otras según lo que necesite.

En Vercel hay que poner esas mismas dos, y **no marcarlas como "Sensitive"**:
esa opción las vuelve de solo escritura y no llegan al paso de compilación, con
lo que la app se queda sin conexión y sin dar ningún error. No se pierde nada
por no marcarlas, porque los dos valores son públicos por diseño — acaban en el
código que descarga el navegador. Lo que protege los datos es RLS.

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
