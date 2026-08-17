import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';

interface WorkshopState {
  activeWorkshop: Tables<'workshops'> | null;
  workshops: Tables<'workshops'>[];
  loading: boolean;
  loadWorkshops: (profileId: string) => Promise<void>;
  setActiveWorkshop: (workshop: Tables<'workshops'>) => void;
}

export const useWorkshopStore = create<WorkshopState>((set) => ({
  activeWorkshop: null,
  workshops: [],
  loading: false,

  loadWorkshops: async (profileId: string) => {
    set({ loading: true });
    // Owned workshops
    const { data: owned } = await supabase.from('workshops').select('*').eq('owner_id', profileId);
    // Workshops joined as a member
    const { data: memberRows } = await supabase
      .from('workshop_members')
      .select('workshop_id, workshops(*)')
      .eq('profile_id', profileId)
      .not('joined_at', 'is', null);

    const memberWorkshops = (memberRows ?? [])
      .map((r) => r.workshops)
      .filter((w): w is Tables<'workshops'> => !!w);

    const all = [...(owned ?? []), ...memberWorkshops];
    const deduped = Array.from(new Map(all.map((w) => [w.id, w])).values());

    set({
      workshops: deduped,
      activeWorkshop: deduped[0] ?? null,
      loading: false,
    });
  },

  setActiveWorkshop: (workshop) => set({ activeWorkshop: workshop }),
}));
