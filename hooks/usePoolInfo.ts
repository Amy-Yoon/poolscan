import { useState, useEffect } from "react";
import { getPoolData } from "@/lib/blockchain";
import { isAddress } from "viem";

export function usePoolInfo(address: string, chainId: number) {
  const [info, setInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAddress(address)) {
      setInfo(null);
      setError(null);
      return;
    }

    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPoolData(address, chainId);
        if (active) setInfo(result);
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => { active = false; };
  }, [address, chainId]);

  return { info, loading, error };
}
