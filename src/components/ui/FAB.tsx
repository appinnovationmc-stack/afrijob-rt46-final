import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FAB({ onClick, label = 'New Job' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full bg-brand text-white',
        'shadow-card-hover px-5 py-4 font-semibold active:scale-95 transition-transform'
      )}
    >
      <Plus className="w-5 h-5" />
      {label}
    </button>
  );
}
