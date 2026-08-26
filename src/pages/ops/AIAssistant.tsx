import { useState } from 'react';
import { ArrowLeft, Brain, Send, Sparkles, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOperationalAI } from '@/hooks/useOperationalAI';
import { useOrganisation, INDUSTRY_CONFIG } from '@/hooks/useOrganisation';
import { supabase } from '@/lib/supabase';
import { executeDraftAction, type DraftAction } from '@/lib/afriops/actions';

export default function OperationalIntelligence() {
  const [question, setQuestion] = useState('');
  const { data: org } = useOrganisation();
  const ai = useOperationalAI();
  const [resolvedActions, setResolvedActions] = useState<Record<number, 'accepted' | 'rejected' | 'error'>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const industryMode = org?.industry_mode ?? 'general';
  const prompts = INDUSTRY_CONFIG[industryMode]?.suggestedPrompts ?? INDUSTRY_CONFIG.general.suggestedPrompts;

  const ask = () => {
    const value = question.trim();
    if (!value || ai.isPending) return;
    setResolvedActions({});
    setActionError(null);
    ai.mutate(value);
  };

  const accept = async (action: DraftAction, index: number) => {
    if (!org?.organisation_id) return;
    setActionError(null);
    try {
      await executeDraftAction(supabase, action, org.organisation_id);
      setResolvedActions((prev) => ({ ...prev, [index]: 'accepted' }));
    } catch (err) {
      setResolvedActions((prev) => ({ ...prev, [index]: 'error' }));
      setActionError(err instanceof Error ? err.message : 'Unable to execute that action.');
    }
  };

  const reject = (index: number) => {
    setResolvedActions((prev) => ({ ...prev, [index]: 'rejected' }));
  };

  return (
    <div className="px-4 pt-6 pb-24 max-w-3xl mx-auto">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5"><Brain className="w-4 h-4" /> AfriOps Intelligence</p>
        <h1 className="font-heading font-bold text-2xl">Ask your operations data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Answers are generated from data your signed-in organisation can actually access. No invented KPIs. Any suggested action needs your explicit accept before anything changes.</p>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => setQuestion(prompt)} className="text-xs px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left">
              <Sparkles className="w-3 h-3 inline mr-1" />{prompt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask(); }} placeholder="Ask a question about your operations…" rows={3} className="input flex-1 resize-none" maxLength={2000} />
          <button type="button" onClick={ask} disabled={!question.trim() || ai.isPending} className="self-end btn-primary px-4 py-3 disabled:opacity-50" aria-label="Ask AfriOps Intelligence">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {ai.isPending && <div className="card text-sm text-gray-500">Analysing live operational data…</div>}
      {ai.isError && <div className="card border border-danger/30 text-sm text-danger">{ai.error instanceof Error ? ai.error.message : 'Unable to generate an answer.'}</div>}
      {ai.data && (
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-3 font-heading font-bold"><Brain className="w-4 h-4 text-brand-500" /> Operational insight</div>
          <div className="text-sm leading-6 whitespace-pre-wrap">{ai.data.answer}</div>
        </div>
      )}

      {ai.data && ai.data.draftActions.length > 0 && (
        <div className="card">
          <div className="font-heading font-bold text-sm mb-3">Suggested actions</div>
          {actionError && <div className="text-xs text-danger mb-3">{actionError}</div>}
          <div className="space-y-2">
            {ai.data.draftActions.map((action, i) => {
              const resolved = resolvedActions[i];
              return (
                <div key={i} className="flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <span className="text-sm">{action.label}</span>
                  {!resolved && (
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => accept(action, i)} className="p-1.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" aria-label="Accept">
                        <Check className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => reject(i)} className="p-1.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800" aria-label="Reject">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {resolved === 'accepted' && <span className="text-xs text-green-700 dark:text-green-400 shrink-0">Done</span>}
                  {resolved === 'rejected' && <span className="text-xs text-gray-400 shrink-0">Dismissed</span>}
                  {resolved === 'error' && <span className="text-xs text-danger shrink-0">Failed</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
