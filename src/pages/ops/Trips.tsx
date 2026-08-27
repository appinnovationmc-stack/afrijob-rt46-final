import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, CheckCircle2, Clock3, Plus, Route as RouteIcon, UsersRound, XCircle } from 'lucide-react';
import { useAssets } from '@/hooks/useAssetRegistry';
import { useDrivers, type Driver } from '@/hooks/useDrivers';
import { useAssetTrips, useEndTrip, useStartTrip, type Trip, type TripStatus } from '@/hooks/useTrips';
import { useOrganisation } from '@/hooks/useOrganisation';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusClass(status: TripStatus) {
  if (status === 'in_progress') return 'bg-warning/10 text-warning';
  if (status === 'completed') return 'bg-success/10 text-success';
  return 'bg-gray-100 dark:bg-charcoal-light text-gray-500';
}

function TripRow({ trip, assets, onEnd }: { trip: Trip; assets: ReturnType<typeof useAssets>['data']; onEnd: (trip: Trip) => void }) {
  const asset = assets?.find((item) => item.id === trip.asset_id);
  const distance = trip.start_odometer != null && trip.end_odometer != null ? Math.max(0, trip.end_odometer - trip.start_odometer) : null;
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-charcoal-light flex items-center justify-center shrink-0"><RouteIcon className="w-5 h-5 text-brand" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold text-sm">{asset?.registration || asset?.asset_number || asset?.model || trip.asset_id}</p><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusClass(trip.status)}`}>{trip.status.replace('_', ' ')}</span></div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{trip.start_location || 'Start not recorded'} → {trip.end_location || 'Destination not recorded'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div><p className="text-gray-400">Driver</p><p className="font-medium mt-0.5">{trip.driver?.full_name || 'Unassigned'}</p></div>
        <div><p className="text-gray-400">Started</p><p className="font-medium mt-0.5">{formatDate(trip.started_at)}</p></div>
        <div><p className="text-gray-400">Distance</p><p className="font-medium mt-0.5">{distance != null ? `${distance.toLocaleString()} km` : '—'}</p></div>
        <div><p className="text-gray-400">Purpose</p><p className="font-medium mt-0.5 truncate">{trip.purpose || '—'}</p></div>
      </div>
      {trip.status === 'in_progress' && <button type="button" onClick={() => onEnd(trip)} className="self-start inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-charcoal-light px-3 py-2 text-xs font-semibold"><CheckCircle2 className="w-4 h-4" /> End trip</button>}
    </div>
  );
}

export default function Trips() {
  const { data: org, isLoading: orgLoading } = useOrganisation();
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: drivers, isLoading: driversLoading } = useDrivers();
  const startTrip = useStartTrip();
  const endTrip = useEndTrip();
  const [assetId, setAssetId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [message, setMessage] = useState('');
  const selectedAssetTrips = useAssetTrips(assetId || undefined);
  const fleetEnabled = org?.industry_mode === 'fleet' || org?.industry_mode === 'logistics';
  const activeDriverIds = useMemo(() => new Set((selectedAssetTrips.data ?? []).filter((trip) => trip.status === 'in_progress').map((trip) => trip.driver_id).filter(Boolean)), [selectedAssetTrips.data]);

  if (!orgLoading && !org) return <div className="px-4 pt-6"><EmptyState icon={RouteIcon} title="No organisation found" description="Your account isn't linked to an organisation yet." /></div>;
  if (!fleetEnabled && !orgLoading) return <div className="px-4 pt-6"><EmptyState icon={Car} title="Trips are not enabled" description="Switch the organisation to Fleet or Logistics mode to use trip operations." /></div>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!assetId) return setMessage('Select a vehicle first.');
    try {
      await startTrip.mutateAsync({
        asset_id: assetId,
        ...(driverId ? { driver_id: driverId } : {}),
        ...(startOdometer ? { start_odometer: Number(startOdometer) } : {}),
        ...(startLocation ? { start_location: startLocation } : {}),
        ...(purpose ? { purpose } : {}),
      });
      setStartLocation(''); setPurpose(''); setStartOdometer('');
      setMessage('Trip started successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start trip.');
    }
  };

  const finish = async (trip: Trip) => {
    try {
      const endOdometerRaw = window.prompt('End odometer (optional):', trip.start_odometer != null ? String(trip.start_odometer) : '') ?? '';
      const endLocation = window.prompt('End location (optional):', '') ?? '';
      const endOdometer = endOdometerRaw.trim() && Number.isFinite(Number(endOdometerRaw)) ? Number(endOdometerRaw) : undefined;
      await endTrip.mutateAsync({ id: trip.id, asset_id: trip.asset_id, ...(endOdometer != null ? { end_odometer: endOdometer } : {}), ...(endLocation ? { end_location: endLocation } : {}), status: 'completed' });
      setMessage('Trip completed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete trip.');
    }
  };

  const loading = assetsLoading || driversLoading;

  return (
    <div className="px-4 pt-6 pb-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div><p className="text-xs uppercase tracking-wide font-semibold text-gray-500">{org?.organisation_name} · {org?.industry_mode}</p><h1 className="font-heading font-bold text-2xl mt-1">Trips</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Plan, start and close vehicle movements while preserving the vehicle's operational history.</p></div>
        <Link to="/ops/admin/assets" className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-charcoal-light px-3 py-2 text-xs font-semibold"><Car className="w-4 h-4" /> Vehicles</Link>
      </div>

      <section className="card mb-6">
        <div className="flex items-center gap-2 mb-4"><Plus className="w-4 h-4 text-brand" /><h2 className="font-heading font-bold">Start a trip</h2></div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className="input" value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={loading}><option value="">Select vehicle</option>{(assets ?? []).map((asset) => <option key={asset.id} value={asset.id}>{asset.registration || asset.asset_number || asset.model || asset.id}</option>)}</select>
          <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)} disabled={loading}><option value="">Driver (optional)</option>{(drivers ?? []).filter((driver: Driver) => !activeDriverIds.has(driver.id)).map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name}</option>)}</select>
          <input className="input" placeholder="Start location" value={startLocation} onChange={(e) => setStartLocation(e.target.value)} />
          <input className="input" placeholder="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          <input className="input" inputMode="numeric" placeholder="Start odometer" value={startOdometer} onChange={(e) => setStartOdometer(e.target.value)} />
          <button type="submit" disabled={startTrip.isPending || loading} className="btn-primary inline-flex items-center justify-center gap-2">{startTrip.isPending ? 'Starting…' : 'Start trip'}</button>
        </form>
        {message && <p className="text-xs text-gray-500 mt-3">{message}</p>}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3"><h2 className="font-heading font-bold">Vehicle trip history</h2>{assetId && <span className="text-xs text-gray-400">{selectedAssetTrips.data?.length ?? 0} trips</span>}</div>
        {!assetId ? <EmptyState icon={RouteIcon} title="Select a vehicle" description="Choose a vehicle above to review its trip history." /> : selectedAssetTrips.isLoading ? <SkeletonCard /> : selectedAssetTrips.isError ? <EmptyState icon={XCircle} title="Trips could not be loaded" description="Check connectivity and your organisation permissions." /> : selectedAssetTrips.data?.length ? <div className="space-y-3">{selectedAssetTrips.data.map((trip) => <TripRow key={trip.id} trip={trip} assets={assets} onEnd={finish} />)}</div> : <EmptyState icon={Clock3} title="No trips recorded" description="Start the first trip for this vehicle from the form above." />}
      </section>
    </div>
  );
}
