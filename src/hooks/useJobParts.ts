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
      // Every job_parts row shows up in work_order_parts_unified regardless
      // of whether it's catalog-linked, so this must always refresh —
      // PartsAndLabour reads from the unified view whenever the job has a
      // bridged work order. Partial key match invalidates every
      // ['work-order-parts-unified', workOrderId] query, so we don't need
      // the workOrderId here.
      qc.invalidateQueries({ queryKey: ['work-order-parts-unified'] });
      // Only a catalog-linked insert triggers the DB mirror into
      // inventory_movements and decrements stock, so only refresh Inventory
      // in that case.
      if (data.inventory_item_id) {
        qc.invalidateQueries({ queryKey: ['ops', 'inventory'] });
      }
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
      // Same reasoning as useAddJobPart: a deleted job_parts row needs to
      // disappear from the unified view too, not just the legacy list.
      qc.invalidateQueries({ queryKey: ['work-order-parts-unified'] });
    },
  });
}
