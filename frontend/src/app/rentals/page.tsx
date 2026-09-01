"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  Home,
  Key,
  Search,
  Filter,
  Calendar,
  Banknote,
  Clock,
  User,
  Building2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ArrowRight,
  Wallet,
  Shield
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { RentApartmentModal } from "@/components/modals/RentApartmentModal";
import { UserProfileModal } from "@/components/modals/UserProfileModal";
import Link from "next/link";
import { useSiteStore, type RentalListing } from "@/lib/store";

export default function RentalsPage() {
  const account = useCurrentAccount();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("all");
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "newest">("newest");
  const [selectedListing, setSelectedListing] = useState<RentalListing | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [showRentModal, setShowRentModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // zkLogin desteği
  const { isConnected: zkLoginConnected, address: zkLoginAddress } = useZkLogin();
  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;
  const isConnected = zkLoginConnected || !!account?.address;

  // Ham dizilere abone oluyoruz; store'un getRentalListings yardımcısı her çağrıda yeni
  // bir dizi döndürdüğü için doğrudan kullanılırsa aşağıdaki useMemo'lar hiç işe yaramaz.
  const rentalListings = useSiteStore((state) => state.rentalListings);
  const apartments = useSiteStore((state) => state.apartments);

  // Hydration için
  useEffect(() => {
    setMounted(true);
  }, []);

  // Aktif kiralık ilanlar: ilanı açık olan ve dairesi dolu olmayanlar
  const storeListings = useMemo(() => {
    if (!mounted) return [];
    return rentalListings.filter((l) => {
      const apartment = apartments.find((a) => a.id === l.apartmentId);
      return l.isActive && !apartment?.isRented;
    });
  }, [mounted, rentalListings, apartments]);

  // Blok listesi
  const blocks = useMemo(() => {
    const uniqueBlocks = Array.from(new Set(storeListings.map(l => l.block)));
    return uniqueBlocks.sort();
  }, [storeListings]);

  // Filtreleme ve sıralama
  const filteredListings = useMemo(() => {
    let result = storeListings.filter(listing => {
      // Sadece aktif ilanlar
      if (!listing.isActive) return false;

      // Arama
      const searchMatch =
        listing.block.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.flatNumber.toString().includes(searchTerm);

      // Blok filtresi
      const blockMatch = selectedBlock === "all" || listing.block === selectedBlock;

      return searchMatch && blockMatch;
    });

    // Sıralama
    result.sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return a.monthlyRent - b.monthlyRent;
        case "price-desc":
          return b.monthlyRent - a.monthlyRent;
        case "newest":
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return result;
  }, [storeListings, searchTerm, selectedBlock, sortBy]);

  // if (!isConnected) check removed to allow public viewing

  return (
    <div className="space-y-8">
      {/* Başlık */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Key className="w-8 h-8 text-purple-500" />
            Kiralık Daireler
          </h1>
          <p className="text-muted-foreground">
            Sui Kiosk ile güvenli kiralama • {filteredListings.length} aktif ilan
          </p>
        </div>
      </div>

      {/* Sui Kiosk Bilgi Kartı */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Akıllı Kontrat ile Güvenli Kiralama</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Soulbound TenantPass - devredilemez, güvenli kiracı kimliği</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Kira ödemeleri doğrudan ev sahibinin cüzdanına</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Süre bitince daire otomatik olarak geri döner</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-card rounded-xl p-4 border">
        <div className="flex flex-wrap items-center gap-4">
          {/* Arama */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Blok veya daire no ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>

          {/* Blok Filtresi */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="all">Tüm Bloklar</option>
              {blocks.map(block => (
                <option key={block} value={block}>{block}</option>
              ))}
            </select>
          </div>

          {/* Sıralama */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="newest">En Yeni</option>
            <option value="price-asc">Fiyat (Düşükten Yükseğe)</option>
            <option value="price-desc">Fiyat (Yüksekten Düşüğe)</option>
          </select>
        </div>
      </div>

      {/* İlan Listesi */}
      {filteredListings.length === 0 ? (
        <div className="bg-muted/50 rounded-xl p-12 text-center">
          <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">İlan Bulunamadı</h3>
          <p className="text-muted-foreground">
            Filtrelere uygun kiralık daire bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <RentalListingCard
              key={listing.id}
              listing={listing}
              currentUserAddress={connectedAddress || ""}
              onRent={() => {
                if (!isConnected) {
                  alert("Kiralama talebi oluşturmak için lütfen giriş yapın veya cüzdanınızı bağlayın.");
                  return;
                }
                setSelectedListing(listing);
                setShowRentModal(true);
              }}
              onShowOwner={(address) => setSelectedOwner(address)}
            />
          ))}
        </div>
      )}

      {/* Owner Profile Modal */}
      {selectedOwner && (
        <UserProfileModal
          address={selectedOwner}
          type="owner"
          onClose={() => setSelectedOwner(null)}
        />
      )}

      {/* Kiralama Modalı */}
      {showRentModal && selectedListing && (
        <RentApartmentModal
          listing={selectedListing}
          onClose={() => {
            setShowRentModal(false);
            setSelectedListing(null);
          }}
          onSuccess={() => {
            setShowRentModal(false);
            setSelectedListing(null);
            // Refresh listings
          }}
        />
      )}
    </div>
  );
}

// İlan Kartı Bileşeni
function RentalListingCard({
  listing,
  currentUserAddress,
  onRent,
  onShowOwner,
}: {
  listing: RentalListing;
  currentUserAddress: string;
  onRent: () => void;
  onShowOwner: (address: string) => void;
}) {
  const monthlyRentSui = listing.monthlyRent / 1_000_000_000;
  const isOwner = listing.owner.toLowerCase() === currentUserAddress.toLowerCase();

  return (
    <div className="bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-shadow">
      {/* Üst Kısım - Görsel Alanı */}
      <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-purple-100 text-sm">{listing.block}</p>
            <p className="text-2xl font-bold">Daire {listing.flatNumber}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Detaylar */}
      <div className="p-5 space-y-4">
        {/* Fiyat */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Aylık Kira</span>
          <span className="text-2xl font-bold text-sui">{monthlyRentSui.toFixed(2)} SUI</span>
        </div>

        {/* Süre Bilgisi */}
        {/* Süre Bilgisi ve Peşinat */}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{listing.duration} Ay Kontrat</span>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span>{listing.upfrontMonths} Ay Peşin</span>
          </div>
        </div>

        {/* Ev Sahibi */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShowOwner(listing.owner)}
            className="flex items-center gap-2 hover:bg-muted p-2 rounded-lg transition-colors group text-left w-full"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ev Sahibi</p>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {listing.owner.slice(0, 6)}...{listing.owner.slice(-4)}
                </span>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>
        </div>

        {/* Peşinat Tutarı */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Peşinat ({listing.upfrontMonths} ay):</span>
            <span className="font-semibold text-sui">{(monthlyRentSui * listing.upfrontMonths).toFixed(2)} SUI</span>
          </div>
        </div>

        {/* Buton */}
        {isOwner ? (
          <div className="text-center py-2 text-sm text-muted-foreground bg-muted/50 rounded-lg">
            Bu sizin ilanınız
          </div>
        ) : (
          <button
            onClick={onRent}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            Kirala
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
