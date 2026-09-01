"use client";

import { useEffect, useState, useCallback } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { readChainState, isChainConfigured } from "@/lib/chain/read";
import { useSiteStore } from "@/lib/store";

/// Zincirdeki site durumunu okuyup store'a yazar
///
/// Sözleşme adresleri tanımlıysa daire, kiracı kartı, ilan, teklif ve hazine
/// zincirden okunur ve demo verisinin yerini alır. Adresler tanımsızsa uygulama
/// demo verisiyle çalışmaya devam eder.
export function ChainSyncProvider({ children }: { children: React.ReactNode }) {
  const suiClient = useSuiClient();
  const hydrateFromChain = useSiteStore((state) => state.hydrateFromChain);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!isChainConfigured()) return;

    try {
      const state = await readChainState(suiClient);
      hydrateFromChain(state);
      setError(null);
    } catch (err) {
      // Zincir okunamazsa uygulama son bilinen veriyle çalışmayı sürdürür
      console.error("Zincir durumu okunamadı:", err);
      setError(err instanceof Error ? err.message : "Zincir durumu okunamadı");
    }
  }, [suiClient, hydrateFromChain]);

  useEffect(() => {
    sync();

    // İşlemler zincire yazıldıkça durumu tazele
    const interval = setInterval(sync, 15_000);
    return () => clearInterval(interval);
  }, [sync]);

  return (
    <>
      {error && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 shadow dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Zincir durumu okunamadı, son bilinen veri gösteriliyor.
        </div>
      )}
      {children}
    </>
  );
}
