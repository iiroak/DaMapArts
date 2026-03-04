# DaMapArts — Pending Tasks

## Bug Fixes

### Flat Mapart Schematic Dimensions (filler = air)
- **File:** `src/lib/export/schematic.ts`
- **Issue:** When the filler/support block is "air" and staircasing is OFF (flat), the exported schematic is 129×2×128 instead of 128×1×128.
- **Root Cause:** The noobline scaffold block is always placed at Z=0 regardless of whether the support block is air. In OFF mode, `currentHeight = 2` adds unnecessary Y height.
- **Expected:** When filler block is air, skip the noobline scaffold block entirely and set `currentHeight = 1` for flat mode, producing a 128×1×128 schematic.
- **Lines:** `schematic.ts` L244 (`currentHeight = 2`), L261 (noobline push always executes).

---

## Feature Requests

### Advanced Filler Block Mode: "Step" (anti-airplace)
- **File:** `src/lib/export/schematic.ts`, `src/lib/data/whereSupportBlocksModes.json`
- **Description:** Add a new support block placement mode "Step" — place filler blocks only when a block would otherwise be floating in air (no solid block directly below it). This prevents airplace requirements during survival building without placing filler under every single block.
- **Current modes already implemented:**
  - `NONE` (0): No support blocks at all
  - `IMPORTANT` (1): Only under blocks that physically need support (carpets, pressure plates, etc.) — equivalent to "Fragile"
  - `ALL_OPTIMIZED` (2): Under all blocks, optimized placement — equivalent to "All"
  - `ALL_DOUBLE_OPTIMIZED` (3): Under all blocks, double layer
  - `WATER` (4): Glass around floating water pillars — equivalent to "Water"
- **What's missing:** A mode that checks if the block below is air/empty and only then places a filler block. This is between IMPORTANT (only mandatory) and ALL_OPTIMIZED (everywhere).
- **Implementation:** Add `STEP` (uniqueId 5) to `whereSupportBlocksModes.json`, add case to `addSupportBlocks()` in `schematic.ts`, add locale keys.

### Custom Colour Sets via RGB
- **Description:** Allow users to create entirely new colour sets (not just add blocks to existing ones) by specifying custom RGB values. Currently, colour sets are hardcoded in `coloursJSON.json`.
- **Current state:** Custom BLOCKS can be assigned to existing colour sets, but new colour sets cannot be created dynamically.
- **Implementation:** Would need a way to inject custom colour set entries into coloursJSON at runtime, with user-provided RGB base color, `mapdatId`, and tone multipliers.

### Real Transparency Support (blending)
- **Description:** Current transparency support (`transparencyEnabled` + `transparencyTolerance`) only skips fully transparent pixels. True transparency would blend semi-transparent pixels with the background colour before palette matching.
- **Current state:** Binary skip (alpha < tolerance → skip). No alpha blending.
- **File:** Transparency logic in processor/palette code.

### Void Shadow / Color Suppression
- **Description:** Advanced staircasing option for "void shadow" — color suppression techniques for escalonado builds. Includes:
  - Double layer support (additional filler blocks in staircase builds)
  - Plaid pattern filler
  - Paired block placement
  - Update direction control (tick direction for water/sand blocks)
- **Current state:** Not implemented. No concept of void shadow or suppression in the codebase.
- **Complexity:** High — requires changes to `schematic.ts` column layout, new options in AppState, and new UI controls.

### Shareable Configs via URL/Link
- **Description:** Allow sharing complete profiles (not just block selection) via a URL link or encoded string, similar to how block presets have Base64 share codes. Currently, profiles can only be shared by exporting/importing JSON files.
- **Current state:** Block selection has Base64 share codes. Full profiles only have JSON file import/export.
- **Implementation:** Encode profile data to Base64 → generate shareable URL with query parameter → decode on page load.

### Staircase Height Limit Control
- **Description:** Explicit "max staircase height" control to limit how tall staircases can get. Useful for survival builds where extreme height differences make building impractical. Integration idea from external tools like jkascpkmc's staircase limiter.
- **Current state:** MEMO has `maxHeight`/`maxDepth`/`maxCache`/`stateBits` parameters but these control the optimization algorithm, not the physical height limit of the exported schematic.
- **Implementation:** Add a `maxStaircaseHeight` option that clamps column height differences during export in `schematic.ts`.

