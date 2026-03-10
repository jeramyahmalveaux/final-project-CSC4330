const AsyncStorage = require("@react-native-async-storage/async-storage");
const { supabase } = require("../../lib/sheltersSupabase");

const SHELTER_CACHE_KEY = "shelters-cache-v1";
const FORCE_OFFLINE = false;

async function fetchSheltersWithCache(setShelters, setLoading, setError, setLastUpdated) {
  setLoading(true);
  setError(null);

  try {
    if (FORCE_OFFLINE) throw new Error("Simulated offline mode");

    const { data, error } = await supabase
      .from("shelters")
      .select("*")
      .eq("state", "LA");

    if (error) throw error;

    const rows = data || [];
    setShelters(rows);

    const payload = { updatedAt: Date.now(), shelters: rows };

    try {
      await AsyncStorage.setItem(SHELTER_CACHE_KEY, JSON.stringify(payload));
      setLastUpdated(payload.updatedAt);
    } catch (cacheErr) {
      console.warn("Failed to cache shelters:", cacheErr);
    }
  } catch (err) {
    console.warn("Shelter fetch failed, attempting to use cache:", err.message);

    try {
      const cached = await AsyncStorage.getItem(SHELTER_CACHE_KEY);
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
        setError("Unable to load shelters. Check your connection and try again.");
      }
    } catch (cacheErr) {
      console.error("Error reading shelters cache:", cacheErr);
      setShelters([]);
      setError("Unable to load shelters. Check your connection and try again.");
    }
  } finally {
    setLoading(false);
  }
}

module.exports = { fetchSheltersWithCache };