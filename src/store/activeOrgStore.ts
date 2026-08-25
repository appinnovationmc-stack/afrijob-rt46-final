import { create } from 'zustand';

// A profile can belong to more than one organisation (e.g. owner of one,
// admin of another) — useOrganisation() needs to know which one is
// "current" instead of picking an arbitrary row back from Supabase.
// Persisted to localStorage so the choice survives a refresh/relaunch,
// same reasoning as why activeWorkshop exists in workshopStore.
const STORAGE_KEY = 'afrijob:active_org_id';

interface ActiveOrgState {
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
}

function readStored(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw in private-browsing/disabled-storage contexts
    return null;
  }
}

export const useActiveOrgStore = create<ActiveOrgState>((set) => ({
  activeOrgId: readStored(),
  setActiveOrgId: (id) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // best-effort persistence only; in-memory state below still updates
    }
    set({ activeOrgId: id });
  },
}));
