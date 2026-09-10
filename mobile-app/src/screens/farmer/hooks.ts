import { useEffect, useState } from 'react';
import { customerTubewellApi, tubewellApi, type TubewellSearchResult } from '../../api/tubewells';
import { useSelectionStore } from '../../store/tubewellSelection.store';

export interface MyTubewell {
  membershipId: string;
  tubewellId: string;
  name: string;
  code: string;
  address: string;
  village: string | null;
  status: string;
  membershipStatus: string;
  ratePerHour: number;
}

/** Farmer's approved/requested tubewells. Returns memberships whose status is
 *  approved as the usable list. */
export function useMyTubewells(): {
  tubewells: MyTubewell[];
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [tubewells, setTubewells] = useState<MyTubewell[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const data = await customerTubewellApi.myTubewells();
      setTubewells(data || []);
      autoSelectIfNeeded(data || []);
    } catch {
      setTubewells([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return { tubewells, loading, reload };
}

function autoSelectIfNeeded(tubewells: MyTubewell[]) {
  const store = useSelectionStore.getState();
  const approved = tubewells.filter((t) => t.membershipStatus === 'approved');
  if (approved.length === 0) {
    if (store.farmerTubewellId) void store.setFarmerTubewell(null);
    return;
  }
  const current = store.farmerTubewellId;
  if (!current || !approved.some((t) => t.tubewellId === current)) {
    void store.setFarmerTubewell(approved[0].tubewellId);
  }
}

export function useSearchTubewells(search: string): { results: TubewellSearchResult[]; loading: boolean } {
  const [results, setResults] = useState<TubewellSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await tubewellApi.search({ search: search.trim() });
        if (!cancelled) setResults(data || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  return { results, loading };
}