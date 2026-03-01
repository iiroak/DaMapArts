# Implementación de Dithering Memo (cliente web)

## 1) Objetivo

Se implementó un motor de dithering estilo "memoizado por columna" inspirado en `references/dither.pyx`, ejecutado 100% del lado cliente (main thread o Web Worker según backend), integrado a la UI actual.

La idea central no es decidir píxeles aislados, sino optimizar secuencias verticales completas por columna, con estados de altura y caché de subproblemas.

---

## 2) Dónde está implementado

- Motor memo nuevo: `src/lib/processor/memoMapmaker.ts`
- Integración en pipeline principal: `src/lib/processor/engine.ts`
- Parámetros en tipos de procesamiento: `src/lib/processor/types.ts`
- Estado global UI (defaults): `src/lib/stores/appState.svelte.ts`
- Pasaje UI → processor settings: `src/lib/components/MapPreview.svelte`
- Controles UI de memo: `src/lib/components/ProcessingSettings.svelte`
- Registro de métodos de dither: `src/lib/dither/index.ts`
- Compatibilidad en comparador: `src/lib/components/CompareModal.svelte`
- Cancelación real de procesos solapados: `src/lib/processor/backend.ts`

---

## 3) Métodos memo agregados en la UI

En el selector de dithering se agregaron:

- `memo-none` → Memo: Limited Staircase (sin dither)
- `memo-pattern-bayer4` → Memo con dithering por patrón
- `memo-diffuse-fs` → Memo con difusión tipo Floyd-Steinberg por columna

Cuando el método comienza por `memo-`, el `engine` deriva al motor `processMemoMapmaker(...)`.

---

## 4) Flujo completo de procesamiento

## 4.1 UI/Estado

1. Usuario cambia settings (map size, dither, parámetros memo, etc).
2. `MapPreview.svelte` observa esos cambios.
3. Se aplica debounce corto (120 ms) para evitar disparos innecesarios durante cambios rápidos.
4. Se aborta cualquier corrida anterior activa.
5. Se arma `ProcessorSettings` con parámetros estándar + memo.

## 4.2 Backend

`processAsync(...)` decide ejecución:

- GPU (si aplica)
- Worker (camino normal para este caso)
- Main thread

Con el cambio implementado:

- acepta `AbortSignal`
- si se aborta una corrida en worker, se corta la promesa
- se termina el worker ocupado y se reemplaza en el pool
- evita que procesos viejos sigan vivos consumiendo pool sin control

## 4.3 Engine

`engine.ts`:

1. Convierte RGBA a `rgbFloat`.
2. Aplica bilateral si está activo.
3. Si `ditherMethod` empieza por `memo-`, llama a `processMemoMapmaker(...)` y retorna.
4. Si no, sigue por el motor tradicional existente.

---

## 5) Parámetros memo disponibles

Incluidos en `ProcessorSettings` y UI:

- `memoMaxHeight`: cantidad de estados de altura permitidos
- `memoMaxDepth`: profundidad máxima recursiva por sección
- `memoMaxCache`: tope de entradas de memo antes de cortar/subdividir
- `memoQuantize`: cuantización del estado en difusión
- `memoUseLab`: distancia en LAB (si no, RGB euclídea)
- `memoClampToPalette`: clamping a gamut de paleta vs gamut RGB completo
- `memoUseReference`: referencia de staircase (penalización cero en pick ideal)
- `memoUseSeed`: subdivisiones deterministas
- `memoDiffusionFactor`: factor de propagación de error en modo difusión
- `memoChooser`: estrategia de segundo candidato en patrón
- `memoDiscriminator`: criterio de discriminación en patrón
- `memoPatternId`: matriz ordenada para modo patrón

Defaults iniciales en estado:

- maxHeight 4
- maxDepth 950
- maxCache 200000
- quantize 8
- useLab false
- clampToPalette false
- useReference true
- useSeed false
- diffusionFactor 1.0
- chooser 2
- discriminator 1
- pattern `bayer-4x4`

---

## 6) Estructura del motor memo

## 6.1 Agrupación de paleta por tono

El motor separa la paleta activa por `toneKey`:

- `dark`
- `normal`
- `light`
- `unobtainable`

Y conserva también una vista "all".

El tono candidato depende de transición de altura:

- misma altura → `normal`
- subir altura → `light`
- bajar altura → `dark`

Con fallback a `normal` o `all` si falta ese tono.

## 6.2 Estado por columna

