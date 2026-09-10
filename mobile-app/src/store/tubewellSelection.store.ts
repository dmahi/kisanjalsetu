import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

interface State {
  farmerTubewellId: string | null;
  ownerTubewellId: string | null;
  setFarmerTubewell: (id: string | null) => Promise<void>;
  setOwnerTubewell: (id: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
}

const KEYS = {
  farmer: 'waterapp.selected_farmer_tubewell',
  owner: 'waterapp.selected_owner_tubewell',
};

async function read(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  if (value) return value;
  return localStorage.getItem(key);
}

async function write(key: string, id: string): Promise<void> {
  localStorage.setItem(key, id);
  await Preferences.set({ key, value: id });
}

async function clear(key: string): Promise<void> {
  localStorage.removeItem(key);
  await Preferences.remove({ key });
}

export const useSelectionStore = create<State>((set) => ({
  farmerTubewellId: null,
  ownerTubewellId: null,

  setFarmerTubewell: async (id) => {
    if (id) {
      await write(KEYS.farmer, id);
      set({ farmerTubewellId: id });
    } else {
      await clear(KEYS.farmer);
      set({ farmerTubewellId: null });
    }
  },

  setOwnerTubewell: async (id) => {
    if (id) {
      await write(KEYS.owner, id);
      set({ ownerTubewellId: id });
    } else {
      await clear(KEYS.owner);
      set({ ownerTubewellId: null });
    }
  },

  hydrate: async () => {
    const [farmer, owner] = await Promise.all([read(KEYS.farmer), read(KEYS.owner)]);
    set({ farmerTubewellId: farmer, ownerTubewellId: owner });
  },
}));