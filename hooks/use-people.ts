"use client";

import { useCallback, useEffect, useState } from "react";
import { getPeople } from "@/lib/storage/profiles";
import type { PersonProfile } from "@/lib/types/person";

export function usePeople() {
  const [people, setPeople] = useState<PersonProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await getPeople();
      setPeople(list);
      setStorageError(null);
    } catch {
      setStorageError("Profiles can’t be read in this browser session (private mode or blocked storage).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { people, loading, storageError, refresh };
}
