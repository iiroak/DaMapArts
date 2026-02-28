# MapArtCraft — Pipeline Completo de Procesamiento

Este documento describe **todo** lo que sucede desde que el usuario sube una imagen hasta que obtiene un archivo exportable para Minecraft.

---

## Diagrama de Flujo General

```
Imagen Original (JPG/PNG/WebP)
    │
    ▼
┌─────────────────────────┐
│  1. CARGA Y VALIDACIÓN  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  2. RECORTE Y ESCALADO  │  ← Crop Mode, Zoom, Offset
│     (Canvas 2D)         │    Resultado: exactamente W×H píxeles
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  3. BRILLO / CONTRASTE  │  ← CSS Filters via Canvas
│     / SATURACIÓN        │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  4. FILTRO BILATERAL    │  ← (Opcional) Suaviza áreas planas,
│     (Pre-Dither)        │    preserva bordes. Parámetros:
│                         │    σ_space, σ_color, radius
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  5. MÁSCARA DE BORDES   │  ← (Opcional) Sobel detecta linework.
│     (Edge Detection)    │    Genera mapa 0.0–1.0 por píxel.
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  6. CUANTIZACIÓN +      │  ← Paleta de Minecraft + Dithering
│     DITHERING           │    (Floyd-Steinberg, Blue Noise, etc.)
│                         │    Edge Mask → Sin dither en bordes
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  7. CONTEO DE           │  ← Por cada mapa 128×128:
│     MATERIALES          │    qué bloques y cuántos
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  8. EXPORTACIÓN         │  ← NBT Schematic / map.dat / PNG
└─────────────────────────┘
```

---

## Paso 1: Carga de Imagen

**Archivo:** `ImageUpload.svelte`

- Acepta: JPG, PNG, WebP, GIF
- Se convierte a `HTMLImageElement` y se almacena en `appState.sourceImage`
- No se modifica la imagen en este paso

---

## Paso 2: Recorte y Escalado

**Archivo:** `processor/crop.ts` → `getSourcePixels()` y `drawCroppedImage()`

La imagen se redimensiona exactamente a **`mapSizeX × 128` × `mapSizeZ × 128`** píxeles.

| Parámetro | Descripción |
|-----------|-------------|
| `mapSizeX` | Ancho en mapas (1-20). Cada mapa = 128 px |
| `mapSizeZ` | Alto en mapas (1-20) |
| `cropMode` | `off` (estirar), `center` (recortar), `manual` (con offset) |
| `cropZoom` | Factor de zoom (1.0 = sin zoom) |
| `cropOffsetX/Y` | Desplazamiento del recorte (0-100%) |

**Ejemplo**: 8×4 mapas = 1024×512 píxeles = 524,288 píxeles totales.

Cada píxel representa **exactamente un bloque de Minecraft** en el mapa final.

---

## Paso 3: Ajustes de Color (BCS)

**Aplicado via:** `ctx.filter` (CSS Canvas Filters)

| Control | Rango | Default | Efecto |
|---------|-------|---------|--------|
| Brillo | 0-200% | 100% | Aclara/oscurece toda la imagen |
| Contraste | 0-200% | 100% | Amplifica diferencias de luminosidad |
| Saturación | 0-200% | 100% | Intensidad del color (0% = gris) |

Se aplica antes de leer los píxeles del canvas, así el dithering trabaja sobre la imagen ya ajustada.

---

## Paso 4: Filtro Bilateral (Nuevo — Opcional)

**Archivo:** `processor/bilateralFilter.ts` → `applyBilateralFilter()`

Un desenfoque inteligente que **solo difumina áreas planas** (piel, cielo, ropa lisa) pero **respeta los bordes** (linework, ojos, cabello).

### ¿Cómo funciona?

Para cada píxel, examina una ventana de vecinos. Cada vecino contribuye al promedio con un peso que depende de:

$$W(i,j) = \exp\left(-\frac{\|p_i - p_j\|^2}{2\sigma_s^2}\right) \cdot \exp\left(-\frac{\|I(p_i) - I(p_j)\|^2}{2\sigma_c^2}\right)$$

