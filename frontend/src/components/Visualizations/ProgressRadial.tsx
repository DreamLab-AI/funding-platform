// =============================================================================
// Radial Progress Visualization Component
// =============================================================================

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useProgressTracker, type ProgressSegment, type HitTestResult } from '../../wasm';

interface ProgressRadialProps {
  /** Progress segments data */
  segments: ProgressSegment[];
  /** Center label text */
  centerLabel?: string;
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
  /** Enable animation */
  animate?: boolean;
  /** CSS class name */
  className?: string;
  /** Callback when a segment is hovered */
  onSegmentHover?: (segmentData: HitTestResult['data']) => void;
  /** Callback when a segment is clicked */
  onSegmentClick?: (segmentData: HitTestResult['data']) => void;
}

/**
 * WASM-powered radial progress visualization
 * Shows assessment completion rates as a donut chart
 */
export function ProgressRadial({
  segments,
  centerLabel = 'Progress',
  width = 400,
  height = 400,
  animate = true,
  className = '',
  onSegmentHover,
  onSegmentClick,
}: ProgressRadialProps) {
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
    setCenterLabel,
    animate: runAnimation,
    handleMouseMove,
  } = useProgressTracker(canvasRef, { width, height, animate });

  // Update data when it changes
  useEffect(() => {
    if (chart && segments.length > 0) {
      setData(segments);
      if (animate) {
        runAnimation();
      }
    }
  }, [chart, segments, animate, setData, runAnimation]);

  // Update center label
  useEffect(() => {
    if (chart) {
      setCenterLabel(centerLabel);
    }
  }, [chart, centerLabel, setCenterLabel]);

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
        onSegmentHover?.(result.data);
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
      onSegmentClick?.(tooltip.content);
    }
  };

  // Overall stats
  const stats = useMemo(() => {
    if (!chart) return null;
    return chart.get_stats();
  }, [chart, segments]);

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
        className="cursor-pointer"
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onClick={handleCanvasClick}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 10, width - 150),
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium">{(tooltip.content as Record<string, string>).label}</div>
          <div className="text-gray-300">
            {(tooltip.content as Record<string, number>).completed} /{' '}
            {(tooltip.content as Record<string, number>).total} completed
          </div>
          <div className="text-blue-300">
            {(tooltip.content as Record<string, number>).percentage?.toFixed(1)}%
          </div>
        </div>
      )}

      {/* Legend below chart */}
      {stats && (
        <div className="mt-4 space-y-2">
          {stats.segments.map((segment, index) => (
            <div key={segment.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{
                    backgroundColor: segments[index]?.color || `hsl(${index * 45}, 70%, 50%)`,
                  }}
                />
                <span className="text-gray-700">{segment.label}</span>
              </div>
              <span className="text-gray-500">
                {segment.completed}/{segment.total} ({segment.percentage.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProgressRadial;
