import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TablesInsert } from '@/types/database.types';

export function useJobParts(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job-parts', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_parts')
        .select('*')
        .eq('job_id', jobId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddJobPart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (part: TablesInsert<'job_parts'>) => {
      const { data, error } = await supabase.from('job_parts').insert(part).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['job-parts', data.job_id] });
    },
  });
}

export function useDeleteJobPart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      const { error } = await supabase.from('job_parts').delete().eq('id', id);
      if (error) throw error;
      return jobId;
    },
    onSuccess: (jobId) => {
      qc.invalidateQueries({ queryKey: ['job-parts', jobId] });
    },
  });
}
