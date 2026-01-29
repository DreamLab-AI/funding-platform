// =============================================================================
// Submission Timeline Visualization Component
// =============================================================================

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useTimeline, type TimelineDataPoint, type TimelineEvent, type HitTestResult } from '../../wasm';

interface SubmissionTimelineProps {
  /** Timeline data points */
  data: TimelineDataPoint[];
  /** Important events (deadlines, milestones) */
  events?: TimelineEvent[];
  /** Time granularity */
  granularity?: 'hour' | 'day' | 'week';
  /** Show cumulative line */
  showCumulative?: boolean;
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Callback when a point is hovered */
  onPointHover?: (pointData: HitTestResult['data']) => void;
  /** Callback when a point is clicked */
  onPointClick?: (pointData: HitTestResult['data']) => void;
}

/**
 * WASM-powered submission timeline visualization
 * Shows application submission patterns over time
 */
export function SubmissionTimeline({
  data,
  events = [],
  granularity = 'day',
  showCumulative = true,
  width = 800,
  height = 400,
  className = '',
  onPointHover,
  onPointClick,
}: SubmissionTimelineProps) {
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
    setEvents,
    setShowCumulative,
    setGranularity,
    handleMouseMove,
  } = useTimeline(canvasRef, { width, height });

  // Update data when it changes
  useEffect(() => {
    if (chart && data.length > 0) {
      setData(data);
    }
  }, [chart, data, setData]);

  // Update events
  useEffect(() => {
    if (chart) {
      setEvents(events);
    }
  }, [chart, events, setEvents]);

  // Update settings
  useEffect(() => {
    if (chart) {
      setShowCumulative(showCumulative);
      setGranularity(granularity);
    }
  }, [chart, showCumulative, granularity, setShowCumulative, setGranularity]);

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
        onPointHover?.(result.data);
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
      onPointClick?.(tooltip.content);
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

      {/* Controls */}
      <div className="flex justify-end gap-4 mb-2 text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input
            type="checkbox"
            checked={showCumulative}
            onChange={(e) => setShowCumulative(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show Cumulative
        </label>
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as 'hour' | 'day' | 'week')}
          className="rounded border-gray-300 text-gray-600 text-sm"
        >
          <option value="hour">Hourly</option>
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
        </select>
      </div>

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
            left: Math.min(tooltip.x + 10, width - 180),
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium">{(tooltip.content as Record<string, string>).date}</div>
          <div className="text-blue-300">
            Submissions: {(tooltip.content as Record<string, number>).count}
          </div>
          {showCumulative && (
            <div className="text-green-300">
              Total: {(tooltip.content as Record<string, number>).cumulative}
            </div>
          )}
          {(tooltip.content as Record<string, string>).label && (
            <div className="text-gray-400 text-xs mt-1">
              {(tooltip.content as Record<string, string>).label}
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
          <span>{stats.totalSubmissions} total submissions</span>
          <span>Peak: {stats.peakCount} submissions</span>
          <span>{stats.eventCount} events</span>
        </div>
      )}
    </div>
  );
}

export default SubmissionTimeline;
