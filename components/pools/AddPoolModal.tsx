"use client";

import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { usePoolInfo } from "@/hooks/usePoolInfo";
import { insertPool } from "@/lib/db";

interface AddPoolModalProps {
  onClose: () => void;
}

export function AddPoolModal({ onClose }: AddPoolModalProps) {
  const { chainId, refreshData } = useApp();
  const [address, setAddress] = useState("");
  const { info, loading, error } = usePoolInfo(address, chainId);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!info) return;
    setIsSaving(true);
    try {
      await insertPool({
        address,
        chain_id: chainId,
        status: "a",
      });
      refreshData();
      onClose();
    } catch (e) {
      alert("Failed to save pool: " + (e as any).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-[500px] rounded-3xl p-8 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Add Liquidity Pool</h2>
          <p className="text-sm text-gray-400 mt-1">Enter a pool address to auto-detect its metadata</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
              Pool Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="min-h-[100px] p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-center">
            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Auto-detecting pool info...
              </div>
            )}
            
            {!loading && info && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-900">{info.token0Symbol} / {info.token1Symbol}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded uppercase tabular-nums">
                    Uniswap {info.type.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[11px] text-gray-500">
                  <div>
                    <span className="block font-semibold text-gray-400 uppercase tracking-tighter mb-0.5">Fee Tier</span>
                    <span className="text-gray-700 font-bold text-xs">{info.fee}%</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-gray-400 uppercase tracking-tighter mb-0.5">Token0</span>
                    <span className="text-gray-700 font-mono text-[10px] truncate block">{info.token0}</span>
                  </div>
                </div>
              </div>
            )}

            {!loading && !info && address && !error && (
              <div className="text-center text-sm text-gray-400">Invalid address format</div>
            )}
            
            {error && (
              <div className="text-center text-sm text-red-400 font-medium">{error}</div>
            )}

            {!address && (
              <div className="text-center text-sm text-gray-300">Awaiting address input</div>
            )}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!info || isSaving}
            onClick={handleSave}
            className="flex-[2] h-12 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            {isSaving ? "Saving..." : "Add Pool"}
          </button>
        </div>
      </div>
    </div>
  );
}
