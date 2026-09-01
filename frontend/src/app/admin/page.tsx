"use client";

import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  Shield,
  Wallet,
  LayoutDashboard,
  Building,
  User,
  Home,
  CheckCircle,
  AlertCircle,
  Users,
  Search
} from "lucide-react";
import { useState, useEffect } from "react";
import { isAdminEmail } from "@/lib/constants";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore } from "@/lib/store";
import { UserProfileModal } from "@/components/modals/UserProfileModal";

export default function AdminPage() {
  const account = useCurrentAccount();
  const [mounted, setMounted] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ address: string; type: "owner" | "tenant" } | null>(null);

  // zkLogin desteği
  const { isConnected: zkLoginConnected, address: zkLoginAddress, email: zkLoginEmail } = useZkLogin();
  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;
  const isConnected = zkLoginConnected || !!account?.address;
  const userEmail = zkLoginEmail || "";

  // Yönetici kontrolü
  const isAdmin = isAdminEmail(userEmail);

  // Store'dan verileri al
  const apartments = useSiteStore((state) => state.apartments);
  const treasury = useSiteStore((state) => state.treasury);

  const treasuryBalance = treasury.balance / 1_000_000_000;
  const totalReceived = treasury.totalReceived / 1_000_000_000;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Cüzdan Bağlı Değil</h1>
        <p className="text-muted-foreground mb-4">
          Yönetici paneline erişmek için lütfen yetkili cüzdan ile bağlanın.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-full mb-4">
          <Shield className="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Yetkisiz Erişim</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Bu sayfaya sadece yöneticiler erişebilir.
        </p>
        <Link href="/dashboard" className="btn-primary flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4" />
          Panele Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-8 border-b pb-4">
        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
          <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Yönetici Paneli</h1>
          <p className="text-muted-foreground">Site yönetimi ve finansal durum özeti</p>
        </div>
      </div>

      <section className="space-y-6">
        {/* İstatistik Kartları */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h3 className="text-muted-foreground text-sm font-medium mb-2">Toplam Daire</h3>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{apartments.length}</span>
              <Building className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
            <div className="mt-4 text-xs text-muted-foreground flex gap-2">
              <span className="text-green-600 font-medium">{apartments.filter(a => a.isRented).length} Kirada</span>
              <span className="text-blue-600 font-medium">{apartments.filter(a => a.isOwnerOccupied).length} Ev Sahibi</span>
              <span className="text-gray-500 font-medium">{apartments.filter(a => !a.isRented && !a.isOwnerOccupied).length} Boş</span>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h3 className="text-muted-foreground text-sm font-medium mb-2">Hazine Bakiyesi</h3>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{treasuryBalance.toFixed(2)} SUI</span>
              <Wallet className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Toplam Gelir: {totalReceived.toFixed(2)} SUI
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h3 className="text-muted-foreground text-sm font-medium mb-2">Toplam Sakin</h3>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">
                {/* Ev sahipleri (tekil) + Kiracılar */}
                {new Set(apartments.map(a => a.owner)).size + apartments.filter(a => a.isRented).length}
              </span>
              <Users className="w-8 h-8 text-green-500 opacity-50" />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Aktif Kiracı: {apartments.filter(a => a.isRented).length}
            </div>
          </div>
        </div>

        {/* Daire Listesi */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-muted/30 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Daire Listesi ve Durumları</h3>
            </div>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              {apartments.length} Daire
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left border-b">
                <tr>
                  <th className="p-4 font-medium md:w-1/4">Blok / Daire</th>
                  <th className="p-4 font-medium">Durum</th>
                  <th className="p-4 font-medium">Ev Sahibi</th>
                  <th className="p-4 font-medium">Kiracı</th>
                  <th className="p-4 font-medium text-right">Aidat Durumu</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apartments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium">
                      {apt.block} Daire {apt.flatNumber}
                    </td>
                    <td className="p-4">
                      {apt.isRented ? (
                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium">
                          <User className="w-3 h-3" /> Kirada
                        </span>
                      ) : apt.isOwnerOccupied ? (
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                          <Home className="w-3 h-3" /> Ev Sahibi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                          Boş
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedUser({ address: apt.owner, type: "owner" })}
                        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
                        title="Ev Sahibi Profilini Gör"
                      >
                        <Shield className="w-3 h-3 text-muted-foreground group-hover:text-blue-500" />
                        <span className="font-mono text-xs text-muted-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300">
                          {apt.owner.slice(0, 6)}...{apt.owner.slice(-4)}
                        </span>
                      </button>
                    </td>
                    <td className="p-4">
                      {apt.tenantAddress ? (
                        <button
                          onClick={() => setSelectedUser({ address: apt.tenantAddress!, type: "tenant" })}
                          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
                          title="Kiracı Profilini Gör"
                        >
                          <User className="w-3 h-3 text-muted-foreground group-hover:text-purple-500" />
                          <span className="font-mono text-xs text-muted-foreground group-hover:text-purple-700 dark:group-hover:text-purple-300">
                            {apt.tenantAddress.slice(0, 6)}...{apt.tenantAddress.slice(-4)}
                          </span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground px-2">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {apt.duesPaidUntil > Date.now() ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium text-xs bg-green-50 px-2 py-1 rounded">
                          <CheckCircle className="w-3 h-3" /> Ödendi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-medium text-xs bg-red-50 px-2 py-1 rounded">
                          <AlertCircle className="w-3 h-3" /> Gecikmiş
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* User Profile Modal */}
      {selectedUser && (
        <UserProfileModal
          address={selectedUser.address}
          type={selectedUser.type}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
