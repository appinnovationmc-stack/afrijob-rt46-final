import { SupabaseClient } from '@supabase/supabase-js';
import { DocumentEntityType, VaultDocument } from './types';

export async function listDocuments(
  supabase: SupabaseClient,
  organisationId: string,
  entityType?: DocumentEntityType,
  entityId?: string
): Promise<VaultDocument[]> {
  let query = supabase
    .from('document_vault')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('expiry_date', { ascending: true, nullsFirst: false });
  if (entityType) query = query.eq('entity_type', entityType);
  if (entityId) query = query.eq('entity_id', entityId);

  const { data, error } = await query;
  if (error) throw error;
  return data as VaultDocument[];
}

export async function listExpiringDocuments(
  supabase: SupabaseClient,
  organisationId: string
): Promise<VaultDocument[]> {
  const { data, error } = await supabase
    .from('document_vault')
    .select('*')
    .eq('organisation_id', organisationId)
    .in('status', ['expiring_soon', 'expired'])
    .order('expiry_date', { ascending: true });
  if (error) throw error;
  return data as VaultDocument[];
}

// status is computed server-side by trigger — never include it here, it will be ignored/overwritten.
export async function uploadDocument(
  supabase: SupabaseClient,
  doc: Pick<VaultDocument, 'organisation_id' | 'entity_type' | 'entity_id' | 'doc_type' | 'storage_path'> &
    Partial<Pick<VaultDocument, 'issued_date' | 'expiry_date'>>
): Promise<VaultDocument> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('document_vault')
    .insert({ ...doc, uploaded_by: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data as VaultDocument;
}

export async function verifyDocument(
  supabase: SupabaseClient,
  documentId: string,
  approved: boolean,
  rejectionReason?: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('document_vault')
    .update(
      approved
        ? { verified_by: user?.id, verified_at: new Date().toISOString(), rejection_reason: null }
        : { rejection_reason: rejectionReason ?? 'Rejected', verified_by: null, verified_at: null }
    )
    .eq('id', documentId);
  if (error) throw error;
}

export function statusColor(status: VaultDocument['status']): string {
  switch (status) {
    case 'valid':
      return 'green';
    case 'expiring_soon':
      return 'amber';
    case 'expired':
      return 'red';
    case 'no_expiry':
      return 'gray';
  }
}

