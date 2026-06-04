// Skeleton matches ProductCard shape including the colored left border
// (grey here) so cards don't visually shift when real data lands.

export function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-gray-300 p-4 mb-3 animate-pulse"
      aria-hidden="true"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-16" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-4" />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
          <div className="h-12 bg-gray-200 rounded-lg w-full" />
        </div>
        <div className="border border-dashed border-gray-200 rounded-lg p-2 flex flex-col items-center justify-center">
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-1" />
          <div className="h-2 bg-gray-200 rounded w-2/3" />
        </div>
        <div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
          <div className="h-12 bg-gray-200 rounded-lg w-full" />
        </div>
      </div>

      <div className="h-6 bg-gray-200 rounded-full w-1/3" />
    </div>
  );
}
