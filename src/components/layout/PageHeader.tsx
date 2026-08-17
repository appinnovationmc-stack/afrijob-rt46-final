import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: boolean;
  right?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-charcoal/90 backdrop-blur border-b border-gray-100 dark:border-gray-800 px-4 py-4 flex items-center gap-3">
      {onBack && (
        <button onClick={() => navigate(-1)} className="min-w-touch min-h-touch flex items-center justify-center -ml-2">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      <div className="flex-1">
        <h1 className="font-heading font-bold text-xl leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