### Interactive Map Preview — Block Identification (click-to-identify)
- **Description:** Clicking on a pixel in the map preview should show exactly which Minecraft block is at that position, including its colour set, tone, coordinates (map X/Z), and block name.
- **Current state:** MapPreview shows the rendered image but has no click interaction for block info.
- **Implementation:** Add click handler to MapPreview canvas, compute map coords from click position, look up the pixel in `resultPixelIndices`/`resultPalette`, and show a tooltip/popover with block details.
- **Source:** Suggestion from thuleve.

### Pixel-by-Pixel Manual Editing
- **Description:** Allow users to manually edit the processed map art pixel by pixel directly from the preview. Select a block/colour from the palette and paint individual pixels. Useful for fine-tuning specific areas without reprocessing.
- **Current state:** No editing capability — the preview is read-only.
- **Implementation:** Add a draw/edit mode to MapPreview with palette picker. Modified pixels stored as overrides on top of processed result. Need to update export to respect manual edits.
- **Source:** Suggestion from thuleve.

### Map Art Editor (general purpose)
- **Description:** A full map art editing mode where users can:
  - Paint/draw directly on the map canvas with palette blocks
  - Use tools like brush, fill, line, rectangle
  - Undo/redo history
  - Import an existing image and then manually refine the result
  - Create map art from scratch without an image source
- **Current state:** DaMapArts is image-to-mapart only, no freeform drawing.
- **Complexity:** High — requires a full canvas editor, palette UI, tool controls, and undo system. Could be a separate tab/mode.

### Material Clustering (based on cluster_mats.py by JeeJ_LEL)
- **Description:** When building a map art material by material, it's hard to know which materials to carry together. This feature would analyze the schematic and group materials based on spatial proximity — materials that often appear next to each other get grouped so you can build efficiently without traversing the whole map for each material.
- **Origin:** External Python tool `cluster_mats.py` by JeeJ_LEL (July 2025). Uses numpy, scikit-learn, and NBT packages. Groups materials via clustering based on neighbor frequency.
- **Parameters to port:**
  - `numClusters`: number of material groups to create
  - `radius` / `verticalRadius`: search radius for neighbor detection
  - `selfLinkWeight`: controls how much a color's self-adjacency influences grouping (forces single-color clusters to mix with neighbors)
- **Current state:** Not implemented. Materials panel only shows block counts/stacks, no spatial analysis.
- **Implementation:** Could run in a Web Worker on the NBT block data after export. Show grouped materials in the Materials panel with suggested build order. Would need to port the clustering algorithm to JS/TS (replace scikit-learn with a lightweight k-means or spectral clustering).
- **Complexity:** Medium — the algorithm itself is straightforward but needs efficient neighbor scanning for large schematics.

---

## Optimization

### Memo Dithering Algorithm — Performance Overhaul
- **File:** `src/lib/processor/memoMapmaker.ts`
- **Analysis:** `references/MEMO_ANALYSIS.md`
- **Issues identified (in priority order):**
  1. **Array spread O(n²):** `[pick.entry, ...cont.entries]` copies the entire result array at every recursion level. For a 128-row column: ~8,256 array copies per successful path, ~30K-50K total per column. Massive GC pressure.
  2. **`findBest` called redundantly:** Same pixel evaluated 3-4× per recursion node (once per tone sub-palette). Could be pre-computed once per pixel position since it only depends on the pixel color, not `prevHeight`.
  3. **String keys for memo Map:** `"${pos}|${prevHeight}|..."` generates millions of temporary strings. Numeric keys would use V8's native integer hashing.
  4. **New Map per column:** Each of 3200 columns creates a Map with up to 200K entries, then GC reclaims it. Megabytes per Map.
  5. **Diffuse mode state explosion:** Key has 4 dimensions (`pos|prevHeight|lastBlock|quant`). Two-phase approach (solve without diffusion first, apply error post-hoc) could be ~10× faster.
- **Proposed solutions (from MEMO_ANALYSIS.md):**
  - Pre-allocate arrays, write in-place instead of spread (est. -30-50%)
  - Pre-compute `findBest` per pixel outside recursion (est. -25-40%)
  - Use numeric keys instead of string templates (est. -10-15%)
  - Verify/ensure Worker dispatch for UI responsiveness
  - Two-phase approach for diffuse mode (est. ~10× for diffuse)
