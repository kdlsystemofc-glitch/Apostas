import { create } from "zustand";

export const useMatchStore = create((set) => ({
  activeMatch: null,
  matchesHistory: [],
  pastedText: "",

  setActiveMatch: (match) => set({ activeMatch: match }),
  setMatchesHistory: (matches) => set({ matchesHistory: matches }),
  setPastedText: (text) => set({ pastedText: text }),
  clearActiveMatch: () => set({ activeMatch: null, pastedText: "" }),
}));
