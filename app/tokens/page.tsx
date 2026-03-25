"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { fetchTokenPrices } from "@/lib/blockchain";
import { fmtTokenPrice, CHAINS, downloadCSV } from "@/lib/utils";
import { Loader2, ExternalLink, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type SortDir = "none" | "asc" | "desc";

export default function TokensPage() {
  const { tokens, pools, chainId, metadata, tokenMetadata } = useApp();
  const explorerUrl = CHAINS.find(c => c.id === chainId)?.explorer || "";
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [priceSortDir, setPriceSortDir] = useState<SortDir>("none");

  const currentTokens = tokens.filter(t => t.chain_id === chainId);

  useEffect(() => {
    async function loadPrices() {
      if (currentTokens.length === 0) return;
      setIsFetchingPrices(true);
      try {
        const addrs = currentTokens.map(t => t.address);
        // Build registeredTokens list from tokenMetadata for symbol recognition
        const regTokens = Object.entries(tokenMetadata).map(([addr, m]) => ({ address: addr, symbol: m.symbol }));
        const results = await fetchTokenPrices(addrs, chainId, pools, regTokens, metadata);
        const priceMap: Record<string, string> = {};
        results.forEach(r => {
          priceMap[r.address.toLowerCase()] = r.price;
        });
        // Apply fixed price overrides from DB
        currentTokens.forEach(t => {
          if (t.price) priceMap[t.address.toLowerCase()] = t.price;
        });
        setPrices(priceMap);
      } catch (e) {
        console.error("Failed to load prices", e);
      } finally {
        setIsFetchingPrices(false);
      }
    }
    loadPrices();
  }, [chainId, tokens, tokenMetadata]);

  const getPrice = (addr: string) => {
    const p = prices[addr.toLowerCase()];
    return p && Number(p) > 0 ? p : null;
  };

  const togglePriceSort = () => {
    setPriceSortDir(prev =>
      prev === "none" ? "desc" : prev === "desc" ? "asc" : "none"
    );
  };

  const sortedTokens = React.useMemo(() => {
    if (priceSortDir === "none") return currentTokens;
    return [...currentTokens].sort((a, b) => {
      const pa = Number(prices[a.address.toLowerCase()] ?? 0);
      const pb = Number(prices[b.address.toLowerCase()] ?? 0);
      return priceSortDir === "asc" ? pa - pb : pb - pa;
    });
  }, [currentTokens, prices, priceSortDir]);

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ["chain_id", "address", "symbol", "name", "decimals", "price_usd"],
    ];
    currentTokens.forEach(t => {
      const meta = tokenMetadata[t.address.toLowerCase()];
      const price = prices[t.address.toLowerCase()] ?? "";
      rows.push([
        t.chain_id,
        t.address,
        meta?.symbol ?? "",
        meta?.name ?? "",
        meta?.decimals ?? "",
        price,
      ]);
    });
    downloadCSV(rows, "tokens.csv");
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Token Manager</h1>
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {currentTokens.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 w-10 text-center">#</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500">Symbol / Name</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 text-right">
                  <button
                    onClick={togglePriceSort}
                    className="inline-flex items-center gap-1 ml-auto hover:text-gray-800 transition-colors"
                  >
                    Price (USD)
                    {priceSortDir === "none" && <ArrowUpDown size={11} className="text-gray-300" />}
                    {priceSortDir === "desc" && <ArrowDown size={11} className="text-blue-500" />}
                    {priceSortDir === "asc" && <ArrowUp size={11} className="text-blue-500" />}
                  </button>
                </th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 text-center">Decimals</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 text-center">Explorer</th>
              </tr>
            </thead>
            <tbody>
              {sortedTokens.map((token, idx) => {
                const meta = tokenMetadata[token.address.toLowerCase()];
                const price = getPrice(token.address);
                return (
                  <tr key={token.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-[12px] text-gray-400 text-center">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium text-gray-900">{meta?.symbol ?? <span className="text-gray-300 italic">—</span>}</div>
                      <div className="text-[12px] text-gray-400 mt-0.5">{meta?.name ?? ""}</div>
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
                    <td className="px-5 py-3.5 text-[13px] text-gray-700 text-center font-mono">
                      {meta?.decimals ?? <span className="text-gray-300">—</span>}
                    </td>
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
          </div>
        ) : (
          <EmptyState message="No tokens registered" height="h-48" />
        )}
      </div>
    </div>
  );
}