- **Primer término** ($\sigma_s$): Peso espacial — vecinos lejanos pesan menos
- **Segundo término** ($\sigma_c$): Peso de color — vecinos de color diferente pesan menos (¡esto es lo que preserva los bordes!)

### Parámetros

| Parámetro | Rango | Default | Efecto |
|-----------|-------|---------|--------|
| σ Space | 1-10 | 3 | Radio del desenfoque. Mayor = más suave |
| σ Color | 5-100 | 25 | Tolerancia de color. Mayor = cruza bordes suaves |
| Radius | 1-7 | 3 | Tamaño del kernel (ventana = 2r+1) |

### ¿Por qué usarlo antes del dithering?

Cuando un área de piel tiene muchos tonos ligeramente diferentes, el algoritmo de dithering genera ruido ("estática") al intentar representar cada micro-variación. Al suavizar la piel primero, el dithering ve un color uniforme y produce bloques sólidos limpios.

---

## Paso 5: Máscara de Bordes (Nuevo — Opcional)

**Archivo:** `processor/edgeMask.ts` → `computeEdgeMask()`

Detecta dónde están los bordes de la imagen usando el **operador Sobel**, un algoritmo clásico de visión por computadora.

### ¿Cómo funciona?

1. Convierte la imagen a escala de grises (luminancia BT.601)
2. Aplica dos kernels de convolución 3×3:

$$G_x = \begin{bmatrix} -1 & 0 & 1 \\ -2 & 0 & 2 \\ -1 & 0 & 1 \end{bmatrix} \quad G_y = \begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ 1 & 2 & 1 \end{bmatrix}$$

3. Magnitud del gradiente: $M = \sqrt{G_x^2 + G_y^2}$
4. Normaliza contra el umbral para producir un valor 0.0 (plano) – 1.0 (borde)

### Integración con el Dithering

La máscara se usa durante la cuantización:

| Píxel es... | Acción |
|-------------|--------|
| **Borde** (mask ≥ 0.5) | Color más cercano directo, **sin dithering ni difusión de error** |
| **Área plana** (mask < 0.5) | Dithering normal (Floyd-Steinberg, Blue Noise, etc.) |

**Resultado**: Las líneas de los ojos, contornos del cabello y bordes de ropa quedan nítidos con colores sólidos, mientras las áreas planas se renderizan con dithering suave.

| Parámetro | Rango | Default | Efecto |
|-----------|-------|---------|--------|
| Threshold | 10-150 | 40 | Menor = más bordes detectados |

---

## Paso 6: Cuantización + Dithering

**Archivo:** `processor/engine.ts` → `processPixels()`

Este es el corazón del procesamiento. Cada píxel de la imagen se convierte al **bloque de Minecraft más cercano** de la paleta activa.

### 6.1 — Construcción de la Paleta

**Archivos:** `palette/colours.ts`, `data/coloursJSON.json`

Minecraft tiene ~60 "colour sets" (grupos de colores), cada uno con hasta 4 tonos:

| Tone Key | Multiplicador | Uso en Map Art |
|----------|--------------|----------------|
| `dark` | ×180/255 | Bloque en pendiente descendente |
| `normal` | ×220/255 | Bloque en superficie plana |
| `light` | ×255/255 | Bloque en pendiente ascendente |
| `unobtainable` | ×135/255 | Solo mapas .dat (no construible) |

La paleta final depende de:
- **Versión de Minecraft**: 1.12.2 – 1.20 (más versiones = más bloques)
- **Bloques seleccionados por el usuario** (puede desactivar bloques caros/raros)
- **Modo de Staircasing**: determina qué tonos están disponibles

**Total típico**: ~150-200 colores en la paleta.

Para cada color de paleta, se pre-calculan **6 representaciones** en diferentes espacios de color.

### 6.2 — Espacios de Color

**Archivo:** `palette/colorSpace.ts`

La distancia entre colores se puede medir en diferentes espacios:

