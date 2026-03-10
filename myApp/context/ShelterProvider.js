
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/sheltersSupabase";
import { fetchSheltersWithCache } from "../src/services/shelterCacheService";

const ShelterContext = createContext(null);

const SHELTER_CACHE_KEY = "shelters-cache-v1";

// change to true to simulate offline mode for testing offline caching behavior
// must first cache data while online
const FORCE_OFFLINE = false;

async function fetchSheltersWithCache(
  setShelters,
  setLoading,
  setError,
  setLastUpdated
) {
  setLoading(true);
  setError(null);

  try {
    if (FORCE_OFFLINE) {
      throw new Error("Simulated offline mode");
    }

    const { data, error } = await supabase
      .from("shelters")
      .select("*")
      .eq("state", "LA"); // all Louisiana shelters

    if (error) {
      throw error;
    }

    const rows = data || [];
    setShelters(rows);

    //save to cache
    const payload = {
      updatedAt: Date.now(),
      shelters: rows,
    };

    try {
      await AsyncStorage.setItem(
        SHELTER_CACHE_KEY,
        JSON.stringify(payload)
      );
      setLastUpdated(payload.updatedAt);
    } catch (cacheErr) {
      console.warn("Failed to cache shelters:", cacheErr);
    }
  } catch (err) {
    console.warn(
      "Shelter fetch failed, attempting to use cache:",
      err.message
    );

    try {
      const cached = await AsyncStorage.getItem(
        SHELTER_CACHE_KEY
      );
      if (cached) {
        const parsed = JSON.parse(cached);
        const rows = parsed.shelters || [];
        setShelters(rows);
        setLastUpdated(parsed.updatedAt || null);

        setError(
          "Showing last saved shelter list. Some info may be out of date until you're back online."
        );
      } else {
        setShelters([]);
        setError(
          "Unable to load shelters. Check your connection and try again."
        );
      }
    } catch (cacheErr) {
      console.error("Error reading shelters cache:", cacheErr);
      setShelters([]);
      setError(
        "Unable to load shelters. Check your connection and try again."
      );
    }
  } finally {
    setLoading(false);
  }
}

export function ShelterProvider({ children }) {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchSheltersWithCache(
      setShelters,
      setLoading,
      setLoadError,
      setLastUpdated
    );
  }, []);

  const value = {
    shelters,
    loading,
    loadError,
    lastUpdated,
    refreshShelters: () =>
      fetchSheltersWithCache(
        setShelters,
        setLoading,
        setLoadError,
        setLastUpdated
      )
  };

  return (
    <ShelterContext.Provider value={value}>
      {children}
    </ShelterContext.Provider>
  );
}

export function useShelters() {
  const ctx = useContext(ShelterContext);
  if (!ctx) {
    throw new Error("useShelters must be used within a ShelterProvider");
  }
  return ctx;
}
