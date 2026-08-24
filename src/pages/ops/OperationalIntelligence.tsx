import { useState } from 'react';
import { ArrowLeft, Brain, Send, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOperationalAI } from '@/hooks/useOperationalAI';

const PROMPTS = [
  'What are the biggest operational risks right now?',
  'Where are we losing time on work orders?',
  'What should the operations manager prioritise today?',
];

export default function OperationalIntelligence() {
  const [question, setQuestion] = useState('');
  const ai = useOperationalAI();

  const ask = () => {
    const value = question.trim();
    if (!value || ai.isPending) return;
    ai.mutate(value);
  };

  return (
    <div className="px-4 pt-6 pb-24 max-w-3xl mx-auto">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5"><Brain className="w-4 h-4" /> AfriOps Intelligence</p>
        <h1 className="font-heading font-bold text-2xl">Ask your operations data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Answers are generated from data your signed-in organisation can actually access. No invented KPIs.</p>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {PROMPTS.map((prompt) => (
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
        <div className="card">
          <div className="flex items-center gap-2 mb-3 font-heading font-bold"><Brain className="w-4 h-4 text-brand-500" /> Operational insight</div>
          <div className="text-sm leading-6 whitespace-pre-wrap">{ai.data}</div>
        </div>
      )}
    </div>
  );
}
