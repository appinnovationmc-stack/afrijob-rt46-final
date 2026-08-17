export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );
}
