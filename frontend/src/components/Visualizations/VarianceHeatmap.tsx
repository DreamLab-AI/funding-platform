// =============================================================================
// Variance Heatmap Visualization Component
// =============================================================================

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useVarianceHeatmap, type VarianceDataPoint, type HitTestResult } from '../../wasm';

interface VarianceHeatmapProps {
  /** Variance data points */
  data: VarianceDataPoint[];
  /** Variance threshold for flagging (default: 10) */
  varianceThreshold?: number;
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Callback when a cell is hovered */
  onCellHover?: (cellData: HitTestResult['data']) => void;
  /** Callback when a cell is clicked */
  onCellClick?: (cellData: HitTestResult['data']) => void;
  /** Callback when flagged applications change */
  onFlaggedChange?: (flagged: VarianceDataPoint[]) => void;
}

/**
 * WASM-powered variance heatmap visualization
 * Shows score variance between assessors for each application
 */
export function VarianceHeatmap({
  data,
  varianceThreshold = 10,
  width = 800,
  height = 500,
  className = '',
  onCellHover,
  onCellClick,
  onFlaggedChange,
}: VarianceHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: HitTestResult['data'];
  } | null>(null);

  const {
    chart,
    loading,
    error,
    setData,
    setThreshold,
    handleMouseMove,
    handleScroll,
  } = useVarianceHeatmap(canvasRef, { width, height });

  // Update data when it changes
  useEffect(() => {
    if (chart && data.length > 0) {
      setData(data);
    }
  }, [chart, data, setData]);

  // Update threshold
  useEffect(() => {
    if (chart) {
      setThreshold(varianceThreshold);
    }
  }, [chart, varianceThreshold, setThreshold]);

  // Notify about flagged applications
  useEffect(() => {
    if (chart && onFlaggedChange) {
      const flagged = chart.get_flagged();
      onFlaggedChange(flagged as VarianceDataPoint[]);
    }
  }, [chart, data, varianceThreshold, onFlaggedChange]);

  // Handle mouse interactions
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const result = handleMouseMove(e);
    if (result?.hit && result.data) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          content: result.data,
        });
        onCellHover?.(result.data);
      }
    } else {
      setTooltip(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setTooltip(null);
  };

  const handleCanvasClick = () => {
    if (tooltip?.content) {
      onCellClick?.(tooltip.content);
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    handleScroll(e);
  };

  // Stats summary
  const stats = useMemo(() => {
    if (!chart) return null;
    return chart.get_stats();
  }, [chart, data]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <p className="text-red-500">Failed to load visualization: {error.message}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-crosshair"
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onClick={handleCanvasClick}
        onWheel={handleCanvasWheel}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none max-w-xs"
          style={{
            left: Math.min(tooltip.x + 10, width - 200),
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium">
            {(tooltip.content as Record<string, string>).reference}
          </div>
          <div className="text-gray-300">
            Assessor: {(tooltip.content as Record<string, string>).assessor}
          </div>
          {(tooltip.content as Record<string, number>).score !== undefined && (
            <div className="text-blue-300">
              Score: {(tooltip.content as Record<string, number>).score?.toFixed(1)}
            </div>
          )}
          <div className="text-gray-400 text-xs mt-1">
            Mean: {(tooltip.content as Record<string, number>).mean?.toFixed(2)} | Variance:{' '}
            {(tooltip.content as Record<string, number>).variance?.toFixed(2)}
          </div>
          {(tooltip.content as Record<string, boolean>).flagged && (
            <div className="text-red-400 text-xs mt-1">High variance flagged</div>
          )}
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
          <span>{stats.totalApplications} applications</span>
          <span>
            <span className={stats.flaggedCount > 0 ? 'text-red-500 font-medium' : ''}>
              {stats.flaggedCount} flagged
            </span>{' '}
            ({stats.flaggedPercentage.toFixed(1)}%)
          </span>
          <span>Threshold: {stats.varianceThreshold}</span>
        </div>
      )}

      {/* Scroll hint */}
      {data.length > 20 && (
        <div className="text-center text-xs text-gray-400 mt-1">
          Scroll to see more applications
        </div>
      )}
    </div>
  );
}

export default VarianceHeatmap;
