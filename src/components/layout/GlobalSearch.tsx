import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useGlobalSearch, SEARCH_RESULT_HREF, SEARCH_RESULT_TYPE_LABELS } from '@/hooks/useGlobalSearch';
import { EmptyState } from '@/components/ui/EmptyState';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: results, isFetching } = useGlobalSearch(query);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+K opens search from anywhere; Escape closes it; once open,
      // Up/Down move through results and Enter opens the highlighted one.
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (!results?.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const r = results[activeIndex];
        if (r) goTo(r.entity_type, r.entity_id);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, results, activeIndex]);

  function goTo(entityType: keyof typeof SEARCH_RESULT_HREF, entityId: string) {
    setOpen(false);
    setQuery('');
    navigate(SEARCH_RESULT_HREF[entityType](entityId));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="w-9 h-9 rounded-full bg-white/90 dark:bg-charcoal-light/90 backdrop-blur shadow-card flex items-center justify-center"
      >
        <Search className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-charcoal-light rounded-xl shadow-card overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-charcoal">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets, work orders, incidents…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {query.trim().length < 2 ? (
                <p className="text-xs text-gray-400 text-center py-8">Type at least 2 characters to search</p>
              ) : isFetching ? (
                <p className="text-xs text-gray-400 text-center py-8">Searching…</p>
              ) : !results?.length ? (
                <div className="py-4">
                  <EmptyState icon={Search} title="No results" description={`Nothing matched "${query}".`} />
                </div>
              ) : (
                <div className="py-1">
                  {results.map((r, i) => (
                    <button
                      key={`${r.entity_type}-${r.entity_id}`}
                      onClick={() => goTo(r.entity_type, r.entity_id)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 ${i === activeIndex ? 'bg-gray-50 dark:bg-charcoal' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{r.title}</p>
                        {r.subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.subtitle}</p>}
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase shrink-0">{SEARCH_RESULT_TYPE_LABELS[r.entity_type]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
