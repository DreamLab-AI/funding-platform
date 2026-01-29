// =============================================================================
// Score Distribution Visualization Component
// =============================================================================

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useScoreDistribution, type ScoreDataPoint, type HitTestResult } from '../../wasm';

interface ScoreDistributionProps {
  /** Score data points */
  data: ScoreDataPoint[];
  /** Number of histogram bins (default: 10) */
  binCount?: number;
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Callback when a bin is hovered */
  onBinHover?: (binData: HitTestResult['data']) => void;
  /** Callback when a bin is clicked */
  onBinClick?: (binData: HitTestResult['data']) => void;
}

/**
 * WASM-powered score distribution histogram
 * Shows the distribution of assessment scores across applications
 */
export function ScoreDistribution({
  data,
  binCount = 10,
  width = 800,
  height = 400,
  className = '',
  onBinHover,
  onBinClick,
}: ScoreDistributionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: HitTestResult['data'];
  } | null>(null);

  const { chart, loading, error, setData, handleMouseMove } = useScoreDistribution(
    canvasRef,
    { width, height }
  );

  // Update data when it changes
  useEffect(() => {
    if (chart && data.length > 0) {
      setData(data, binCount);
    }
  }, [chart, data, binCount, setData]);

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
        onBinHover?.(result.data);
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
      onBinClick?.(tooltip.content);
    }
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
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium">
            Score Range: {(tooltip.content as Record<string, number>).min?.toFixed(0)}% -{' '}
            {(tooltip.content as Record<string, number>).max?.toFixed(0)}%
          </div>
          <div className="text-gray-300">
            Applications: {(tooltip.content as Record<string, number>).count}
          </div>
          {(tooltip.content as Record<string, number>).avgVariance > 0 && (
            <div className="text-gray-300">
              Avg Variance: {(tooltip.content as Record<string, number>).avgVariance?.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
          <span>{stats.totalApplications} total applications</span>
          <span>{stats.binCount} bins</span>
        </div>
      )}
    </div>
  );
}

export default ScoreDistribution;