| Espacio | Fórmula | Características |
|---------|---------|-----------------|
| **RGB** | $\sqrt{(r_1-r_2)^2 + (g_1-g_2)^2 + (b_1-b_2)^2}$ | Rápido, no-perceptual |
| **CIE L\*a\*b\*** | Distancia Euclídea en Lab | Perceptualmente uniforme (estándar industrial) |
| **Oklab** | Distancia Euclídea en Oklab | Mejor uniformidad perceptual que Lab (2020) |
| **Oklch** | L + Chroma + Hue angular | Cilíndrico Oklab, mejor para tonos similares |
| **YCbCr** | Luminancia + Crominancia BT.601 | Separa brillo de color |
| **HSL** | Hue (angular) + Saturation + Lightness | Intuitivo pero no-uniforme |

**Recomendación**: Oklab o Lab para la mayoría de imágenes.

### 6.3 — Métodos de Dithering

#### Error Diffusion (Escaneo línea por línea)

El algoritmo cuantiza cada píxel y **distribuye el error** de cuantización a los vecinos no procesados:

| Método | Kernel | Divisor | Calidad | Velocidad |
|--------|--------|---------|---------|-----------|
| Floyd-Steinberg | 2×2 | 16 | ★★★★ | ★★★★★ |
| MinAvgErr | 3×5 | 48 | ★★★★★ | ★★★★ |
| Burkes | 2×5 | 32 | ★★★★ | ★★★★ |
| Sierra-Lite | 2×3 | 4 | ★★★ | ★★★★★ |
| Sierra (Full) | 3×5 | 32 | ★★★★★ | ★★★ |
| Stucki | 3×5 | 42 | ★★★★★ | ★★★ |
| Jarvis-Judice-Ninke | 3×5 | 48 | ★★★★★ | ★★★ |
| Atkinson | 2×4 | 8 | ★★★ | ★★★★★ |
| Shiau-Fan | 2×3 | — | ★★★★ | ★★★★ |

**Ejemplo Floyd-Steinberg**: Al cuantizar un píxel, el error se distribuye:
```
        [*]  7/16
  3/16  5/16  1/16
```

#### Ostromoukhov (Variable Error Diffusion)

Algoritmo adaptativo que **cambia el kernel según la intensidad** del píxel. Recorrido en serpentina (izquierda→derecha, derecha→izquierda).

#### Ordered Dithering (Matrices de umbral)

No propaga error. Compara el píxel contra una matriz periódica para decidir entre los 2 colores más cercanos:

| Método | Tamaño | Característica |
|--------|--------|----------------|
| Bayer 2×2 | 2×2 | Patrón crosshatch visible |
| Bayer 4×4 | 4×4 | Patrón ordenado clásico |
| Bayer 8×8 | 8×8 | Patrón más suave |
| Ordered 3×3 | 3×3 | Similar a Bayer |
| Cluster Dot | – | Simula mediotono (halftone) |
| Knoll | – | Variante especial |
| **Blue Noise** | 64×64 | **Sin patrones visibles**, distribución estocástica |

#### Curve Dithering

| Método | Descripción |
|--------|-------------|
| **Riemersma (Hilbert)** | Recorre la imagen en curva fractal de Hilbert, distribuyendo error a lo largo de la curva. Produce resultados orgánicos sin artefactos direccionales. |

### 6.4 — Ningún Dithering (mode: `none`)

Cuantización directa al color más cercano. Cada píxel → bloque de paleta más similar. Sin difusión de error. Produce bloques sólidos de color pero pierde gradientes sutiles.

---

## Paso 7: Conteo de Materiales

**Calculado en:** `engine.ts` durante el loop de cuantización

Por cada sección de mapa (128×128 px), se cuenta cuántos bloques de cada tipo se necesitan. Esto alimenta:

- La lista de materiales ("necesitas X bloques de piedra, Y de arena...")
- El indicador de bloques de soporte (para staircasing 3D)

---

## Paso 8: Exportación

### Formatos Disponibles

| Formato | Archivo | Uso |
|---------|---------|-----|
| **Schematic (NBT)** | `.nbt` | WorldEdit / Litematica. Incluye altura 3D para staircasing |
| **Map.dat** | `.dat` | Archivos de mapa de Minecraft directos |
| **PNG** | `.png` | Vista previa de la imagen resultante |

