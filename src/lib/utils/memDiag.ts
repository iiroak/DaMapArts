/**
 * Memory diagnostic utility for DaMapArts.
 *
 * Usage from browser DevTools console:
 *   window.__memDiag.snapshot()   — print current memory breakdown
 *   window.__memDiag.watch(3000)  — auto-print every 3s
 *   window.__memDiag.stop()       — stop watching
 *   window.__memDiag.heapInfo()   — print performance.memory stats (Chrome only)
 *   window.__memDiag.track(label, bytes) — manually register an allocation
 *   window.__memDiag.untrack(label)      — remove a tracked allocation
 *
 * Auto-instrumented sources are registered via registerSource() from components.
 */

type MemSource = () => { label: string; bytes: number; detail?: string };

const _sources: MemSource[] = [];
const _manual: Map<string, number> = new Map();
let _watchTimer: ReturnType<typeof setInterval> | null = null;

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Estimate memory of a JS object tree (shallow heuristic, NOT deep clone). */
function estimateObjectSize(obj: unknown, depth = 0): number {
  if (depth > 4) return 0;
  if (obj === null || obj === undefined) return 0;
  if (typeof obj === 'number') return 8;
  if (typeof obj === 'boolean') return 4;
  if (typeof obj === 'string') return (obj as string).length * 2 + 40;
  if (ArrayBuffer.isView(obj)) return (obj as ArrayBufferView).byteLength;
  if (obj instanceof ArrayBuffer) return obj.byteLength;
  if (obj instanceof ImageData) return obj.data.byteLength + 32;
  if (obj instanceof HTMLImageElement) {
    // Rough: decoded RGBA in memory
    return obj.naturalWidth * obj.naturalHeight * 4;
  }
  if (obj instanceof Map) {
    let s = 64;
    (obj as Map<unknown, unknown>).forEach((v, k) => {
      s += estimateObjectSize(k, depth + 1) + estimateObjectSize(v, depth + 1) + 48;
    });
    return s;
  }
  if (obj instanceof Set) {
    let s = 64;
    (obj as Set<unknown>).forEach((v) => {
      s += estimateObjectSize(v, depth + 1) + 32;
    });
    return s;
  }
  if (Array.isArray(obj)) {
    let s = 64 + obj.length * 8;
    if (depth < 3) {
      // Sample first 100 elements for large arrays
      const sample = Math.min(obj.length, 100);
      let sampleSize = 0;
      for (let i = 0; i < sample; i++) {
        sampleSize += estimateObjectSize(obj[i], depth + 1);
      }
      if (sample > 0) s += (sampleSize / sample) * obj.length;
    }
    return s;
  }
  if (typeof obj === 'object') {
    let s = 64;
    const keys = Object.keys(obj as Record<string, unknown>);
    for (const k of keys) {
      s += k.length * 2 + 48;
      s += estimateObjectSize((obj as Record<string, unknown>)[k], depth + 1);
    }
    return s;
  }
  return 8;
}

/** Register a memory source that will be sampled on each snapshot(). */
export function registerSource(source: MemSource): () => void {
  _sources.push(source);
  return () => {
    const idx = _sources.indexOf(source);
    if (idx >= 0) _sources.splice(idx, 1);
  };
}

/** Register a memory source from a getter (convenience wrapper). */
export function registerGetter(label: string, getter: () => unknown): () => void {
  return registerSource(() => {
    const val = getter();
    const bytes = estimateObjectSize(val);
    return { label, bytes };
  });
}

/** Take a snapshot and return the breakdown. */
function snapshot(): { entries: { label: string; bytes: number; formatted: string; detail?: string }[]; total: number } {
  const entries: { label: string; bytes: number; formatted: string; detail?: string }[] = [];

  for (const src of _sources) {
    try {
      const { label, bytes, detail } = src();
      entries.push({ label, bytes, formatted: formatBytes(bytes), detail });
    } catch (e) {
      entries.push({ label: '(error)', bytes: 0, formatted: '?', detail: String(e) });
    }
  }

  for (const [label, bytes] of _manual) {
    entries.push({ label: `[manual] ${label}`, bytes, formatted: formatBytes(bytes) });
  }

  // Sort descending
  entries.sort((a, b) => b.bytes - a.bytes);

  const total = entries.reduce((s, e) => s + e.bytes, 0);

  // Print table
  console.group(`%c🧠 DaMapArts Memory Snapshot — Total tracked: ${formatBytes(total)}`, 'font-size: 14px; font-weight: bold; color: #4fc3f7');
  console.table(entries.map((e) => ({
    Label: e.label,
    Size: e.formatted,
    Bytes: e.bytes,
    ...(e.detail ? { Detail: e.detail } : {}),
  })));
  console.groupEnd();

  return { entries, total };
}

function heapInfo() {
  const mem = (performance as any).memory;
  if (!mem) {
    console.warn('performance.memory not available (Chrome only, non-workers)');
    return null;
  }
  const info = {
    usedJSHeapSize: formatBytes(mem.usedJSHeapSize),
    totalJSHeapSize: formatBytes(mem.totalJSHeapSize),
    jsHeapSizeLimit: formatBytes(mem.jsHeapSizeLimit),
    usedPct: `${((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1)}%`,
  };
  console.table(info);
  return info;
}

function watch(intervalMs = 5000) {
  stop();
  console.log(`%c🔄 Memory watch started (every ${intervalMs}ms). Call window.__memDiag.stop() to end.`, 'color: #81c784');
  _watchTimer = setInterval(() => {
    snapshot();
    heapInfo();
  }, intervalMs);
}

function stop() {
  if (_watchTimer) {
    clearInterval(_watchTimer);
    _watchTimer = null;
    console.log('%c⏹ Memory watch stopped.', 'color: #e57373');
  }
}

function track(label: string, bytes: number) {
  _manual.set(label, bytes);
}

function untrack(label: string) {
  _manual.delete(label);
}

/** Install global diagnostic handle on window. */
export function installMemDiag() {
  if (typeof window === 'undefined') return;
  (window as any).__memDiag = {
    snapshot,
    heapInfo,
    watch,
    stop,
    track,
    untrack,
    sources: _sources,
    estimateObjectSize,
  };
  console.log(
    '%c🧠 DaMapArts Memory Diagnostics loaded. Use window.__memDiag.snapshot() to inspect.',
    'color: #4fc3f7; font-weight: bold',
  );
}

export { estimateObjectSize, formatBytes };
