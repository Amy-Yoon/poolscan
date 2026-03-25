"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { fetchTokenPrices } from "@/lib/blockchain";
import { fmtTokenPrice, CHAINS, downloadCSV } from "@/lib/utils";
import { Loader2, ExternalLink, Download } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TokensPage() {
  const { tokens, pools, chainId, isLoading, metadata } = useApp();
  const explorerUrl = CHAINS.find(c => c.id === chainId)?.explorer || "";
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);

  const currentTokens = tokens.filter(t => t.chain_id === chainId);

  useEffect(() => {
    async function loadPrices() {
      if (currentTokens.length === 0) return;
      setIsFetchingPrices(true);
      try {
        const addrs = currentTokens.map(t => t.address);
        const results = await fetchTokenPrices(addrs, chainId, pools, currentTokens, metadata);
        console.log("[TokenManager] price results:", results.slice(0, 3));
        const priceMap: Record<string, string> = {};
        results.forEach(r => {
          priceMap[r.address.toLowerCase()] = r.price;
        });
        setPrices(priceMap);
      } catch (e) {
        console.error("Failed to load prices", e);
      } finally {
        setIsFetchingPrices(false);
      }
    }
    loadPrices();
  }, [chainId, tokens]);

  const getPrice = (addr: string) => {
    const p = prices[addr.toLowerCase()];
    return p && Number(p) > 0 ? p : null;
  };

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["chain_id", "address", "symbol", "name", "decimals", "price_usd"],
    ];
    currentTokens.forEach(t => {
      const price = prices[t.address.toLowerCase()] ?? "";
      rows.push([t.chain_id, t.address, t.symbol, t.name, t.decimals, price]);
    });
    downloadCSV(rows, "tokens.csv");
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Token Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Token registry with live price data</p>
        </div>
        <div className="flex items-center gap-3">
          {isFetchingPrices && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
              <Loader2 size={12} className="animate-spin" />
              Fetching prices…
            </div>
          )}
          {currentTokens.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              <Download size={13} />
              Export
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {currentTokens.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 w-10 text-center">#</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500">Symbol / Name</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 text-right">Price (USD)</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 text-center">Decimals</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 text-center">Explorer</th>
              </tr>
            </thead>
            <tbody>
              {currentTokens.map((token, idx) => {
                const price = getPrice(token.address);
                return (
                  <tr key={token.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-[12px] text-gray-400 text-center">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-gray-900">{token.symbol}</div>
                      <div className="text-[12px] text-gray-400 mt-0.5">{token.name}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {isFetchingPrices && !price ? (
                        <span className="text-[11px] text-gray-300">—</span>
                      ) : price ? (
                        <span className="text-sm font-semibold text-blue-600">
                          ${fmtTokenPrice(price)}
                        </span>
                      ) : (
                        <span className="text-[12px] text-gray-300 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-gray-700 text-center font-mono">{token.decimals}</td>
                    <td className="px-5 py-3.5 text-center">
                      {explorerUrl ? (
                        <a
                          href={`${explorerUrl.replace(/\/$/, "")}/address/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-gray-400 hover:text-blue-600 transition-colors"
                          title={token.address}
                        >
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No tokens registered" height="h-48" />
        )}
      </div>
    </div>
  );
}
