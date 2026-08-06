import { create } from "zustand";

export const useBankrollStore = create((set, get) => ({
  totalBankroll: 1000.0, // Banca padrão R$ 1.000,00
  kellyFraction: 0.25,   // Quarter Kelly (25%)

  setTotalBankroll: (amount) => set({ totalBankroll: Math.max(0, parseFloat(amount) || 0) }),
  setKellyFraction: (fraction) => set({ kellyFraction: Math.max(0.05, Math.min(1.0, parseFloat(fraction) || 0.25)) }),

  // Retorna a sugestão de aposta em R$ dado o % do Kelly
  calculateStakeAmount: (stakePct) => {
    const bankroll = get().totalBankroll;
    const pct = parseFloat(stakePct) || 0;
    return Math.round((bankroll * (pct / 100)) * 100) / 100;
  },
}));
