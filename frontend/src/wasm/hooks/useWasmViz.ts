// =============================================================================
// React Hook for WASM Visualizations
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initWasm,
  isWasmLoaded,
  getWasmModule,
  isWasmSupported,
  type WasmVizModule,
} from '../loader';
import type {
  ChartConfig,
  ScoreDistributionChartInstance,
  ProgressTrackerChartInstance,
  VarianceHeatmapChartInstance,
  TimelineChartInstance,
  NetworkGraphChartInstance,
  HitTestResult,
  ScoreDataPoint,
  ProgressSegment,
  VarianceDataPoint,
  TimelineDataPoint,
  TimelineEvent,
  NetworkNode,
  NetworkEdge,
} from '../types';
import { createChartConfig } from '../types';

// -----------------------------------------------------------------------------
// WASM Loading Hook
// -----------------------------------------------------------------------------

interface UseWasmResult {
  module: WasmVizModule | null;
  loading: boolean;
  error: Error | null;
  supported: boolean;
}

/**
 * Hook to load and access the WASM module
 */
export function useWasm(): UseWasmResult {
  const [module, setModule] = useState<WasmVizModule | null>(
    isWasmLoaded() ? getWasmModule() : null
  );
  const [loading, setLoading] = useState(!isWasmLoaded());
  const [error, setError] = useState<Error | null>(null);
  const supported = isWasmSupported();

  useEffect(() => {
    if (!supported) {
      setError(new Error('WebAssembly is not supported in this browser'));
      setLoading(false);
      return;
    }

    if (isWasmLoaded()) {
      setModule(getWasmModule());
      setLoading(false);
      return;
    }

    let cancelled = false;

    initWasm()
      .then((mod) => {
        if (!cancelled) {
          setModule(mod);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  return { module, loading, error, supported };
}

// -----------------------------------------------------------------------------
// Chart Instance Management
// -----------------------------------------------------------------------------

type ChartInstance =
  | ScoreDistributionChartInstance
  | ProgressTrackerChartInstance
  | VarianceHeatmapChartInstance
  | TimelineChartInstance
  | NetworkGraphChartInstance;

/**
 * Generic hook for managing chart instances
 */
function useChartInstance<T extends ChartInstance>(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: Partial<ChartConfig>,
  createChart: (module: WasmVizModule, canvasId: string, config: ChartConfig) => T
): { chart: T | null; loading: boolean; error: Error | null } {
  const { module, loading: wasmLoading, error: wasmError } = useWasm();
  const [chart, setChart] = useState<T | null>(null);
  const chartRef = useRef<T | null>(null);
  const canvasIdRef = useRef<string>('');

  useEffect(() => {
    if (!module || !canvasRef.current) {
      return;
    }

    // Generate unique canvas ID if not set
    const canvas = canvasRef.current;
    if (!canvas.id) {
      canvas.id = `wasm-chart-${Math.random().toString(36).slice(2, 9)}`;
    }
    canvasIdRef.current = canvas.id;

    // Create chart config
    const fullConfig = createChartConfig({
      width: canvas.width || canvas.clientWidth,
      height: canvas.height || canvas.clientHeight,
      ...config,
    });

    // Create chart instance
    try {
      const chartInstance = createChart(module, canvas.id, fullConfig);
      chartRef.current = chartInstance;
      setChart(chartInstance);
    } catch (err) {
      console.error('[WASM] Failed to create chart:', err);
    }

    // Cleanup
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.free();
        } catch {
          // Ignore cleanup errors
        }
        chartRef.current = null;
        setChart(null);
      }
    };
  }, [module, canvasRef, config, createChart]);

  return { chart, loading: wasmLoading, error: wasmError };
}

// -----------------------------------------------------------------------------
// Score Distribution Chart Hook
// -----------------------------------------------------------------------------

interface UseScoreDistributionResult {
  chart: ScoreDistributionChartInstance | null;
  loading: boolean;
  error: Error | null;
  setData: (data: ScoreDataPoint[], binCount?: number) => void;
  render: () => void;
  handleMouseMove: (e: React.MouseEvent) => HitTestResult | null;
}

export function useScoreDistribution(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: Partial<ChartConfig> = {}
): UseScoreDistributionResult {
  const { chart, loading, error } = useChartInstance(
    canvasRef,
    config,
    (module, canvasId, cfg) => new module.ScoreDistributionChart(canvasId, cfg)
  );

  const setData = useCallback(
    (data: ScoreDataPoint[], binCount: number = 10) => {
      if (chart) {
        chart.set_data(data, binCount);
        chart.render();
      }
    },
    [chart]
  );

  const render = useCallback(() => {
    chart?.render();
  }, [chart]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): HitTestResult | null => {
      if (!chart || !canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return chart.on_mouse_move(x, y);
    },
    [chart, canvasRef]
  );

  return { chart, loading, error, setData, render, handleMouseMove };
}

// -----------------------------------------------------------------------------
// Progress Tracker Hook
// -----------------------------------------------------------------------------

interface UseProgressTrackerResult {
  chart: ProgressTrackerChartInstance | null;
  loading: boolean;
  error: Error | null;
  setData: (data: ProgressSegment[]) => void;
  setCenterLabel: (label: string) => void;
  render: () => void;
  animate: () => void;
  handleMouseMove: (e: React.MouseEvent) => HitTestResult | null;
}

export function useProgressTracker(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: Partial<ChartConfig> = {}
): UseProgressTrackerResult {
  const { chart, loading, error } = useChartInstance(
    canvasRef,
    config,
    (module, canvasId, cfg) => new module.ProgressTrackerChart(canvasId, cfg)
  );

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const setData = useCallback(
    (data: ProgressSegment[]) => {
      if (chart) {
        chart.set_data(data);
        chart.render();
      }
    },
    [chart]
  );

  const setCenterLabel = useCallback(
    (label: string) => {
      chart?.set_center_label(label);
    },
    [chart]
  );

  const render = useCallback(() => {
    chart?.render();
  }, [chart]);

  const animate = useCallback(() => {
    if (!chart) return;

    const step = (timestamp: number) => {
      const delta = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;

      const shouldContinue = chart.animate(delta);
      if (shouldContinue) {
        animationRef.current = requestAnimationFrame(step);
      }
    };

    animationRef.current = requestAnimationFrame(step);
  }, [chart]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): HitTestResult | null => {
      if (!chart || !canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return chart.on_mouse_move(x, y);
    },
    [chart, canvasRef]
  );

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return { chart, loading, error, setData, setCenterLabel, render, animate, handleMouseMove };
}

// -----------------------------------------------------------------------------
// Variance Heatmap Hook
// -----------------------------------------------------------------------------

interface UseVarianceHeatmapResult {
  chart: VarianceHeatmapChartInstance | null;
  loading: boolean;
  error: Error | null;
  setData: (data: VarianceDataPoint[]) => void;
  setThreshold: (threshold: number) => void;
  render: () => void;
  handleMouseMove: (e: React.MouseEvent) => HitTestResult | null;
  handleScroll: (e: React.WheelEvent) => void;
}

export function useVarianceHeatmap(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: Partial<ChartConfig> = {}
): UseVarianceHeatmapResult {
  const { chart, loading, error } = useChartInstance(
    canvasRef,
    config,
    (module, canvasId, cfg) => new module.VarianceHeatmapChart(canvasId, cfg)
  );

  const setData = useCallback(
    (data: VarianceDataPoint[]) => {
      if (chart) {
        chart.set_data(data);
        chart.render();
      }
    },
    [chart]
  );

  const setThreshold = useCallback(
    (threshold: number) => {
      if (chart) {
        chart.set_variance_threshold(threshold);
        chart.render();
      }
    },
    [chart]
  );

  const render = useCallback(() => {
    chart?.render();
  }, [chart]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): HitTestResult | null => {
      if (!chart || !canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return chart.on_mouse_move(x, y);
    },
    [chart, canvasRef]
  );

  const handleScroll = useCallback(
    (e: React.WheelEvent) => {
      if (chart) {
        e.preventDefault();
        chart.on_scroll(e.deltaY);
      }
    },
    [chart]
  );

  return { chart, loading, error, setData, setThreshold, render, handleMouseMove, handleScroll };
}

// -----------------------------------------------------------------------------
// Timeline Chart Hook
// -----------------------------------------------------------------------------

interface UseTimelineResult {
  chart: TimelineChartInstance | null;
  loading: boolean;
  error: Error | null;
  setData: (data: TimelineDataPoint[]) => void;
  setEvents: (events: TimelineEvent[]) => void;
  setShowCumulative: (show: boolean) => void;
  setGranularity: (granularity: 'hour' | 'day' | 'week') => void;
  render: () => void;
  handleMouseMove: (e: React.MouseEvent) => HitTestResult | null;
}

export function useTimeline(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: Partial<ChartConfig> = {}
): UseTimelineResult {
  const { chart, loading, error } = useChartInstance(
    canvasRef,
    config,
    (module, canvasId, cfg) => new module.TimelineChart(canvasId, cfg)
  );

  const setData = useCallback(
    (data: TimelineDataPoint[]) => {
      if (chart) {
        chart.set_data(data);
        chart.render();
      }
    },
    [chart]
  );

  const setEvents = useCallback(
    (events: TimelineEvent[]) => {
      if (chart) {
        chart.set_events(events);
        chart.render();
      }
    },
    [chart]
  );

  const setShowCumulative = useCallback(
    (show: boolean) => {
      if (chart) {
        chart.set_show_cumulative(show);
        chart.render();
      }
    },
    [chart]
  );

  const setGranularity = useCallback(
    (granularity: 'hour' | 'day' | 'week') => {
      if (chart) {
        chart.set_granularity(granularity);
        chart.render();
      }
    },
    [chart]
  );

  const render = useCallback(() => {
    chart?.render();
  }, [chart]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): HitTestResult | null => {
      if (!chart || !canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return chart.on_mouse_move(x, y);
    },
    [chart, canvasRef]
  );

  return {
    chart,
    loading,
    error,
    setData,
    setEvents,
    setShowCumulative,
    setGranularity,
    render,
    handleMouseMove,
  };
}

// -----------------------------------------------------------------------------
// Network Graph Hook
// -----------------------------------------------------------------------------

interface UseNetworkGraphResult {
  chart: NetworkGraphChartInstance | null;
  loading: boolean;
  error: Error | null;
  setData: (nodes: NetworkNode[], edges: NetworkEdge[]) => void;
  setPhysics: (repulsion: number, attraction: number, damping: number) => void;
  toggleSimulation: () => boolean;
  startSimulation: () => void;
  stopSimulation: () => void;
  render: () => void;
  resetView: () => void;
  fitToContent: () => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleMouseMove: (e: React.MouseEvent) => HitTestResult | null;
  handleClick: (e: React.MouseEvent) => string[];
  handleWheel: (e: React.WheelEvent) => void;
}

export function useNetworkGraph(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: Partial<ChartConfig> = {}
): UseNetworkGraphResult {
  const { chart, loading, error } = useChartInstance(
    canvasRef,
    config,
    (module, canvasId, cfg) => new module.NetworkGraphChart(canvasId, cfg)
  );

  const simulationRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const setData = useCallback(
    (nodes: NetworkNode[], edges: NetworkEdge[]) => {
      if (chart) {
        chart.set_data(nodes, edges);
        chart.render();
      }
    },
    [chart]
  );

  const setPhysics = useCallback(
    (repulsion: number, attraction: number, damping: number) => {
      chart?.set_physics(repulsion, attraction, damping);
    },
    [chart]
  );

  const startSimulation = useCallback(() => {
    if (!chart) return;

    const step = () => {
      const shouldContinue = chart.step_simulation();
      chart.render();
      if (shouldContinue) {
        simulationRef.current = requestAnimationFrame(step);
      }
    };

    simulationRef.current = requestAnimationFrame(step);
  }, [chart]);

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      cancelAnimationFrame(simulationRef.current);
      simulationRef.current = null;
    }
  }, []);

  const toggleSimulation = useCallback((): boolean => {
    if (!chart) return false;
    const running = chart.toggle_simulation();
    if (running) {
      startSimulation();
    } else {
      stopSimulation();
    }
    return running;
  }, [chart, startSimulation, stopSimulation]);

  const render = useCallback(() => {
    chart?.render();
  }, [chart]);

  const resetView = useCallback(() => {
    chart?.reset_view();
  }, [chart]);

  const fitToContent = useCallback(() => {
    chart?.fit_to_content();
  }, [chart]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!chart || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hitNode = chart.on_mouse_down(x, y);
      if (!hitNode) {
        // Start panning
        isDraggingRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [chart, canvasRef]
  );

  const handleMouseUp = useCallback(() => {
    chart?.on_mouse_up();
    isDraggingRef.current = false;
    lastPosRef.current = null;
  }, [chart]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): HitTestResult | null => {
      if (!chart || !canvasRef.current) return null;

      // Handle panning
      if (isDraggingRef.current && lastPosRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        chart.on_pan(dx, dy);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        return null;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return chart.on_mouse_move(x, y);
    },
    [chart, canvasRef]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent): string[] => {
      if (!chart || !canvasRef.current) return [];
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const result = chart.on_click(x, y, e.shiftKey || e.ctrlKey);
      return result.selected;
    },
    [chart, canvasRef]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!chart || !canvasRef.current) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      chart.on_zoom(e.deltaY, x, y);
    },
    [chart, canvasRef]
  );

  // Auto-start simulation when data is set
  useEffect(() => {
    if (chart) {
      startSimulation();
    }
    return () => {
      stopSimulation();
    };
  }, [chart, startSimulation, stopSimulation]);

  return {
    chart,
    loading,
    error,
    setData,
    setPhysics,
    toggleSimulation,
    startSimulation,
    stopSimulation,
    render,
    resetView,
    fitToContent,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleClick,
    handleWheel,
  };
}
