import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserCircle, X, Plus, AlertTriangle } from 'lucide-react';
import {
  useDrivers, useCreateDriver, useUpdateDriver, useExpiringDriverLicenses,
  DRIVER_STATUSES, type Driver, type DriverStatus,
} from '@/hooks/useDrivers';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

const STATUS_META: Record<DriverStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success' },
  suspended: { label: 'Suspended', className: 'bg-warning/10 text-warning' },
  inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-600 dark:bg-charcoal-light dark:text-gray-300' },
};

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

function NewDriverModal({ onClose }: { onClose: () => void }) {
  const create = useCreateDriver();
  const push = useToastStore((s) => s.push);
  const [fullName, setFullName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseClass, setLicenseClass] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [phone, setPhone] = useState('');

  const submit = async () => {
    if (!fullName.trim()) return;
    try {
      await create.mutateAsync({
        full_name: fullName.trim(),
        license_number: licenseNumber.trim() || undefined,
        license_class: licenseClass.trim() || undefined,
        license_expiry: licenseExpiry || undefined,
        phone: phone.trim() || undefined,
      });
      push('Driver added', 'success');
      onClose();
    } catch (err: any) {
      push(err.message ?? 'Failed to add driver', 'error');
    }
  };

  return (
    <Modal title="Add driver" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">License number</label>
          <input className="input" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">License class</label>
            <input className="input" value={licenseClass} onChange={(e) => setLicenseClass(e.target.value)} placeholder="e.g. Code 10" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">License expiry</label>
            <input type="date" className="input" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Phone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={!fullName.trim() || create.isPending} onClick={submit}>
          {create.isPending ? 'Adding...' : 'Add driver'}
        </button>
      </div>
    </Modal>
  );
}

function DriverCard({ driver }: { driver: Driver }) {
  const update = useUpdateDriver();
  const push = useToastStore((s) => s.push);
  const meta = STATUS_META[driver.status];
  const isExpiring = driver.license_expiry && new Date(driver.license_expiry) <= new Date(Date.now() + 30 * 86400000);

  const changeStatus = async (status: DriverStatus) => {
    try {
      await update.mutateAsync({ id: driver.id, status });
      push('Driver status updated', 'success');
    } catch (err: any) {
      push(err.message ?? 'Failed to update driver', 'error');
    }
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserCircle className="w-8 h-8 text-gray-400 shrink-0" />
          <div>
            <p className="font-heading font-bold text-sm">{driver.full_name}</p>
            {driver.license_number && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {driver.license_number}{driver.license_class ? ` · ${driver.license_class}` : ''}
              </p>
            )}
          </div>
        </div>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', meta.className)}>{meta.label}</span>
      </div>
      {driver.license_expiry && (
        <p className={cn('text-xs mt-2 flex items-center gap-1', isExpiring ? 'text-warning font-semibold' : 'text-gray-500 dark:text-gray-400')}>
          {isExpiring && <AlertTriangle className="w-3.5 h-3.5" />}
          License expires {formatDate(driver.license_expiry)}
        </p>
      )}
      <div className="flex gap-1.5 mt-3 flex-wrap">
        {DRIVER_STATUSES.filter((s) => s !== driver.status).map((s) => (
          <button
            key={s}
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300 font-medium"
            onClick={() => changeStatus(s)}
            disabled={update.isPending}
          >
            Mark {STATUS_META[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Drivers() {
  const { data: drivers, isLoading } = useDrivers();
  const { data: expiring } = useExpiringDriverLicenses();
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="pb-4">
      <div className="sticky top-0 z-10 bg-off-white dark:bg-charcoal px-4 pt-4 pb-2 flex items-center gap-2 border-b border-gray-100 dark:border-charcoal-light">
        <Link to="/ops" className="p-1 -ml-1"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-lg">Drivers</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{drivers?.length ?? 0} on file</p>
        </div>
        <button className="btn-primary !py-1.5 !px-3 flex items-center gap-1 text-sm" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="p-4 space-y-3">
        {expiring && expiring.length > 0 && (
          <div className="card !bg-warning/5 border border-warning/20">
            <p className="text-sm font-semibold text-warning flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {expiring.length} license{expiring.length !== 1 ? 's' : ''} expiring within 30 days
            </p>
          </div>
        )}

        {isLoading && <><SkeletonCard /><SkeletonCard /></>}

        {!isLoading && (!drivers || drivers.length === 0) && (
          <EmptyState
            icon={UserCircle}
            title="No drivers yet"
            description="Add drivers to assign them to trips and track license compliance."
          />
        )}

        {drivers?.map((d) => <DriverCard key={d.id} driver={d} />)}
      </div>

      {showNew && <NewDriverModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