**Archivos:** `export/nbt.ts`, `export/schematic.ts`, `export/mapdat.ts`, `export/download.ts`

### Opciones de Exportación

- **NBT Joined**: Toda la imagen en un solo schematic
- **NBT Split**: Un schematic por cada mapa 128×128
- **Map.dat Split**: Archivos .dat individuales
- **Map.dat Zip**: Todos los .dat en un ZIP

---

## Modos de Procesamiento

**Archivo:** `processor/backend.ts` → `processAsync()`

| Modo | Descripción | Métodos Soportados |
|------|-------------|-------------------|
| **Auto** | GPU para ordered/blue-noise, Worker para el resto | Todos |
| **GPU (WebGL 2)** | Shader GLSL que hace cuantización + dither en un solo pass | Solo ordered + blue noise |
| **Worker (CPU)** | Web Worker off-thread | Todos |
| **Main Thread** | Bloquea la UI (legacy) | Todos |

**Nota**: Si Edge-Masked Dithering está activo, fuerza CPU (Worker/Main) porque el GPU shader no puede hacer decisiones per-píxel basadas en la máscara de bordes.

---

## Versiones de Minecraft Soportadas

| Versión | NBT Version | Bloques Añadidos |
|---------|-------------|-----------------|
| 1.12.2 | 1343 | Base (concreto, terracota, lana) |
| 1.13.2 | 1631 | Corales muertos |
| 1.14.4 | 1976 | — |
| 1.15.2 | 2230 | Panal de abejas |
| 1.16.5 | 2586 | Blackstone, Crimson/Warped |
| 1.17.1 | 2730 | Deepslate, Cobre, Dripstone, Moss |
| 1.18.2 | 2975 | Mud, Mangrove |
| 1.19 | 3105 | — |
| 1.20 | 3463 | Cherry, Bamboo, Tuff variants |

---

## Modos de Staircasing (3D)

El staircasing permite usar **hasta 4 tonos por bloque** en lugar de 1, creando pendientes que Minecraft interpreta como diferentes luminosidades en el mapa:

| Modo | Tonos | Resultado |
|------|-------|-----------|
| **Off** | 1 (normal) | Plano. Solo ~60 colores |
| **Classic** | 3 (dark, normal, light) | ~180 colores. Sube y baja |
| **Valley** | 3 (dark, normal, light) | ~180 colores. Solo baja |
| **Full Dark** | 1 (dark) | Solo tonos oscuros |
| **Full Light** | 1 (light) | Solo tonos claros |

---

## Resumen de Archivos Clave

| Archivo | Responsabilidad |
|---------|----------------|
| `processor/crop.ts` | Recorte y escalado de imagen |
| `processor/bilateralFilter.ts` | Filtro bilateral (pre-dither) |
| `processor/edgeMask.ts` | Detección de bordes Sobel |
| `processor/engine.ts` | Motor principal: cuantización + dithering |
| `processor/backend.ts` | Orquestador GPU/Worker/Main |
| `processor/worker.ts` | Web Worker para CPU off-thread |
| `processor/gpu/WebGLProcessor.ts` | Shader WebGL 2 |
| `processor/gpu/shaders.ts` | GLSL vertex + fragment shaders |
| `palette/colours.ts` | Construcción de paleta |
| `palette/colorSpace.ts` | Conversiones RGB→Lab/Oklab/etc |
| `palette/findClosest.ts` | Búsqueda de color más cercano |
| `dither/index.ts` | Kernels de error diffusion |
| `dither/ordered.ts` | Matrices Bayer/ordered |
| `dither/blueNoise.ts` | Textura blue noise 64×64 |
| `dither/ostromoukhov.ts` | Dither variable Ostromoukhov |
| `dither/riemersma.ts` | Curva Hilbert + Riemersma |
| `export/nbt.ts` | Escritor/lector NBT binario |
| `export/schematic.ts` | Constructor de schematics |
| `export/mapdat.ts` | Constructor de map.dat |
| `stores/appState.svelte.ts` | Estado global (Svelte 5 runes) |
