// __tests__/shelterCacheService.test.js

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

// Mock supabase chain: supabase.from().select().eq()
const mockEq = jest.fn();
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("../lib/sheltersSupabase", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const { fetchSheltersWithCache } = require("../src/services/shelterCacheService");

function makeSetters() {
  return {
    setShelters: jest.fn(),
    setLoading: jest.fn(),
    setError: jest.fn(),
    setLastUpdated: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("success: fetches shelters from Supabase and caches them", async () => {
  const rows = [{ id: 1, name: "Shelter A", state: "LA" }];
  mockEq.mockResolvedValueOnce({ data: rows, error: null });

  const { setShelters, setLoading, setError, setLastUpdated } = makeSetters();

  await fetchSheltersWithCache(setShelters, setLoading, setError, setLastUpdated);

  expect(setLoading).toHaveBeenCalledWith(true);
  expect(setError).toHaveBeenCalledWith(null);

  expect(mockFrom).toHaveBeenCalledWith("shelters");
  expect(setShelters).toHaveBeenCalledWith(rows);
  expect(AsyncStorage.setItem).toHaveBeenCalled();
  expect(setLastUpdated).toHaveBeenCalled();
  expect(setLoading).toHaveBeenLastCalledWith(false);
});

test("failure: uses cached shelters when Supabase fetch fails", async () => {
  mockEq.mockResolvedValueOnce({ data: null, error: new Error("network") });

  const cachedPayload = {
    updatedAt: 123456,
    shelters: [{ id: 2, name: "Cached Shelter", state: "LA" }],
  };
  AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cachedPayload));

  const { setShelters, setLoading, setError, setLastUpdated } = makeSetters();

  await fetchSheltersWithCache(setShelters, setLoading, setError, setLastUpdated);

  expect(AsyncStorage.getItem).toHaveBeenCalled();
  expect(setShelters).toHaveBeenCalledWith(cachedPayload.shelters);
  expect(setLastUpdated).toHaveBeenCalledWith(cachedPayload.updatedAt);
  expect(setError).toHaveBeenCalledWith(
    expect.stringContaining("Showing last saved shelter list")
  );
  expect(setLoading).toHaveBeenLastCalledWith(false);
});

test("failure: no cache shows user-friendly error", async () => {
  mockEq.mockResolvedValueOnce({ data: null, error: new Error("network") });
  AsyncStorage.getItem.mockResolvedValueOnce(null);

  const { setShelters, setLoading, setError, setLastUpdated } = makeSetters();

  await fetchSheltersWithCache(setShelters, setLoading, setError, setLastUpdated);

  expect(setShelters).toHaveBeenCalledWith([]);
  expect(setError).toHaveBeenCalledWith(
    expect.stringContaining("Unable to load shelters")
  );
  expect(setLoading).toHaveBeenLastCalledWith(false);
});