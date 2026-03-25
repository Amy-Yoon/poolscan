"use client";

import React, { useState } from "react";
import { SearchResult } from "@/lib/blockchain";
import { insertPool, insertWallet, upsertToken } from "@/lib/db";
import { useApp } from "@/context/AppContext";

interface SearchModalProps {
  result: SearchResult;
  onClose: () => void;
}

export function SearchModal({ result, onClose }: SearchModalProps) {
  const { refreshData } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState("");

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      if (result.type === "token") {
        // Only store address + chain_id; metadata comes from on-chain at runtime
        await upsertToken({
          address: result.address,
          chain_id: result.chainId,
          price: null,
        });
      } else if (result.type === "pool_v2" || result.type === "pool_v3") {
        // Only store address + chain_id + status; metadata comes from on-chain
        await insertPool({
          address: result.address,
          chain_id: result.chainId,
          status: "a",
        });
      } else if (result.type === "wallet") {
        await insertWallet({
          address: result.address,
          chain_id: result.chainId,
          label: label || "New Wallet",
        });
      }
      
      await refreshData();
      alert("Successfully registered!");
      onClose();
    } catch (e) {
      console.error(e);
      alert("An error occurred during registration.");
    } finally {
      setIsAdding(false);
    }
  };

  const isWallet = result.type === "wallet";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] w-full max-w-[440px] shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-[20px] font-black text-gray-900 tracking-tight">Search Result</h2>
              <p className="text-[13px] text-gray-400 font-medium">On-chain data found for this address</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                result.type === 'token' ? 'bg-blue-100 text-blue-600' :
                result.type.includes('pool') ? 'bg-green-100 text-green-600' :
                'bg-amber-100 text-amber-600'
              }`}>
                {result.type.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-mono text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100">
                Chain ID: {result.chainId}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Address</label>
                <div className="text-[13px] font-mono font-bold text-gray-800 break-all bg-white p-2 rounded-lg border border-gray-100">
                  {result.address}
                </div>
              </div>

              {result.type === "token" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Symbol</label>
                    <div className="text-[14px] font-black text-gray-900">{result.data.symbol}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Decimals</label>
                    <div className="text-[14px] font-black text-gray-900">{result.data.decimals}</div>
                  </div>
                </div>
              )}

              {result.type.includes("pool") && (
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-white rounded-xl border border-gray-100">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Version</span>
                    <span className="text-[11px] font-black text-gray-900">{result.data.version}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white rounded-xl border border-gray-100">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Fee</span>
                    <span className="text-[11px] font-black text-gray-900">{result.data.fee}%</span>
                  </div>
                </div>
              )}

              {isWallet && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[12px] font-medium text-blue-600 italic">
                  This address appears to be an EOA (externally owned account) with no contract code.
                </div>
              )}
            </div>
          </div>

          {/* Label input: only for wallets */}
          {isWallet && result.type !== "unknown" && (
            <div className="mb-8">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5 px-1">
                Wallet Label (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. My Main Wallet"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full h-12 bg-white border border-gray-200 rounded-2xl px-5 text-[13px] font-bold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-300 shadow-sm"
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl border border-gray-200 text-gray-500 font-black text-[13px] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isAdding || result.type === "unknown"}
              className="flex-2 h-12 bg-blue-500 text-white rounded-2xl font-black text-[13px] px-8 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25 active:scale-95"
            >
              {isAdding ? "Adding…" : "Add to List"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