- **Combined estimated improvement:** ~50-70% reduction without changing algorithm results.

---

## Review / Audit

### Review Mapartcraft Forks for Missing Fixes
- **Sources:** `references/mapartcraft-main-new/` (mike2b2t fork), `references/mapartcraft-master/` (rebane original), `references/PNG-to-NBT-main/`
- **Key differences found between master → main-new:**
  1. **Noobline transparency fix:** If the block after noobline is transparent (`colourSetId === alphaColorIdx`), skip the noobline scaffold — avoids unnecessary blocks in transparent areas.
  2. **Air column cleanup in NBT:** Post-process that finds all air blocks in the palette and sets entire columns at those X/Z coords to air. Ugly hack but fixes empty columns.
  3. **Alpha channel support:** `exactRGBToColourSetIdAndTone()` checks `pixelRGB[3]` (alpha) — returns transparent for alpha=0. Master version ignores alpha entirely.
  4. **Per-tone disabling (disabledTones):** Users can disable individual tones (dark/normal/light) per colour set. Each block shows tone swatch buttons that toggle.
  5. **Dithering propagation per RGB channel:** Three sliders (red/green/blue) to control how much error diffusion applies to each channel individually.
  6. **ColourMethods system:** Replaced single `betterColour` boolean with a dropdown: MapartCraft Default, Euclidean, CIE76 D50, CIE76 D65, CIEDE2000 D50, CIEDE2000 D65, HCT.
  7. **New dither methods:** Floyd-Steinberg /20 /24, Atkinson /6 /10 /12, Fan, Shiau-Fan, Shiau-Fan 2, Sierra full, Sierra Two-row, Bayer 3×3, Bayer 8×8, Ordered 3×3, Cluster Dot 4×4, Halftone 8×8, Void-and-cluster 14×14.
  8. **New locale support:** Greek (el), Turkish (tr).
  9. **Worker builder pattern:** Uses `WorkerBuilder` class with Blob URLs instead of `.jsworker` file extension.
  10. **UPWARDS_ONLY / REVERSE_UPWARDS_ONLY in NBT:** Added these staircase modes to the NBT export `switch` cases (plateau calculation). Master only had CLASSIC+VALLEY.
- **What DaMapArts already has (no action needed):**
  - ✅ All colour methods (CIE76, CIEDE2000, HCT, Oklab, Oklch — more than the fork)
  - ✅ Per-channel dithering propagation (Red/Green/Blue sliders)
  - ✅ Most dither methods (+ Riemersma, Ostromoukhov, Blue Noise, Knoll — more than the fork)
  - ✅ Supported versions up to 1.21.5
  - ✅ UPWARDS_ONLY / REVERSE_UPWARDS_ONLY exist in mapModes.json
- **Items to verify/port:**
  - ❓ Noobline transparency fix (skip scaffold when first block is transparent)
  - ❓ Air column cleanup in NBT post-process
  - ❓ Alpha channel in `exactRGBToColourSetIdAndTone()` 
  - ❓ Per-tone disabling UI (disabledTones per colour set)
  - ❓ UPWARDS_ONLY / REVERSE_UPWARDS_ONLY in schematic.ts export logic (StaircaseModes only has OFF/CLASSIC/VALLEY/FULL_DARK/FULL_LIGHT — missing these two)
  - ❓ Missing dither variants: Shiau-Fan, Shiau-Fan 2, Cluster Dot 4×4 (DaMapArts has 8×8 but not 4×4)
- **PNG-to-NBT features of interest:**
  - Step support mode (add filler only under blocks higher than N/S neighbor)
  - Fragile block detection (separate data file)
  - `persistent=true` auto-added to leaf blocks in NBT
  - Water depth checkerboard optimization
  - Build modes: cancer, suppress_rowsplit, suppress_plaid_ns/ew, suppress_pairs_ew, suppress_2layer_ew

---

## Notes

- Staircase modes `UPWARDS_ONLY` / `REVERSE_UPWARDS_ONLY` correspond to "northline" / "southline" concepts (already implemented).
- `VALLEY` mode already implemented (no separate "valley-compressed" variant exists).
- Water shading is implemented in `schematic.ts` via `getWaterDepth()` and water column handling.
