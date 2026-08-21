import { useState } from 'react';
import { Truck, X, Plus, Trash2 } from 'lucide-react';
import {
  useServiceProviders, useCreateServiceProvider, useUpdateServiceProviderStatus,
  useServiceProviderCapabilities, useAddCapability, useRemoveCapability,
  SERVICE_PROVIDER_TYPES, SERVICE_PROVIDER_STATUSES,
  type ServiceProvider, type ServiceProviderType, type ServiceProviderStatus,
} from '@/hooks/useServiceProviders';
import { usePermissions } from '@/hooks/useOrganisation';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

const TYPE_LABELS: Record<ServiceProviderType, string> = {
  workshop: 'Workshop',
  contractor: 'Contractor',
  maintenance_provider: 'Maintenance Provider',
  supplier: 'Supplier',
  technician_org: 'Technician Org',
  other: 'Other',
};

const STATUS_META: Record<ServiceProviderStatus, { label: string; className: string }> = {
  pending_onboarding: { label: 'Pending', className: 'bg-gray-100 text-gray-600 dark:bg-charcoal-light dark:text-gray-300' },
  active: { label: 'Active', className: 'bg-success/10 text-success' },
  suspended: { label: 'Suspended', className: 'bg-warning/10 text-warning' },
  terminated: { label: 'Terminated', className: 'bg-danger/10 text-danger' },
};

