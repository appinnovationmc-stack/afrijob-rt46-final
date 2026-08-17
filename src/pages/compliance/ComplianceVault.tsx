import { useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ComplianceStatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { useWorkshopStore } from '@/store/workshopStore';
import { useAuthStore } from '@/store/authStore';
import { useComplianceDocuments, useUploadComplianceDocument } from '@/hooks/useCompliance';
import { useToastStore } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { DOC_TYPE_LABELS, formatDate, daysUntil } from '@/lib/utils';
import { ShieldCheck, Upload } from 'lucide-react';
import type { Enums } from '@/types/database.types';

export default function ComplianceVault() {
  const workshop = useWorkshopStore((s) => s.activeWorkshop);
  const userId = useAuthStore((s) => s.user?.id);
  const { data: docs, isLoading } = useComplianceDocuments(workshop?.id);
  const uploadDoc = useUploadComplianceDocument();
  const push = useToastStore((s) => s.push);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<Enums<'compliance_doc_type'> | null>(null);

  const triggerUpload = (docType: Enums<'compliance_doc_type'>) => {
    setPendingType(docType);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !workshop || !userId || !pendingType) return;

    try {
      const path = `${workshop.id}/${pendingType}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('compliance-documents').upload(path, file);
      if (uploadError) throw uploadError;

      await uploadDoc.mutateAsync({
        workshop_id: workshop.id,
        uploaded_by: userId,
        doc_type: pendingType,
        storage_path: path,
        status: 'valid',
      });
      push('Document uploaded', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setPendingType(null);
    }
  };

  const docTypes = Object.keys(DOC_TYPE_LABELS) as Enums<'compliance_doc_type'>[];
  const uploadedTypes = new Set((docs ?? []).map((d) => d.doc_type));

  return (
    <div>
      <PageHeader title="Compliance Vault" subtitle={workshop?.name} />
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFileSelected} />

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3"><SkeletonCard /><SkeletonCard /></div>
        ) : !docs?.length ? (
          <EmptyState icon={ShieldCheck} title="No documents yet" description="Upload your compliance documents to track expiry dates." />
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {docs.map((doc) => {
              const days = daysUntil(doc.expiry_date);
              return (
                <div key={doc.id} className="card">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-sm">{DOC_TYPE_LABELS[doc.doc_type]}</p>
                    <ComplianceStatusChip status={doc.status} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {doc.expiry_date
                      ? days !== null && days >= 0
                        ? `Expires ${formatDate(doc.expiry_date)} (${days}d)`
                        : `Expired ${formatDate(doc.expiry_date)}`
                      : 'No expiry date set'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="font-heading font-bold text-lg mb-3">Add a Document</h2>
        <div className="flex flex-col gap-2">
          {docTypes.map((type) => (
            <button
              key={type}
              onClick={() => triggerUpload(type)}
              className="card flex items-center justify-between text-left"
            >
              <span className="text-sm font-medium">{DOC_TYPE_LABELS[type]}</span>
              <span className="flex items-center gap-1.5 text-brand text-sm font-semibold">
                <Upload className="w-4 h-4" />
                {uploadedTypes.has(type) ? 'Replace' : 'Upload'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
