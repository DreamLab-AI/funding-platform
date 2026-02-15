// =============================================================================
// Skeleton Loading Components
// =============================================================================

interface SkeletonProps {
  className?: string;
}

function SkeletonBase({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <SkeletonBase className={`h-4 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-5">
      <div className="flex items-center">
        <SkeletonBase className="w-12 h-12 rounded-md flex-shrink-0" />
        <div className="ml-5 flex-1 space-y-2">
          <SkeletonBase className="h-3 w-1/3" />
          <SkeletonBase className="h-6 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <SkeletonBase className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCallCard() {
  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBase className="h-5 w-20 rounded-full" />
        <SkeletonBase className="h-12 w-12 rounded-full" />
      </div>
      <SkeletonBase className="h-5 w-3/4 mb-2" />
      <div className="space-y-1">
        <SkeletonBase className="h-3 w-1/2" />
        <SkeletonBase className="h-3 w-1/3" />
      </div>
      <div className="mt-4 flex gap-2">
        <SkeletonBase className="h-9 flex-1 rounded-md" />
        <SkeletonBase className="h-9 flex-1 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBase className="h-7 w-48" />
          <SkeletonBase className="h-4 w-72" />
        </div>
        <SkeletonBase className="h-10 w-36 rounded-md" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Active calls skeleton */}
      <div>
        <SkeletonBase className="h-5 w-32 mb-4" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCallCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
