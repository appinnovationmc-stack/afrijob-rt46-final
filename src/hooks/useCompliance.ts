import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TablesInsert } from '@/types/database.types';

export function useComplianceDocuments(workshopId: string | undefined) {
  return useQuery({
    queryKey: ['compliance', workshopId],
    enabled: !!workshopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_documents')
        .select('*')
        .eq('workshop_id', workshopId!)
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadComplianceDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: TablesInsert<'compliance_documents'>) => {
      const { data, error } = await supabase.from('compliance_documents').insert(doc).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['compliance', data.workshop_id] });
    },
  });
}
