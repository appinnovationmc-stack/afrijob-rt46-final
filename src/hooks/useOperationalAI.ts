import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useOperationalAI() {
  return useMutation({
    mutationFn: async (question: string) => {
      const { data, error } = await supabase.functions.invoke('ai-operations', {
        body: { question },
      });
      if (error) throw error;
      if (!data?.answer) throw new Error(data?.error ?? 'No AI answer returned');
      return data.answer as string;
    },
  });
}
