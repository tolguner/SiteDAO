"use client";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import "@mysten/dapp-kit/dist/index.css";
import { ZkLoginProvider } from "./ZkLoginProvider";
import { ChainSyncProvider } from "./ChainSyncProvider";
import { NETWORK, SUI_RPC_URL } from "@/lib/constants";

// Ağ yapılandırması
// Aktif ağ SUI_RPC_URL üzerinden çözülür; böylece JSON-RPC sunan ve tarayıcıdan
// erişilebilen bir uç nokta tanımlanabilir.
const { networkConfig } = createNetworkConfig({
  [NETWORK]: { url: SUI_RPC_URL },
} as Record<string, { url: string }>);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networkConfig} defaultNetwork={NETWORK}>
          <WalletProvider autoConnect>
            <ZkLoginProvider>
              <ChainSyncProvider>
                {children}
              </ChainSyncProvider>
            </ZkLoginProvider>
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
