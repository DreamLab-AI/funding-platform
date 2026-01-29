// =============================================================================
// TypeScript Interfaces for WASM Visualization Module
// =============================================================================

/**
 * Color theme configuration for visualizations
 */
export interface ColorTheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  background: string;
  text: string;
  grid: string;
  accent: string[];
}

/**
 * Padding configuration
 */
export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Common chart configuration
 */
export interface ChartConfig {
  width: number;
  height: number;
  padding?: Padding;
  theme?: Partial<ColorTheme>;
  animate?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  showLegend?: boolean;
  fontFamily?: string;
  fontSize?: number;
}

// -----------------------------------------------------------------------------
// Score Distribution Types
// -----------------------------------------------------------------------------

export interface ScoreDataPoint {
  applicationId: string;
  reference: string;
  score: number;
  maxScore: number;
  assessorCount: number;
  variance?: number;
}

export interface ScoreDistributionStats {
  totalApplications: number;
  binCount: number;
  maxBinCount: number;
  bins: Array<{
    range: string;
    count: number;
    avgVariance: number;
  }>;
}

// -----------------------------------------------------------------------------
// Progress Tracker Types
// -----------------------------------------------------------------------------

export interface ProgressSegment {
  id: string;
  label: string;
  completed: number;
  total: number;
  color?: string;
}

export interface ProgressStats {
  totalCompleted: number;
  totalItems: number;
  overallPercentage: number;
  segmentCount: number;
  segments: Array<{
    id: string;
    label: string;
    completed: number;
    total: number;
    percentage: number;
  }>;
}

// -----------------------------------------------------------------------------
// Variance Heatmap Types
// -----------------------------------------------------------------------------

export interface VarianceDataPoint {
  applicationId: string;
  reference: string;
  scores: number[];
  assessorNames: string[];
  variance: number;
  mean: number;
  flagged: boolean;
}

export interface VarianceStats {
  totalApplications: number;
  flaggedCount: number;
  flaggedPercentage: number;
  averageVariance: number;
  varianceThreshold: number;
  maxAssessors: number;
}

export interface FlaggedApplication {
  applicationId: string;
  reference: string;
  variance: number;
  mean: number;
  scores: number[];
}

// -----------------------------------------------------------------------------
// Timeline Types
// -----------------------------------------------------------------------------

export interface TimelineDataPoint {
  timestamp: number; // Unix timestamp in milliseconds
  count: number;
  cumulative: number;
  label?: string;
}

export interface TimelineEvent {
  timestamp: number;
  label: string;
  eventType: 'deadline' | 'open' | 'milestone';
}

export interface TimelineStats {
  totalSubmissions: number;
  dataPoints: number;
  peakCount: number;
  peakTimestamp?: number;
  timeRange: {
    start: number;
    end: number;
  };
  eventCount: number;
}

// -----------------------------------------------------------------------------
// Network Graph Types
// -----------------------------------------------------------------------------

export type NodeType = 'assessor' | 'application';

export interface NetworkNode {
  id: string;
  label: string;
  nodeType: NodeType;
  size?: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface NetworkEdge {
  source: string;
  target: string;
  weight?: number;
  color?: string;
  status?: 'pending' | 'in_progress' | 'completed';
}

export interface NetworkStats {
  nodeCount: number;
  edgeCount: number;
  assessorCount: number;
  applicationCount: number;
  selectedCount: number;
  zoom: number;
  simulationRunning: boolean;
}

// -----------------------------------------------------------------------------
// Hit Test & Tooltip Types
// -----------------------------------------------------------------------------

export interface HitTestResult {
  hit: boolean;
  elementId?: string;
  elementType: string;
  data?: Record<string, unknown>;
}

export interface TooltipData {
  x: number;
  y: number;
  title: string;
  values: Array<[string, string]>;
}

// -----------------------------------------------------------------------------
// WASM Module Interface
// -----------------------------------------------------------------------------

/**
 * WASM module exports interface
 * This represents the functions exported from the Rust WASM module
 */
export interface WasmVizModule {
  // Module lifecycle
  init: () => void;
  version: () => string;
  benchmark_canvas: (canvasId: string, iterations: number) => number;
  create_default_theme: () => ColorTheme;

