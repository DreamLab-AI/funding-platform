// =============================================================================
// WASM Visualization Module - Public API
// =============================================================================

// Loader
export {
  initWasm,
  getWasmModule,
  isWasmLoaded,
  isWasmLoading,
  isWasmSupported,
  preloadWasm,
  benchmarkCanvasPerformance,
  type WasmVizModule,
} from './loader';

// Hooks
export {
  useWasm,
  useScoreDistribution,
  useProgressTracker,
  useVarianceHeatmap,
  useTimeline,
  useNetworkGraph,
} from './hooks/useWasmViz';

// Types
export type {
  ChartConfig,
  ColorTheme,
  Padding,
  ScoreDataPoint,
  ScoreDistributionStats,
  ProgressSegment,
  ProgressStats,
  VarianceDataPoint,
  VarianceStats,
  FlaggedApplication,
  TimelineDataPoint,
  TimelineEvent,
  TimelineStats,
  NodeType,
  NetworkNode,
  NetworkEdge,
  NetworkStats,
  HitTestResult,
  TooltipData,
} from './types';

export { DEFAULT_THEME, DEFAULT_PADDING, createChartConfig } from './types';
