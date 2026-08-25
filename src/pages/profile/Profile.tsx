import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuthStore } from '@/store/authStore';
import { useWorkshopStore } from '@/store/workshopStore';
import { useOrganisation, useOrganisationMemberships } from '@/hooks/useOrganisation';
import { useActiveOrgStore } from '@/store/activeOrgStore';
import { useToastStore } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { Moon, Sun, LogOut, Building2, Layers, Check } from 'lucide-react';

interface WorkshopForm {
  name: string;
  address: string;
  contact_phone: string;
  contact_email: string;
}

export default function Profile() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const workshop = useWorkshopStore((s) => s.activeWorkshop);
  const { data: currentOrg } = useOrganisation();
  const { data: allMemberships } = useOrganisationMemberships();
  const setActiveOrgId = useActiveOrgStore((s) => s.setActiveOrgId);
  const push = useToastStore((s) => s.push);
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit } = useForm<WorkshopForm>({
    defaultValues: {
      name: workshop?.name ?? '',
      address: workshop?.address ?? '',
      contact_phone: workshop?.contact_phone ?? '',
      contact_email: workshop?.contact_email ?? '',
    },
  });

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const onSave = async (values: WorkshopForm) => {
    if (!workshop) return;
    setSaving(true);
    const { error } = await supabase.from('workshops').update(values).eq('id', workshop.id);
    setSaving(false);
    push(error ? error.message : 'Workshop details saved', error ? 'error' : 'success');
  };

  return (
    <div>
      <PageHeader title="Profile & Settings" />
      <div className="px-4 py-4 flex flex-col gap-6">
        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center text-white font-heading font-bold text-lg">
            {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-semibold">{profile?.full_name ?? 'Unnamed'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{profile?.phone ?? 'No phone on file'}</p>
          </div>
        </div>

        {allMemberships && allMemberships.length > 1 && (
          <div className="card flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-brand" />
              <h3 className="font-heading font-bold">Organisation</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-1">
              You belong to more than one organisation. Pick which one you're working in.
            </p>
            {allMemberships.map((m) => {
              const isActive = m.organisation_id === currentOrg?.organisation_id;
              return (
                <button
                  key={m.organisation_id}
                  type="button"
                  onClick={() => setActiveOrgId(m.organisation_id)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand'
                      : 'bg-gray-50 dark:bg-gray-900 border border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.organisation_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{m.role}</p>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-brand shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit(onSave)} className="card flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-brand" />
            <h3 className="font-heading font-bold">Workshop Details</h3>
          </div>
          <input className="input" placeholder="Workshop name" {...register('name')} />
          <input className="input" placeholder="Address" {...register('address')} />
          <input className="input" placeholder="Contact phone" {...register('contact_phone')} />
          <input className="input" placeholder="Contact email" {...register('contact_email')} />
          <button type="submit" disabled={saving} className="btn-primary mt-1">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>

        <button onClick={toggleDarkMode} className="card flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium">
            {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            Dark Mode
          </span>
          <div className={`w-11 h-6 rounded-full transition-colors ${darkMode ? 'bg-brand' : 'bg-gray-300'} relative`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </button>

        <button onClick={signOut} className="card flex items-center gap-2 text-danger font-semibold">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