  // Score Distribution Chart
  ScoreDistributionChart: {
    new(canvasId: string, config: ChartConfig): ScoreDistributionChartInstance;
  };

  // Progress Tracker Chart
  ProgressTrackerChart: {
    new(canvasId: string, config: ChartConfig): ProgressTrackerChartInstance;
  };

  // Variance Heatmap Chart
  VarianceHeatmapChart: {
    new(canvasId: string, config: ChartConfig): VarianceHeatmapChartInstance;
  };

  // Timeline Chart
  TimelineChart: {
    new(canvasId: string, config: ChartConfig): TimelineChartInstance;
  };

  // Network Graph Chart
  NetworkGraphChart: {
    new(canvasId: string, config: ChartConfig): NetworkGraphChartInstance;
  };

  // Simple progress helper
  render_simple_progress: (
    canvasId: string,
    value: number,
    maxValue: number,
    label: string,
    color: string
  ) => void;
}

// Chart instances
export interface ScoreDistributionChartInstance {
  set_data(data: ScoreDataPoint[], binCount: number): void;
  render(): void;
  on_mouse_move(x: number, y: number): HitTestResult;
  get_stats(): ScoreDistributionStats;
  free(): void;
}

export interface ProgressTrackerChartInstance {
  set_data(data: ProgressSegment[]): void;
  set_center_label(label: string): void;
  render(): void;
  animate(deltaMs: number): boolean;
  on_mouse_move(x: number, y: number): HitTestResult;
  get_stats(): ProgressStats;
  free(): void;
}

export interface VarianceHeatmapChartInstance {
  set_variance_threshold(threshold: number): void;
  set_data(data: VarianceDataPoint[]): void;
  render(): void;
  on_scroll(deltaY: number): void;
  on_mouse_move(x: number, y: number): HitTestResult;
  get_flagged(): FlaggedApplication[];
  get_stats(): VarianceStats;
  free(): void;
}

export interface TimelineChartInstance {
  set_show_cumulative(show: boolean): void;
  set_data(data: TimelineDataPoint[]): void;
  set_events(events: TimelineEvent[]): void;
  set_granularity(granularity: 'hour' | 'day' | 'week'): void;
  render(): void;
  on_mouse_move(x: number, y: number): HitTestResult;
  get_stats(): TimelineStats;
  free(): void;
}

export interface NetworkGraphChartInstance {
  set_data(nodes: NetworkNode[], edges: NetworkEdge[]): void;
  set_physics(repulsion: number, attraction: number, damping: number): void;
  toggle_simulation(): boolean;
  step_simulation(): boolean;
  render(): void;
  on_zoom(delta: number, centerX: number, centerY: number): void;
  on_pan(dx: number, dy: number): void;
  on_mouse_down(x: number, y: number): boolean;
  on_mouse_up(): void;
  on_mouse_move(x: number, y: number): HitTestResult;
  on_click(x: number, y: number, multiSelect: boolean): { selected: string[] };
  get_stats(): NetworkStats;
  reset_view(): void;
  fit_to_content(): void;
  free(): void;
}

// -----------------------------------------------------------------------------
// Default Configurations
// -----------------------------------------------------------------------------

export const DEFAULT_THEME: ColorTheme = {
  primary: '#3B82F6',
  secondary: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#FFFFFF',
  text: '#1F2937',
  grid: '#E5E7EB',
  accent: [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16',
  ],
};

export const DEFAULT_PADDING: Padding = {
  top: 40,
  right: 40,
  bottom: 60,
  left: 60,
};

export function createChartConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    width: 800,
    height: 400,
    padding: DEFAULT_PADDING,
    theme: DEFAULT_THEME,
    animate: true,
    showGrid: true,
    showLabels: true,
    showLegend: true,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,
    ...overrides,
  };
}
