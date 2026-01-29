// =============================================================================
// Assignment Network Graph Visualization Component
// =============================================================================

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useNetworkGraph, type NetworkNode, type NetworkEdge, type HitTestResult } from '../../wasm';

interface AssignmentNetworkProps {
  /** Network nodes (assessors and applications) */
  nodes: NetworkNode[];
  /** Network edges (assignments) */
  edges: NetworkEdge[];
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Callback when a node is hovered */
  onNodeHover?: (nodeData: HitTestResult['data']) => void;
  /** Callback when nodes are selected */
  onNodeSelect?: (nodeIds: string[]) => void;
  /** Physics settings */
  physics?: {
    repulsion?: number;
    attraction?: number;
    damping?: number;
  };
}

/**
 * WASM-powered interactive network graph
 * Shows assessor-application assignment relationships
 */
export function AssignmentNetwork({
  nodes,
  edges,
  width = 800,
  height = 600,
  className = '',
  onNodeHover,
  onNodeSelect,
  physics = {},
}: AssignmentNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: HitTestResult['data'];
  } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(true);

  const {
    chart,
    loading,
    error,
    setData,
    setPhysics,
    toggleSimulation,
    resetView,
    fitToContent,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleClick,
    handleWheel,
  } = useNetworkGraph(canvasRef, { width, height });

  // Update data when it changes
  useEffect(() => {
    if (chart && nodes.length > 0) {
      setData(nodes, edges);
    }
  }, [chart, nodes, edges, setData]);

  // Update physics settings
  useEffect(() => {
    if (chart) {
      setPhysics(
        physics.repulsion ?? 500,
        physics.attraction ?? 0.05,
        physics.damping ?? 0.9
      );
    }
  }, [chart, physics, setPhysics]);

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
        onNodeHover?.(result.data);
      }
    } else {
      setTooltip(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setTooltip(null);
    handleMouseUp();
  };

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const selected = handleClick(e);
      setSelectedNodes(selected);
      onNodeSelect?.(selected);
    },
    [handleClick, onNodeSelect]
  );

  const handleToggleSimulation = () => {
    const running = toggleSimulation();
    setIsSimulating(running);
  };

  // Stats summary
  const stats = useMemo(() => {
    if (!chart) return null;
    return chart.get_stats();
  }, [chart, nodes]);

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
      <div className="flex justify-between items-center mb-2">
        <div className="flex gap-2">
          <button
            onClick={handleToggleSimulation}
            className={`px-3 py-1 text-sm rounded ${
              isSimulating
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {isSimulating ? 'Pause' : 'Resume'} Layout
          </button>
          <button
            onClick={resetView}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Reset View
          </button>
          <button
            onClick={fitToContent}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Fit to Content
          </button>
        </div>

        {selectedNodes.length > 0 && (
          <div className="text-sm text-gray-600">
            {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-grab active:cursor-grabbing border border-gray-200 rounded-lg"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none max-w-xs"
          style={{
            left: Math.min(tooltip.x + 10, width - 200),
            top: Math.max(tooltip.y - 10, 60),
            transform: tooltip.y > 100 ? 'translateY(-100%)' : 'none',
          }}
        >
          <div className="font-medium">{(tooltip.content as Record<string, string>).label}</div>
          <div className="text-gray-300 capitalize">
            Type: {(tooltip.content as Record<string, string>).type}
          </div>
          <div className="text-blue-300">
            Connections: {(tooltip.content as Record<string, number>).connections}
          </div>
          {(tooltip.content as Record<string, unknown>).metadata && (
            <div className="text-gray-400 text-xs mt-1 truncate">
              {JSON.stringify((tooltip.content as Record<string, unknown>).metadata)}
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
          <span>
            {stats.assessorCount} assessors, {stats.applicationCount} applications
          </span>
          <span>{stats.edgeCount} assignments</span>
          <span>Zoom: {(stats.zoom * 100).toFixed(0)}%</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-6 mt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded-sm" />
          <span className="text-gray-600">Assessor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full" />
          <span className="text-gray-600">Application</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-green-500" />
          <span className="text-gray-600">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-amber-500" />
          <span className="text-gray-600">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-gray-300" />
          <span className="text-gray-600">Pending</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-400 mt-2">
        Drag to pan | Scroll to zoom | Click to select | Shift+Click for multi-select
      </div>
    </div>
  );
}

export default AssignmentNetwork;
