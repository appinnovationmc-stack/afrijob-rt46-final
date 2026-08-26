import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DraftAction } from '@/lib/afriops/actions';

export interface OperationalAIResult {
  answer: string;
  draftActions: DraftAction[];
}

// The edge function receives the user's own JWT (functions.invoke forwards
// the current session's Authorization header automatically) so every read
// it does is RLS-scoped to the caller's organisation — same as any other
// client call. It never writes to the database itself; draftActions are
// proposals only, executed (if accepted) via executeDraftAction() under the
// user's own session, not the function's.
export function useOperationalAI() {
  return useMutation({
    mutationFn: async (question: string): Promise<OperationalAIResult> => {
      const { data, error } = await supabase.functions.invoke('ai-operations', {
        body: { question },
      });
      if (error) throw error;
      if (!data?.answer) throw new Error(data?.error ?? 'No AI answer returned');
      const rawDrafts = Array.isArray(data.draft_actions) ? data.draft_actions : [];
      const draftActions: DraftAction[] = rawDrafts
        .filter((d: unknown): d is DraftAction => {
          const draft = d as Partial<DraftAction>;
          return !!draft && typeof draft.type === 'string' && typeof draft.label === 'string' && typeof draft.payload === 'object';
        });
      return { answer: data.answer as string, draftActions };
    },
  });
}
