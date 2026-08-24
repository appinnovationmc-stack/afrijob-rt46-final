import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Key, Copy, X, Info } from 'lucide-react';
import {
  useApiKeys, useCreateApiKey, useRevokeApiKey,
  API_KEY_SCOPES, API_KEY_SCOPE_LABELS, type ApiKeyScope,
} from '@/hooks/useApiKeys';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { formatDate, cn } from '@/lib/utils';

export default function ApiKeys() {
  const { data: keys, isLoading } = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const push = useToastStore((s) => s.push);

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);
  const [justCreated, setJustCreated] = useState<{ raw_key: string; key_prefix: string } | null>(null);

  function toggleScope(s: ApiKeyScope) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0) return;
    try {
      const result = await create.mutateAsync({ name: name.trim(), scopes });
      setJustCreated(result);
      setName('');
      setScopes([]);
      push('API key created', 'success');
    } catch (err: any) {
      push(err.message ?? 'Failed to create API key', 'error');
    }
  }

  const activeKeys = (keys ?? []).filter((k) => !k.revoked_at);
  const revokedKeys = (keys ?? []).filter((k) => k.revoked_at);

  return (
    <div className="px-4 pt-6 pb-24">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="mb-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5"><Key className="w-4 h-4" /> Integrations</p>
        <h1 className="font-heading font-bold text-2xl">API keys</h1>
      </div>

      <div className="card mb-4 flex gap-2.5 items-start bg-blue-50 dark:bg-blue-950/30 border-none">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Give an external system (accounting, ERP, telematics) its own key to read work orders or push cost updates.
          The full key is shown once, right after you create it — after that only the prefix is visible, so store it
          somewhere safe immediately.
        </p>
      </div>

      <div className="card mb-4">
        <p className="font-semibold text-sm mb-3">Create a key</p>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="e.g. Sage accounting sync"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            {API_KEY_SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                {API_KEY_SCOPE_LABELS[s]}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="btn-primary !py-2 !px-4 self-start"
            disabled={create.isPending || !name.trim() || scopes.length === 0}
          >
            Create key
          </button>
        </form>

        {justCreated && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2.5">
            <p className="text-[11px] font-semibold text-warning uppercase tracking-wide mb-1.5">
              Copy this now — it won't be shown again
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono break-all flex-1">{justCreated.raw_key}</p>
              <button
                type="button"
                className="btn-secondary !py-1 !px-2 shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(justCreated.raw_key);
                  push('Copied', 'success');
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="btn-secondary !py-1 !px-2 shrink-0" onClick={() => setJustCreated(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div>
      ) : !keys?.length ? (
        <EmptyState icon={Key} title="No API keys yet" description="Create one above to let an external system connect." />
      ) : (
        <div className="space-y-4">
          {activeKeys.length > 0 && (
            <div className="space-y-2">
              {activeKeys.map((k) => (
                <div key={k.id} className="card flex items-start justify-between !py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{k.key_prefix}…</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {k.scopes.map((s) => API_KEY_SCOPE_LABELS[s as ApiKeyScope] ?? s).join(', ')}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      {k.last_used_at ? `Last used ${formatDate(k.last_used_at)}` : 'Never used'} · created {formatDate(k.created_at)}
                    </p>
                  </div>
                  <button
                    className="btn-secondary !py-1.5 !px-2.5 !text-danger shrink-0"
                    disabled={revoke.isPending}
                    onClick={async () => {
                      if (!confirm(`Revoke "${k.name}"? Anything using it will stop working immediately.`)) return;
                      try {
                        await revoke.mutateAsync(k.id);
                        push('Key revoked', 'success');
                      } catch (err: any) {
                        push(err.message ?? 'Failed to revoke key', 'error');
                      }
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {revokedKeys.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Revoked</p>
              <div className="space-y-2">
                {revokedKeys.map((k) => (
                  <div key={k.id} className="card !py-3 opacity-60">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className={cn('text-xs font-mono text-gray-500 dark:text-gray-400')}>{k.key_prefix}…</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Revoked {formatDate(k.revoked_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
