// =============================================================================
// DataTable Component - Funding Application Platform
// Sortable, filterable data tables with virtualization support
// =============================================================================

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
  HTMLAttributes,
} from 'react';
import clsx from 'clsx';
import { SortOptions } from '../../types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Column<T> {
  /** Unique column identifier */
  id: string;
  /** Column header text */
  header: string;
  /** Accessor function or key */
  accessor: keyof T | ((row: T) => unknown);
  /** Custom cell renderer */
  cell?: (value: unknown, row: T, index: number) => ReactNode;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Column width (CSS value) */
  width?: string;
  /** Minimum width */
  minWidth?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom header renderer */
  headerCell?: () => ReactNode;
  /** Whether the column is hidden */
  hidden?: boolean;
  /** Column can be resized */
  resizable?: boolean;
  /** Sticky column */
  sticky?: 'left' | 'right';
}

export interface DataTableProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Table data */
  data: T[];
  /** Column definitions */
  columns: Column<T>[];
  /** Function to get unique row key */
  getRowKey: (row: T, index: number) => string;
  /** Current sort state (controlled) */
  sort?: SortOptions | null;
  /** Sort change handler */
  onSortChange?: (sort: SortOptions | null) => void;
  /** Selected row keys */
  selectedRows?: string[];
  /** Selection change handler */
  onSelectionChange?: (selected: string[]) => void;
  /** Enable row selection */
  selectable?: boolean;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Custom row class */
  rowClassName?: string | ((row: T, index: number) => string);
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state component */
  emptyState?: ReactNode;
  /** Enable virtualization for large datasets */
  virtualized?: boolean;
  /** Row height for virtualization */
  rowHeight?: number;
  /** Visible height for virtualized table */
  height?: number;
  /** Pagination config */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
  };
  /** Compact mode */
  compact?: boolean;
  /** Striped rows */
  striped?: boolean;
  /** Bordered cells */
  bordered?: boolean;
  /** Hoverable rows */
  hoverable?: boolean;
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function getValue<T>(row: T, accessor: keyof T | ((row: T) => unknown)): unknown {
  if (typeof accessor === 'function') {
    return accessor(row);
  }
  return row[accessor];
}

