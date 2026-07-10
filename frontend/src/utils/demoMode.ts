/**
 * Demo-mode gate.
 *
 * The data hooks fall back to hard-coded sample records when an API call fails
 * so that the static GitHub Pages showcase renders without a live backend.
 * That behaviour must NOT be the default: against a real backend, a transient
 * API error should surface as an error, not be silently masked by fabricated
 * data. This flag gates every such fallback and defaults OFF.
 *
 * Enable it only for the demo build by setting `VITE_DEMO_MODE=true` at build
 * time (see the GitHub Pages workflow).
 */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === 'true';
