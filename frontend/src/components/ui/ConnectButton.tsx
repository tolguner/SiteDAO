"use client";

import { useConnectWallet, useWallets, useCurrentAccount } from "@mysten/dapp-kit";
import { Wallet } from "lucide-react";

interface ConnectButtonProps {
  onConnect?: () => void;
}

export function ConnectButton({ onConnect }: ConnectButtonProps) {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();

  // Eğer bağlı ise gösterme
  if (account) {
    return null;
  }

  const handleConnect = (wallet: any) => {
    connect(
      { wallet },
      {
        onSuccess: () => {
          console.log("Cüzdan bağlandı:", wallet.name);
          onConnect?.();
        },
        onError: (error) => {
          console.error("Bağlantı hatası:", error);

          // Phantom Sui desteklemiyor olabilir
          if (wallet.name.toLowerCase().includes("phantom")) {
            alert("Phantom cüzdanı şu anda Sui blockchain'i tam olarak desteklemiyor olabilir. Lütfen Sui Wallet, Slush veya Suiet cüzdanlarından birini deneyin.");
          } else {
            alert(`Bağlantı hatası: ${error.message || "Bilinmeyen hata"}`);
          }
        },
      }
    );
  };

  // Cüzdan yoksa direkt indirme linki göster
  if (wallets.length === 0) {
    return (
      <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <p className="text-sm text-muted-foreground mb-2">Yüklü cüzdan bulunamadı</p>
        <a
          href="https://suiwallet.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline text-sm"
        >
          Sui Wallet İndir
        </a>
      </div>
    );
  }

  // Cüzdanlar varsa listele
  return (
    <div className="space-y-2">
      <p className="text-xs text-center text-muted-foreground">Cüzdan Seçin</p>
      {wallets.map((wallet) => (
        <button
          key={wallet.name}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleConnect(wallet);
          }}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
        >
          {wallet.icon && (
            <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 rounded" />
          )}
          <span className="font-medium">{wallet.name}</span>
        </button>
      ))}
    </div>
  );
}