Se procesa columna por columna (`x` fijo, recorriendo `y`).

Para cada columna:

1. se arma vector de colores base
2. se suma error lateral acumulado (en difusión)
3. se intenta resolver secciones por DP recursivo memoizado

Si una sección falla (cache/depth), se subdivide y reintenta.
Si el tramo es muy chico y sigue fallando, usa fallback greedy.

---

## 7) Distancia de color y picks

Funciones principales implementadas:

- `errDiff(c1, c2, useLab)`
- `findBest(...)`
- `findBestTwo(...)`
- `findBestPattern(...)`

`findBestPattern` replica lógica de:

- chooser (`closest / old / reflect`)
- discriminator (`old / new vectorial`)
- umbral por matriz ordenada (`memoPatternId`)

---

## 8) Modos memo

## 8.1 `memo-none`

DP por estado `(pos, prevHeight)`:

- en cada pixel prueba todas las alturas `0..maxHeight-1`
- elige paleta según transición de altura
- acumula error + continuación óptima
- memoiza por clave

Con `memoUseReference`, si el error coincide con el pick irrestricto, la penalización local se lleva a 0.

## 8.2 `memo-pattern-bayer4` (y otras matrices)

Igual esquema DP que `memo-none`, pero el pick local se hace con `findBestPattern(...)` usando:

- threshold de la matriz ordenada en `(x,y)`
- chooser/discriminator configurables

## 8.3 `memo-diffuse-fs`

DP con estado enriquecido:

- posición
- altura previa
- bloque previo aproximado
- cuantización opcional del color de estado

Error vertical intra-columna:

- se propaga como `7/16` a `lasterr` en la recursión

Error lateral inter-columna:

- se acumula para la columna siguiente con pesos:
  - NE: `3/16`
  - E: `5/16`
  - SE: `1/16`

Todo multiplicado por `memoDiffusionFactor`.

---

## 9) Transparencia y fondo

Antes de resolver memo:

- si transparencia activa y píxel bajo tolerancia:
  - `backgroundMode=0`: píxel marcado como clear (sin bloque)
  - otro modo: se rellena con color de fondo (`backgroundColour`) y entra al flujo memo

Al escribir salida:

- clear → RGBA 0 y `colourSetId='-1'`
- resto → color de bloque elegido

---

## 10) Materiales y salida

El motor memo devuelve mismo contrato que engine normal:

- `rgbaData`
- `pixelEntries`
- `maps` (conteo por sección 128×128)
- `totalPixels`
- `uniqueColors`

Esto mantiene compatibilidad con preview, materiales y export existente.

---

## 11) Cancelación de procesos solapados (problema 1x1→2x1→2x2)

Se implementaron dos capas:

1. **Debounce en UI** (`MapPreview`): evita arrancar trabajo pesado por cada micro-cambio.
2. **Abort real** (`backend.ts`): al llegar un request nuevo:
   - se aborta el anterior
   - si estaba en worker, se finaliza ese worker y se reemplaza en pool

Resultado: deja de "resolver dos veces" en paralelo cuando el usuario cambia rápido tamaños/parámetros.

---

## 12) Diferencias respecto al `dither.pyx` original

La implementación sigue el mismo enfoque general (memo por columna + subdivisión + variantes none/pattern/diffuse), pero en entorno web/TS hay simplificaciones prácticas:

- no se replica la ruta dual-layer histórica de ese script legacy
- la subdivisión y fallback priorizan robustez/fluidez en navegador
- la integración mantiene compatibilidad total con pipeline actual del proyecto

En síntesis: mismo paradigma de optimización memoizada, adaptado al runtime web client-side y al modelo de datos del proyecto actual.

---

## 13) Cómo validar rápido

1. Elegir método `memo-none`, `memo-pattern-bayer4` o `memo-diffuse-fs`.
2. Cambiar `mapSize` rápido (por ejemplo 1x1 → 2x1 → 2x2) y verificar que no queden trabajos viejos superpuestos.
3. Ajustar `memoMaxCache`, `memoMaxDepth`, `memoMaxHeight` y observar cambios de resultado/tiempo.
4. Comparar `memoUseLab` on/off en imágenes con gradientes y piel.

---

## 14) Resumen corto

Lo implementado agrega un motor memoizado por columna completamente integrado en UI + worker, con parámetros avanzados expuestos, retorno compatible con el pipeline, y cancelación real de procesos anteriores para evitar cómputos redundantes al cambiar settings rápidamente.
