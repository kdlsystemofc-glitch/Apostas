import React, { useState } from "react";
import { useBankrollStore } from "@/store/useBankrollStore";
import { Wallet, Settings, Check } from "lucide-react";

export default function BankrollWidget() {
  const { totalBankroll, kellyFraction, setTotalBankroll, setKellyFraction } = useBankrollStore();
  const [isOpen, setIsOpen] = useState(false);
  const [tempBankroll, setTempBankroll] = useState(totalBankroll.toString());

  const handleSave = () => {
    const val = parseFloat(tempBankroll);
    if (!isNaN(val) && val >= 0) {
      setTotalBankroll(val);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Botão Widget no Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60 transition-all text-xs font-bold shadow-sm"
        title="Configurar Gestão de Banca em Reais"
      >
        <Wallet className="w-3.5 h-3.5 text-emerald-400" />
        <span>Banca: <strong>R$ {totalBankroll.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        <span className="bg-emerald-500/20 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30">
          {kellyFraction === 0.25 ? "Quarter-Kelly" : "Half-Kelly"}
        </span>
      </button>

      {/* Modal / Popover de Configuração */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50 text-white backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <h4 className="font-bold text-xs flex items-center gap-1.5 text-emerald-400">
              <Settings className="w-3.5 h-3.5" /> Gestão de Banca & Risco
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Banca Total (R$):</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">R$</span>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={tempBankroll}
                  onChange={(e) => setTempBankroll(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Fração de Kelly (Risco):</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setKellyFraction(0.25)}
                  className={`py-1 px-2 rounded font-semibold border text-center transition-all ${
                    kellyFraction === 0.25
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  Quarter (25%)
                </button>
                <button
                  onClick={() => setKellyFraction(0.50)}
                  className={`py-1 px-2 rounded font-semibold border text-center transition-all ${
                    kellyFraction === 0.50
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  Half (50%)
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full mt-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-lg flex items-center justify-center gap-1 transition-all"
            >
              <Check className="w-3.5 h-3.5" /> Salvar Configurações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
