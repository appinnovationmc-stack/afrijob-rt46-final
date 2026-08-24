import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Tag, Car, X, ArrowLeft } from 'lucide-react';
import {
  useSites, useCreateSite, useBusinessUnits, useCreateBusinessUnit,
  useAssetTypes, useCreateAssetType, useAssets, useCreateAsset,
} from '@/hooks/useAssetRegistry';
import { usePermissions, useOrganisation, INDUSTRY_CONFIG } from '@/hooks/useOrganisation';
import type { IndustryConfig } from '@/hooks/useOrganisation';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type Tab = 'sites' | 'business-units' | 'asset-types' | 'assets';

const TABS: { id: Tab; label: string; icon: typeof MapPin }[] = [
  { id: 'sites', label: 'Sites', icon: MapPin },
  { id: 'business-units', label: 'Business Units', icon: Building2 },
  { id: 'asset-types', label: 'Asset Types', icon: Tag },
  { id: 'assets', label: 'Assets', icon: Car },
];

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

function SitesTab({ canManage }: { canManage: boolean }) {
  const { data: sites, isLoading } = useSites();
  const create = useCreateSite();
  const push = useToastStore((s) => s.push);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });

  return (
    <div>
      {canManage && (
        <button className="btn-primary w-full mb-4 text-sm" onClick={() => setShowNew(true)}>
          + New site
        </button>
      )}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !sites?.length ? (
        <EmptyState icon={MapPin} title="No sites yet" description={canManage ? 'Add your first site.' : 'Ask an admin to add a site.'} />
      ) : (
        <div className="space-y-3">
          {sites.map((s) => (
            <div key={s.id} className="card">
              <p className="font-semibold text-sm">{s.name}</p>
              {s.address && <p className="text-xs text-gray-500 dark:text-gray-400">{s.address}</p>}
            </div>
          ))}
        </div>
      )}
      {showNew && (
        <Modal title="New site" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Site name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <button
            className="btn-primary w-full mt-4"
            disabled={!form.name.trim() || create.isPending}
            onClick={async () => {
              try {
                await create.mutateAsync({ name: form.name.trim(), address: form.address.trim() || undefined });
                push('Site added', 'success');
                setShowNew(false);
                setForm({ name: '', address: '' });
              } catch (e: any) {
                push(e.message ?? 'Failed to add site', 'error');
              }
            }}
          >
            Add site
          </button>
        </Modal>
      )}
    </div>
  );
}

function BusinessUnitsTab({ canManage }: { canManage: boolean }) {
  const { data: units, isLoading } = useBusinessUnits();
  const create = useCreateBusinessUnit();
  const push = useToastStore((s) => s.push);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');

  return (
    <div>
      {canManage && (
        <button className="btn-primary w-full mb-4 text-sm" onClick={() => setShowNew(true)}>
          + New business unit
        </button>
      )}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !units?.length ? (
        <EmptyState icon={Building2} title="No business units yet" description={canManage ? 'Add one to group sites and assets.' : 'Ask an admin to add one.'} />
      ) : (
        <div className="space-y-3">
          {units.map((u) => (
            <div key={u.id} className="card">
              <p className="font-semibold text-sm">{u.name}</p>
            </div>
          ))}
        </div>
      )}
      {showNew && (
        <Modal title="New business unit" onClose={() => setShowNew(false)}>
          <input className="input" placeholder="Name (e.g. Northern Region)" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn-primary w-full mt-4"
            disabled={!name.trim() || create.isPending}
            onClick={async () => {
              try {
                await create.mutateAsync({ name: name.trim() });
                push('Business unit added', 'success');
                setShowNew(false);
                setName('');
              } catch (e: any) {
                push(e.message ?? 'Failed to add business unit', 'error');
              }
            }}
          >
            Add business unit
          </button>
        </Modal>
      )}
    </div>
  );
}

function AssetTypesTab({ canManage, industryConfig }: { canManage: boolean; industryConfig: IndustryConfig }) {
  const { data: types, isLoading } = useAssetTypes();
  const create = useCreateAssetType();
  const push = useToastStore((s) => s.push);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code: '', label: '', category: '' });

  return (
    <div>
      {canManage && (
        <button className="btn-primary w-full mb-4 text-sm" onClick={() => setShowNew(true)}>
          + New asset type
        </button>
      )}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !types?.length ? (
        <EmptyState icon={Tag} title="No asset types yet" description={canManage ? 'e.g. Light Vehicle, Excavator, Generator.' : 'Ask an admin to add one.'} />
      ) : (
        <div className="space-y-3">
          {types.map((t) => (
            <div key={t.id} className="card flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{t.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.category}</p>
              </div>
              <span className="text-xs text-gray-400 font-mono">{t.code}</span>
            </div>
          ))}
        </div>
      )}
      {showNew && (
        <Modal title="New asset type" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Label (e.g. Excavator)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input className="input" placeholder="Code (e.g. excavator)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input
              className="input"
              list="asset-type-category-suggestions"
              placeholder="Category (e.g. heavy_equipment)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            {/* Suggestions only — category stays free text on asset_types,
                so nothing here constrains what an org can actually type. */}
            <datalist id="asset-type-category-suggestions">
              {industryConfig.suggestedAssetCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <button
            className="btn-primary w-full mt-4"
            disabled={!form.label.trim() || !form.code.trim() || !form.category.trim() || create.isPending}
            onClick={async () => {
              try {
                await create.mutateAsync({ code: form.code.trim(), label: form.label.trim(), category: form.category.trim() });
                push('Asset type added', 'success');
                setShowNew(false);
                setForm({ code: '', label: '', category: '' });
              } catch (e: any) {
                push(e.message ?? 'Failed to add asset type', 'error');
              }
            }}
          >
            Add asset type
          </button>
        </Modal>
      )}
    </div>
  );
}

