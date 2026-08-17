import { create } from 'zustand';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: string; message: string; kind: ToastKind }

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'info') => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-3 shadow-card-hover text-sm font-medium pointer-events-auto',
              'bg-charcoal text-white dark:bg-white dark:text-charcoal'
            )}
          >
            <Icon className={cn('w-4 h-4 shrink-0', t.kind === 'success' && 'text-success', t.kind === 'error' && 'text-danger')} />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