// Status changes gated by permission, not by an ordered flow — a provider
// can be reinstated from suspended or terminated, so this offers every
// other status rather than a single "next" step like Incidents does.
function nextStatuses(current: ServiceProviderStatus): ServiceProviderStatus[] {
  return SERVICE_PROVIDER_STATUSES.filter((s) => s !== current);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewProviderModal({ onClose }: { onClose: () => void }) {
  const create = useCreateServiceProvider();
  const push = useToastStore((s) => s.push);
  const [tradingName, setTradingName] = useState('');
  const [type, setType] = useState<ServiceProviderType>('workshop');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <Modal title="New service provider" onClose={onClose}>
      <div className="space-y-3">
        <input className="input" placeholder="Trading name" value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {SERVICE_PROVIDER_TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={cn('rounded-xl px-2 py-2 text-xs font-semibold', type === t ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <input className="input" placeholder="Contact email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Contact phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <button
        className="btn-primary w-full mt-4"
        disabled={!tradingName.trim() || create.isPending}
        onClick={async () => {
          try {
            await create.mutateAsync({
              trading_name: tradingName.trim(),
              primary_type: type,
              contact_email: email.trim() || undefined,
              contact_phone: phone.trim() || undefined,
            });
            push('Service provider added', 'success');
            onClose();
          } catch (e: any) {
            push(e.message ?? 'Failed to add service provider', 'error');
          }
        }}
      >
        Add provider
      </button>
    </Modal>
  );
}

function CapabilitiesPanel({ provider, onClose }: { provider: ServiceProvider; onClose: () => void }) {
  const { data: capabilities, isLoading } = useServiceProviderCapabilities(provider.id);
  const addCapability = useAddCapability();
  const removeCapability = useRemoveCapability();
  const push = useToastStore((s) => s.push);
  const [newCap, setNewCap] = useState<ServiceProviderType>('workshop');
  const [category, setCategory] = useState('');

  const existing = new Set((capabilities ?? []).map((c) => c.capability));

  return (
    <Modal title={`${provider.trading_name} — capabilities`} onClose={onClose}>
      {isLoading ? (
        <SkeletonCard />
      ) : !capabilities?.length ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No capabilities recorded yet.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {capabilities.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-charcoal-light px-3 py-2">
              <div>
                <p className="text-sm font-semibold">{TYPE_LABELS[c.capability]}</p>
                {c.service_category && <p className="text-xs text-gray-500 dark:text-gray-400">{c.service_category}</p>}
              </div>
              <button
                onClick={async () => {
                  try {
                    await removeCapability.mutateAsync({ id: c.id, service_provider_id: provider.id });
                  } catch (e: any) {
                    push(e.message ?? 'Failed to remove capability', 'error');
                  }
                }}
              >
                <Trash2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Add capability</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {SERVICE_PROVIDER_TYPES.filter((t) => !existing.has(t)).map((t) => (
          <button key={t} onClick={() => setNewCap(t)}
            className={cn('rounded-xl px-2 py-2 text-xs font-semibold', newCap === t ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <input className="input mb-3" placeholder="Service category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />
      <button
        className="btn-secondary w-full text-sm !py-2"
        disabled={existing.has(newCap) || addCapability.isPending}
        onClick={async () => {
          try {
            await addCapability.mutateAsync({ service_provider_id: provider.id, capability: newCap, service_category: category.trim() || undefined });
            setCategory('');
            push('Capability added', 'success');
          } catch (e: any) {
            push(e.message ?? 'Failed to add capability', 'error');
          }
        }}
      >
        <Plus className="w-4 h-4 inline -mt-0.5 mr-1" /> Add capability
      </button>
    </Modal>
  );
}

function ProviderCard({ provider, canManage }: { provider: ServiceProvider; canManage: boolean }) {
  const updateStatus = useUpdateServiceProviderStatus();
  const push = useToastStore((s) => s.push);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMeta = STATUS_META[provider.status];

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-sm">{provider.trading_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{TYPE_LABELS[provider.primary_type]}</p>
        </div>
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0', statusMeta.className)}>
          {statusMeta.label}
        </span>
      </div>
      {(provider.contact_email || provider.contact_phone) && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {[provider.contact_email, provider.contact_phone].filter(Boolean).join(' · ')}
        </p>
      )}
      {provider.regions?.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{provider.regions.join(', ')}</p>
      )}
      <p className="text-[11px] text-gray-400 mb-3">Added {formatDate(provider.created_at)}</p>

      <div className="flex gap-2">
        <button className="btn-secondary flex-1 text-sm !py-2" onClick={() => setShowCapabilities(true)}>
          Capabilities
        </button>
        {canManage && (
          <div className="relative flex-1">
            <button className="btn-secondary w-full text-sm !py-2" onClick={() => setShowStatusMenu((v) => !v)}>
              Change status
            </button>
            {showStatusMenu && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 card !p-1.5 shadow-lg">
                {nextStatuses(provider.status).map((s) => (
                  <button
                    key={s}
                    className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-charcoal-light"
                    disabled={updateStatus.isPending}
                    onClick={async () => {
                      try {
                        await updateStatus.mutateAsync({ id: provider.id, status: s });
                        push(`Marked ${STATUS_META[s].label.toLowerCase()}`, 'success');
                      } catch (e: any) {
                        push(e.message ?? 'Failed to update status', 'error');
                      } finally {
                        setShowStatusMenu(false);
                      }
                    }}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCapabilities && <CapabilitiesPanel provider={provider} onClose={() => setShowCapabilities(false)} />}
    </div>
  );
}

export default function ServiceProviders() {
  const { data: providers, isLoading } = useServiceProviders();
  const { can } = usePermissions();
  const [showNew, setShowNew] = useState(false);
  const canManage = can('serviceproviders.manage');

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Service Providers</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Workshops, contractors and suppliers your organisation works with.</p>

      {canManage && (
        <button className="btn-primary w-full mb-4 text-sm" onClick={() => setShowNew(true)}>
          + New service provider
        </button>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !providers?.length ? (
        <EmptyState icon={Truck} title="No service providers yet" description={canManage ? 'Add your first service provider.' : 'Ask an admin to add a service provider.'} />
      ) : (
        <div className="space-y-3">
          {providers.map((p) => <ProviderCard key={p.id} provider={p} canManage={canManage} />)}
        </div>
      )}

      {showNew && <NewProviderModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