const METER_TYPES = ['odometer', 'hours', 'none'] as const;

function AssetsTab({ assetLabel }: { assetLabel: IndustryConfig }) {
  const { data: assets, isLoading } = useAssets();
  const { data: sites } = useSites();
  const { data: types } = useAssetTypes();
  const create = useCreateAsset();
  const push = useToastStore((s) => s.push);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    asset_number: '', registration: '', manufacturer: '', model: '', year: '',
    meter_type: 'odometer' as (typeof METER_TYPES)[number], site_id: '', asset_type_id: '',
  });

  return (
    <div>
      <button className="btn-primary w-full mb-4 text-sm" onClick={() => setShowNew(true)}>
        + New {assetLabel.assetLabelSingular.toLowerCase()}
      </button>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !assets?.length ? (
        <EmptyState
          icon={Car}
          title={`No ${assetLabel.assetLabelPlural.toLowerCase()} yet`}
          description={`Add ${assetLabel.assetLabelPlural.toLowerCase()} to start tracking maintenance, incidents, and documents against them.`}
        />
      ) : (
        <div className="space-y-3">
          {assets.map((a) => (
            <Link key={a.id} to={`/ops/admin/assets/${a.id}`} className="card block active:scale-[0.98] transition-transform">
              <p className="font-semibold text-sm">
                {a.asset_number ?? a.registration ?? [a.manufacturer, a.model].filter(Boolean).join(' ') ?? `Unnamed ${assetLabel.assetLabelSingular.toLowerCase()}`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[a.manufacturer, a.model, a.year].filter(Boolean).join(' ')} · {a.meter_type} · {a.status}
              </p>
            </Link>
          ))}
        </div>
      )}
      {showNew && (
        <Modal title={`New ${assetLabel.assetLabelSingular.toLowerCase()}`} onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <input className="input" placeholder={`${assetLabel.assetLabelSingular} number (internal ID)`} value={form.asset_number} onChange={(e) => setForm({ ...form, asset_number: e.target.value })} />
            <input className="input" placeholder="Registration (if a vehicle)" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              <input className="input" placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" type="number" placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              <select className="input" value={form.meter_type} onChange={(e) => setForm({ ...form, meter_type: e.target.value as any })}>
                {METER_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {!!sites?.length && (
              <select className="input" value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })}>
                <option value="">No site</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {!!types?.length && (
              <select className="input" value={form.asset_type_id} onChange={(e) => setForm({ ...form, asset_type_id: e.target.value })}>
                <option value="">No type</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            )}
          </div>
          <button
            className="btn-primary w-full mt-4"
            disabled={(!form.asset_number.trim() && !form.registration.trim()) || create.isPending}
            onClick={async () => {
              try {
                await create.mutateAsync({
                  asset_number: form.asset_number.trim() || undefined,
                  registration: form.registration.trim() || undefined,
                  manufacturer: form.manufacturer.trim() || undefined,
                  model: form.model.trim() || undefined,
                  year: form.year ? Number(form.year) : undefined,
                  meter_type: form.meter_type,
                  site_id: form.site_id || undefined,
                  asset_type_id: form.asset_type_id || undefined,
                });
                push(`${assetLabel.assetLabelSingular} added`, 'success');
                setShowNew(false);
                setForm({ asset_number: '', registration: '', manufacturer: '', model: '', year: '', meter_type: 'odometer', site_id: '', asset_type_id: '' });
              } catch (e: any) {
                push(e.message ?? 'Failed to add asset', 'error');
              }
            }}
          >
            Add asset
          </button>
        </Modal>
      )}
    </div>
  );
}

export default function AssetRegistry() {
  const [tab, setTab] = useState<Tab>('assets');
  const { can } = usePermissions();
  const { data: org } = useOrganisation();
  const industryConfig = INDUSTRY_CONFIG[org?.industry_mode ?? 'general'];
  // sites/business_units/asset_types require org_admin at the RLS level;
  // assets themselves only require org membership — mirrored here so the
  // "+ New" button only appears where the write would actually succeed.
  const canManageStructure = can('sites.manage');

  return (
    <div className="px-4 pt-6 pb-24">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="font-heading font-bold text-2xl mb-1">{industryConfig.assetLabelPlural} Registry</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Sites, business units, {industryConfig.assetLabelSingular.toLowerCase()} types and {industryConfig.assetLabelPlural.toLowerCase()} — the foundational data every other Ops module builds on.
      </p>

      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap',
              tab === id ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300'
            )}
            onClick={() => setTab(id)}
          >
            <Icon className="w-3.5 h-3.5" />{' '}
            {id === 'assets' ? industryConfig.assetLabelPlural
              : id === 'asset-types' ? `${industryConfig.assetLabelSingular} Types`
              : label}
          </button>
        ))}
      </div>

      {tab === 'sites' && <SitesTab canManage={canManageStructure} />}
      {tab === 'business-units' && <BusinessUnitsTab canManage={canManageStructure} />}
      {tab === 'asset-types' && <AssetTypesTab canManage={canManageStructure} industryConfig={industryConfig} />}
      {tab === 'assets' && <AssetsTab assetLabel={industryConfig} />}
    </div>
  );
}
