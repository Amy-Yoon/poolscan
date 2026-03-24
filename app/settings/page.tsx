"use client";

import { useState, useEffect } from "react";
import { CHAINS } from "@/lib/utils";
import {
  saveChainConfigs,
  ChainConfigOverride,
  ChainConfigs,
} from "@/lib/blockchain";
import { Plus, Trash2, Save, RotateCcw, Info, ChevronDown } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────
function loadChainConfigs(): ChainConfigs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("poolscan_chain_configs");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function emptyOverride(): ChainConfigOverride {
  return { rpcUrl: "", explorer: "", gateways: [""], nfpm: "", nfph: "" };
}

// ── field component ──────────────────────────────────────────
function Field({
  label, value, placeholder, onChange, mono = true,
}: {
  label: string; value: string; placeholder?: string;
  onChange: (v: string) => void; mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-900",
          "placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all",
          mono ? "font-mono" : "",
        ].join(" ")}
      />
    </div>
  );
}

// ── gateway list component ────────────────────────────────────
function GatewayList({
  gateways, onChange,
}: {
  gateways: string[];
  onChange: (gateways: string[]) => void;
}) {
  const update = (idx: number, val: string) => {
    const next = [...gateways];
    next[idx] = val;
    onChange(next);
  };
  const add = () => onChange([...gateways, ""]);
  const remove = (idx: number) => {
    const next = gateways.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : [""]);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-gray-500 uppercase tracking-wider">
        Gateway Addresses
      </label>
      <div className="space-y-2">
        {gateways.map((gw, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="text"
              value={gw}
              onChange={e => update(idx, e.target.value)}
              placeholder="0x…"
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-900 font-mono placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <button
              onClick={() => remove(idx)}
              disabled={gateways.length === 1 && gw === ""}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        className="flex items-center gap-1.5 text-[12px] text-blue-500 hover:text-blue-700 transition-colors mt-1"
      >
        <Plus size={12} /> Add Gateway
      </button>
    </div>
  );
}

// ── default badge ─────────────────────────────────────────────
function DefaultBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-100 rounded px-2 py-0.5 font-mono truncate max-w-full">
      {label}
    </span>
  );
}

// ── main page ─────────────────────────────────────────────────
export default function SettingsPage() {
  const [configs, setConfigs] = useState<ChainConfigs>({});
  const [activeChain, setActiveChain] = useState<number>(CHAINS[0].id);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loaded = loadChainConfigs();
    // Ensure each chain has an entry (prefill with empty)
    const full: ChainConfigs = {};
    CHAINS.forEach(c => {
      full[String(c.id)] = loaded[String(c.id)] || emptyOverride();
      // normalise gateways array
      if (!full[String(c.id)].gateways || (full[String(c.id)].gateways as string[]).length === 0) {
        full[String(c.id)].gateways = [""];
      }
    });
    setConfigs(full);
  }, []);

  const currentChain = CHAINS.find(c => c.id === activeChain)!;
  const override = configs[String(activeChain)] || emptyOverride();

  const updateField = (field: keyof ChainConfigOverride, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [String(activeChain)]: { ...prev[String(activeChain)], [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveChainConfigs(configs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setConfigs(prev => ({
      ...prev,
      [String(activeChain)]: emptyOverride(),
    }));
    setSaved(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-gray-900">Settings</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Configure per-chain RPC, Explorer and contract addresses. Leave fields blank to use built-in defaults.
        </p>
      </div>

      {/* Chain Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {CHAINS.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveChain(c.id)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-all border-b-2 -mb-px",
              activeChain === c.id
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300",
            ].join(" ")}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      {/* Config form card */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">

        {/* Network section */}
        <div className="p-6 space-y-5 border-b border-gray-100">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Network</p>

          <div className="space-y-4">
            <div>
              <Field
                label="RPC URL"
                value={override.rpcUrl || ""}
                placeholder={`e.g. ${currentChain.rpcUrl}`}
                onChange={v => updateField("rpcUrl", v)}
              />
              {!override.rpcUrl && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Info size={11} /> Default: <DefaultBadge label={currentChain.rpcUrl} />
                </div>
              )}
            </div>

            <div>
              <Field
                label="Explorer URL"
                value={override.explorer || ""}
                placeholder={`e.g. ${currentChain.explorer}`}
                onChange={v => updateField("explorer", v)}
              />
              {!override.explorer && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Info size={11} /> Default: <DefaultBadge label={currentChain.explorer} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contracts section */}
        <div className="p-6 space-y-5 border-b border-gray-100">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Contracts</p>

          <div className="space-y-4">
            <GatewayList
              gateways={(override.gateways && override.gateways.length > 0) ? override.gateways : [""]}
              onChange={v => updateField("gateways", v)}
            />
            {(!(override.gateways?.some(g => g.trim()))) && currentChain.gateways.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Info size={11} /> Default:
                </div>
                {currentChain.gateways.map((gw, i) => (
                  <DefaultBadge key={i} label={gw} />
                ))}
              </div>
            )}

            <div>
              <Field
                label="NFPM Address (V3 Position Manager)"
                value={override.nfpm || ""}
                placeholder={currentChain.nfpm ? `e.g. ${currentChain.nfpm}` : "0x…"}
                onChange={v => updateField("nfpm", v)}
              />
              {!override.nfpm && currentChain.nfpm && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Info size={11} /> Default: <DefaultBadge label={currentChain.nfpm} />
                </div>
              )}
            </div>

            <div>
              <Field
                label="NFPH Address (V3 Position Helper)"
                value={override.nfph || ""}
                placeholder={currentChain.nfph ? `e.g. ${currentChain.nfph}` : "0x…"}
                onChange={v => updateField("nfph", v)}
              />
              {!override.nfph && currentChain.nfph && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Info size={11} /> Default: <DefaultBadge label={currentChain.nfph} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RotateCcw size={13} />
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            className={[
              "flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium transition-all",
              saved
                ? "bg-green-100 text-green-700"
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95",
            ].join(" ")}
          >
            <Save size={13} />
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[13px] text-blue-700 space-y-2">
        <p className="font-medium">How settings work</p>
        <p className="text-blue-600 leading-relaxed">
          Settings are saved to your browser&apos;s local storage. Any field left blank falls back to the built-in
          default. Changes take effect immediately — no page reload required.
        </p>
        <p className="text-blue-600 leading-relaxed">
          You can use the <strong>내보내기 (Export)</strong> button in the header to backup all your pools, wallets,
          tokens and import the <strong>wemix-default-config.json</strong> to populate a fresh setup.
        </p>
      </div>
    </div>
  );
}
