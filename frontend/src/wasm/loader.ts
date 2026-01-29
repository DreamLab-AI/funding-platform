// =============================================================================
// WASM Module Loader with Lazy Loading
// =============================================================================

import type { WasmVizModule } from './types';

/**
 * WASM module singleton state
 */
interface WasmState {
  module: WasmVizModule | null;
  loading: Promise<WasmVizModule> | null;
  error: Error | null;
  initialized: boolean;
}

const state: WasmState = {
  module: null,
  loading: null,
  error: null,
  initialized: false,
};

/**
 * Dynamic import for the WASM module
 * This enables code splitting and lazy loading
 */
async function importWasmModule(): Promise<WasmVizModule> {
  // @ts-expect-error - WASM module is generated at build time
  const wasm = await import('./pkg/funding_viz');
  return wasm;
}

/**
 * Initialize the WASM module
 * Safe to call multiple times - will only initialize once
 */
export async function initWasm(): Promise<WasmVizModule> {
  // Already initialized
  if (state.initialized && state.module) {
    return state.module;
  }

  // Already loading
  if (state.loading) {
    return state.loading;
  }

  // Previous error
  if (state.error) {
    throw state.error;
  }

  // Start loading
  state.loading = (async () => {
    try {
      const module = await importWasmModule();

      // Initialize the module (sets up panic hook, etc.)
      module.init();

      state.module = module;
      state.initialized = true;
      state.loading = null;

      console.log(`[WASM] funding-viz module loaded (v${module.version()})`);

      return module;
    } catch (error) {
      state.error = error instanceof Error ? error : new Error(String(error));
      state.loading = null;
      console.error('[WASM] Failed to load module:', state.error);
      throw state.error;
    }
  })();

  return state.loading;
}

/**
 * Get the WASM module (throws if not initialized)
 */
export function getWasmModule(): WasmVizModule {
  if (!state.module) {
    throw new Error('WASM module not initialized. Call initWasm() first.');
  }
  return state.module;
}

/**
 * Check if WASM module is loaded
 */
export function isWasmLoaded(): boolean {
  return state.initialized && state.module !== null;
}

/**
 * Check if WASM module is currently loading
 */
export function isWasmLoading(): boolean {
  return state.loading !== null;
}

/**
 * Get loading error if any
 */
export function getWasmError(): Error | null {
  return state.error;
}

/**
 * Reset WASM state (mainly for testing)
 */
export function resetWasmState(): void {
  state.module = null;
  state.loading = null;
  state.error = null;
  state.initialized = false;
}

/**
 * Check WebAssembly support
 */
export function isWasmSupported(): boolean {
  try {
    if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
      // Try to instantiate a minimal WASM module to verify support
      const module = new WebAssembly.Module(
        Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
      );
      return module instanceof WebAssembly.Module;
    }
  } catch {
    // WebAssembly not supported
  }
  return false;
}

/**
 * Benchmark canvas rendering performance
 * Useful for determining if WASM visualizations are beneficial
 */
export async function benchmarkCanvasPerformance(
  canvasId: string,
  iterations: number = 10000
): Promise<{ timeMs: number; opsPerSecond: number }> {
  const module = await initWasm();
  const timeMs = module.benchmark_canvas(canvasId, iterations);
  const opsPerSecond = (iterations / timeMs) * 1000;

  return { timeMs, opsPerSecond };
}

/**
 * Preload WASM module in the background
 * Call this early in your app lifecycle
 */
export function preloadWasm(): void {
  if (!state.initialized && !state.loading && !state.error) {
    // Start loading but don't wait for it
    initWasm().catch((error) => {
      console.warn('[WASM] Preload failed:', error);
    });
  }
}

// Export types
export type { WasmVizModule };
