import { useRef, useState } from 'react';
import { FolderLock, X, CheckCircle2, XCircle, Upload } from 'lucide-react';
import { useVaultDocuments, useUploadDocument, useVerifyDocument, documentStatusColor, ENTITY_TYPE_LABELS } from '@/hooks/useAfriops';
import { useAssetOptions, useSiteOptions } from '@/hooks/useAssetSitePickers';
import { useOrganisation, usePermissions } from '@/hooks/useOrganisation';
import { supabase } from '@/lib/supabase';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import type { DocumentEntityType } from '@/lib/afriops/types';

const COLOR_CLASS: Record<string, string> = {
  green: 'bg-success/15 text-success',
  amber: 'bg-warning/15 text-warning',
  red: 'bg-danger/15 text-danger',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_LABEL: Record<string, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  no_expiry: 'No Expiry',
};

const ENTITY_TYPES: DocumentEntityType[] = ['organisation', 'site', 'asset', 'service_provider', 'supplier', 'work_order', 'business_unit'];

function UploadModal({ onClose }: { onClose: () => void }) {
  const upload = useUploadDocument();
  const { data: org } = useOrganisation();
  const { data: assets } = useAssetOptions();
  const { data: sites } = useSiteOptions();
  const push = useToastStore((s) => s.push);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ entity_type: 'asset' as DocumentEntityType, entity_id: '', doc_type: '', expiry_date: '' });

  const pickerOptions = form.entity_type === 'asset' ? assets : form.entity_type === 'site' ? sites?.map((s) => ({ id: s.id, label: s.name })) : undefined;
  const pending = uploading || upload.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">Add document</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <select className="input" value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value as DocumentEntityType, entity_id: '' })}>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>)}
          </select>
          {pickerOptions?.length ? (
            <select className="input" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })}>
              <option value="">Select {ENTITY_TYPE_LABELS[form.entity_type].toLowerCase()}…</option>
              {pickerOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          ) : (
            <input className="input" placeholder="Entity ID (UUID)" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} />
          )}
          <input className="input" placeholder="Document type (e.g. insurance, licence)" value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} />

          <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="input flex items-center gap-2 text-left" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 text-gray-400 shrink-0" />
            <span className={cn('truncate', !file && 'text-gray-400')}>{file ? file.name : 'Choose a file to upload'}</span>
          </button>

          <input className="input" type="date" placeholder="Expiry date (optional)" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        </div>
        <button
          className="btn-primary w-full mt-4"
          disabled={!form.entity_id.trim() || !form.doc_type.trim() || !file || pending}
          onClick={async () => {
            if (!file || !org) return;
            setUploading(true);
            try {
              const path = `${org.organisation_id}/${form.entity_type}/${form.entity_id.trim()}/${Date.now()}-${file.name}`;
              const { error: uploadError } = await supabase.storage.from('document-vault').upload(path, file);
              if (uploadError) throw uploadError;

              await upload.mutateAsync({
                entity_type: form.entity_type,
                entity_id: form.entity_id.trim(),
                doc_type: form.doc_type.trim(),
                storage_path: path,
                expiry_date: form.expiry_date || undefined,
              });
              push('Document uploaded', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to add document', 'error');
            } finally {
              setUploading(false);
            }
          }}
        >
          {pending ? 'Uploading…' : 'Upload document'}
        </button>
      </div>
    </div>
  );
}

export default function DocumentVault() {
  const { data: documents, isLoading } = useVaultDocuments();
  const verify = useVerifyDocument();
  const { can } = usePermissions();
  const canManage = can('compliance.manage');
  const push = useToastStore((s) => s.push);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Document Vault</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Compliance documents across assets, suppliers, sites and service providers. Expiry status is computed automatically.
      </p>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !documents?.length ? (
        <EmptyState icon={FolderLock} title="No documents yet" description="Add your first compliance document." />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{doc.doc_type}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{ENTITY_TYPE_LABELS[doc.entity_type]}</p>
                </div>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0', COLOR_CLASS[documentStatusColor(doc.status)])}>
                  {STATUS_LABEL[doc.status]}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {doc.expiry_date ? `Expires ${formatDate(doc.expiry_date)}` : 'No expiry date set'}
              </p>
              {doc.rejection_reason && <p className="text-xs text-danger mb-2">Rejected: {doc.rejection_reason}</p>}
              {!doc.verified_at && !doc.rejection_reason && canManage && (
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    className="btn-secondary flex-1 text-sm !py-2 !text-danger flex items-center justify-center gap-1"
                    disabled={verify.isPending}
                    onClick={async () => {
                      try {
                        await verify.mutateAsync({ documentId: doc.id, approved: false, rejectionReason: 'Rejected by reviewer' });
                        push('Document rejected', 'success');
                      } catch (e: any) {
                        push(e.message ?? 'Failed to reject', 'error');
                      }
                    }}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    className="btn-primary flex-1 text-sm !py-2 flex items-center justify-center gap-1"
                    disabled={verify.isPending}
                    onClick={async () => {
                      try {
                        await verify.mutateAsync({ documentId: doc.id, approved: true });
                        push('Document verified', 'success');
                      } catch (e: any) {
                        push(e.message ?? 'Failed to verify', 'error');
                      }
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Verify
                  </button>
                </div>
              )}
              {doc.verified_at && <p className="text-xs text-success font-semibold">Verified {formatDate(doc.verified_at)}</p>}
            </div>
          ))}
        </div>
      )}

      {canManage && <FAB onClick={() => setShowUpload(true)} label="Add document" />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