// -----------------------------------------------------------------------------
// DataTable Component
// -----------------------------------------------------------------------------

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  sort,
  onSortChange,
  selectedRows = [],
  onSelectionChange,
  selectable = false,
  onRowClick,
  rowClassName,
  isLoading = false,
  emptyMessage = 'No data available',
  emptyState,
  virtualized = false,
  rowHeight = 52,
  height = 400,
  pagination,
  compact = false,
  striped = false,
  bordered = false,
  hoverable = true,
  className,
  ...props
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortOptions | null>(null);
  const currentSort = sort ?? internalSort;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Filter visible columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => !col.hidden),
    [columns]
  );

  // Handle sort
  const handleSort = useCallback(
    (columnId: string) => {
      const column = columns.find((c) => c.id === columnId);
      if (!column?.sortable) return;

      const newSort: SortOptions | null =
        currentSort?.field === columnId
          ? currentSort.direction === 'asc'
            ? { field: columnId, direction: 'desc' }
            : null
          : { field: columnId, direction: 'asc' };

      if (onSortChange) {
        onSortChange(newSort);
      } else {
        setInternalSort(newSort);
      }
    },
    [columns, currentSort, onSortChange]
  );

  // Sort data (only if not server-side sorting)
  const sortedData = useMemo(() => {
    if (!currentSort || onSortChange) return data;

    const column = columns.find((c) => c.id === currentSort.field);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const aVal = getValue(a, column.accessor);
      const bVal = getValue(b, column.accessor);

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return currentSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, currentSort, columns, onSortChange]);

  // Selection handlers
  const allSelected = selectable && data.length > 0 && selectedRows.length === data.length;
  const someSelected = selectable && selectedRows.length > 0 && selectedRows.length < data.length;

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row, i) => getRowKey(row, i)));
    }
  }, [allSelected, data, getRowKey, onSelectionChange]);

  const handleSelectRow = useCallback(
    (rowKey: string) => {
      if (!onSelectionChange) return;
      if (selectedRows.includes(rowKey)) {
        onSelectionChange(selectedRows.filter((k) => k !== rowKey));
      } else {
        onSelectionChange([...selectedRows, rowKey]);
      }
    },
    [selectedRows, onSelectionChange]
  );

  // Virtualization
  const virtualizedData = useMemo(() => {
    if (!virtualized) return sortedData;

    const startIndex = Math.floor(scrollTop / rowHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(height / rowHeight) + 1,
      sortedData.length
    );

    return {
      items: sortedData.slice(startIndex, endIndex),
      startIndex,
      totalHeight: sortedData.length * rowHeight,
    };
  }, [virtualized, sortedData, scrollTop, rowHeight, height]);

  // Handle scroll for virtualization
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (virtualized) {
        setScrollTop(e.currentTarget.scrollTop);
      }
    },
    [virtualized]
  );

  // Render sort icon
  const renderSortIcon = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column?.sortable) return null;

    if (currentSort?.field !== columnId) {
      return (
        <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return currentSort.direction === 'asc' ? (
      <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-lg border border-gray-200 bg-white',
        className
      )}
      {...props}
    >
      <div
        ref={containerRef}
        className={clsx('overflow-auto', virtualized && 'relative')}
        style={virtualized ? { height, maxHeight: height } : undefined}
        onScroll={handleScroll}
      >
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {selectable && (
                <th
                  scope="col"
                  className={clsx('w-12', cellPadding, bordered && 'border-r border-gray-200')}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={clsx(
                    cellPadding,
                    'text-left text-sm font-semibold text-gray-900',
                    column.sortable && 'cursor-pointer select-none group',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    bordered && 'border-r border-gray-200 last:border-r-0',
                    column.sticky === 'left' && 'sticky left-0 z-20 bg-gray-50',
                    column.sticky === 'right' && 'sticky right-0 z-20 bg-gray-50'
                  )}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                  }}
                  onClick={column.sortable ? () => handleSort(column.id) : undefined}
                >
                  <div className="flex items-center gap-2">
                    {column.headerCell ? column.headerCell() : column.header}
                    {renderSortIcon(column.id)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="mt-2 text-sm text-gray-500">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  {emptyState || (
                    <div className="text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="mt-2 text-sm">{emptyMessage}</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : virtualized ? (
              <>
                {/* Spacer for virtualization */}
                <tr style={{ height: (virtualizedData as any).startIndex * rowHeight }} />
                {(virtualizedData as any).items.map((row: T, localIndex: number) => {
                  const actualIndex = (virtualizedData as any).startIndex + localIndex;
                  const rowKey = getRowKey(row, actualIndex);
                  const isSelected = selectedRows.includes(rowKey);

                  return (
                    <tr
                      key={rowKey}
                      style={{ height: rowHeight }}
                      className={clsx(
                        isSelected && 'bg-primary-50',
                        striped && actualIndex % 2 === 1 && !isSelected && 'bg-gray-50',
                        hoverable && !isSelected && 'hover:bg-gray-50',
                        onRowClick && 'cursor-pointer',
                        typeof rowClassName === 'function' ? rowClassName(row, actualIndex) : rowClassName
                      )}
                      onClick={() => onRowClick?.(row, actualIndex)}
                    >
                      {renderRowCells(row, actualIndex, rowKey, isSelected)}
                    </tr>
                  );
                })}
                {/* Bottom spacer */}
                <tr style={{ height: ((virtualizedData as any).totalHeight - ((virtualizedData as any).startIndex + (virtualizedData as any).items.length) * rowHeight) }} />
              </>
            ) : (
              sortedData.map((row, index) => {
                const rowKey = getRowKey(row, index);
                const isSelected = selectedRows.includes(rowKey);

                return (
                  <tr
                    key={rowKey}
                    className={clsx(
                      isSelected && 'bg-primary-50',
                      striped && index % 2 === 1 && !isSelected && 'bg-gray-50',
                      hoverable && !isSelected && 'hover:bg-gray-50',
                      onRowClick && 'cursor-pointer',
                      typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName
                    )}
                    onClick={() => onRowClick?.(row, index)}
                  >
                    {renderRowCells(row, index, rowKey, isSelected)}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <DataTablePagination
          {...pagination}
          compact={compact}
        />
      )}
    </div>
  );

  function renderRowCells(row: T, index: number, rowKey: string, isSelected: boolean) {
    return (
      <>
        {selectable && (
          <td
            className={clsx(cellPadding, bordered && 'border-r border-gray-200')}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleSelectRow(rowKey)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              aria-label={`Select row ${index + 1}`}
            />
          </td>
        )}
        {visibleColumns.map((column) => {
          const value = getValue(row, column.accessor);
          return (
            <td
              key={column.id}
              className={clsx(
                cellPadding,
                'text-sm text-gray-600',
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
                bordered && 'border-r border-gray-200 last:border-r-0',
                column.sticky === 'left' && 'sticky left-0 bg-white',
                column.sticky === 'right' && 'sticky right-0 bg-white'
              )}
              style={{
                width: column.width,
                minWidth: column.minWidth,
              }}
            >
              {column.cell ? column.cell(value, row, index) : String(value ?? '')}
            </td>
          );
        })}
      </>
    );
  }
}

// -----------------------------------------------------------------------------
// Pagination Component
// -----------------------------------------------------------------------------

interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  compact?: boolean;
}

function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  compact = false,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5;

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis');
      }

      pages.push(totalPages);
    }

    return pages;
  }, [page, totalPages]);

  return (
    <div
      className={clsx(
        'flex items-center justify-between border-t border-gray-200 bg-white',
        compact ? 'px-3 py-2' : 'px-4 py-3'
      )}
    >
      {/* Results info */}
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
            className="rounded-md border-gray-300 py-1.5 text-sm focus:border-primary-500 focus:ring-primary-500"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        )}

        {/* Page navigation */}
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={clsx(
              'p-1.5 rounded-md text-gray-400',
              'hover:bg-gray-100 hover:text-gray-600',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Previous page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {pageNumbers.map((pageNum, idx) =>
            pageNum === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={clsx(
                  'min-w-[2rem] h-8 rounded-md text-sm font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500',
                  pageNum === page
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
                aria-current={pageNum === page ? 'page' : undefined}
              >
                {pageNum}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={clsx(
              'p-1.5 rounded-md text-gray-400',
              'hover:bg-gray-100 hover:text-gray-600',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Next page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default DataTable;
