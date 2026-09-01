"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore, type SaleListing } from "@/lib/store";
import { useState, useEffect } from "react";
import { Building2, Coins, Tag, Search, Filter } from "lucide-react";
import { BuyApartmentModal } from "@/components/modals/BuyApartmentModal";

function SaleListingCard({
    listing,
    onBuy,
    isOwner
}: {
    listing: SaleListing;
    onBuy: (listing: SaleListing) => void;
    isOwner: boolean;
}) {
    const getApartment = useSiteStore((state) => state.getApartment);
    const apartment = getApartment(listing.apartmentId);

    if (!apartment) return null;

    return (
        <div className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
            <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 relative">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
                <div className="absolute bottom-4 left-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-medium tracking-wider text-blue-300">SATILIK MÜLK</span>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">{apartment.block} Blok</h3>
                    <p className="text-white/80 font-medium">Daire {apartment.flatNumber}</p>
                </div>

                <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>🏷️</span> Satılık
                </div>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                    <div className="flex justify-between items-end border-b pb-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Satış Fiyatı</p>
                            <p className="text-2xl font-bold text-foreground">
                                {(listing.price / 1_000_000_000).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">SUI</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">Aidat Durumu</p>
                            <p className="text-sm font-medium text-green-600">Ödenmiş</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-muted/50 p-2 rounded">
                            <p className="text-muted-foreground text-xs">Kat</p>
                            <p className="font-medium">{(apartment.flatNumber - 1) % 5 + 1}. Kat</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                            <p className="text-muted-foreground text-xs">Tip</p>
                            <p className="font-medium">3+1</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 mt-2">
                    {isOwner ? (
                        <button
                            disabled
                            className="w-full py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium cursor-not-allowed border"
                        >
                            Sizin İlanınız
                        </button>
                    ) : (
                        <button
                            onClick={() => onBuy(listing)}
                            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Coins className="w-4 h-4" />
                            Satın Al
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SalesPage() {
    const [mounted, setMounted] = useState(false);
    const [selectedListing, setSelectedListing] = useState<SaleListing | null>(null);

    const saleListings = useSiteStore((state) => state.saleListings);

    const account = useCurrentAccount();
    const { address, email } = useZkLogin();
    const connectedAddress = account?.address || address;

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const activeListings = saleListings.filter(l => l.isActive);

    return (
        <div className="min-h-screen pb-20">
            <main className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <Tag className="w-8 h-8 text-yellow-500" />
                            Satılık Daireler
                        </h1>
                        <p className="text-muted-foreground">
                            SiteDAO güvencesiyle blok zincir üzerinden komisyonsuz daire satın alın.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Ara..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        <button className="p-2 border rounded-lg hover:bg-muted">
                            <Filter className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                {activeListings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8 border rounded-xl bg-card border-dashed">
                        <div className="bg-yellow-100 dark:bg-yellow-900/20 p-6 rounded-full mb-6">
                            <Tag className="w-12 h-12 text-yellow-600 dark:text-yellow-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Şu an satılık daire bulunmuyor</h2>
                        <p className="text-muted-foreground max-w-md">
                            Yeni ilanlar eklendiğinde burada listelenecektir.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {activeListings.map(listing => (
                            <SaleListingCard
                                key={listing.id}
                                listing={listing}
                                onBuy={(l) => setSelectedListing(l)}
                                isOwner={listing.sellerAddress === connectedAddress}
                            />
                        ))}
                    </div>
                )}
            </main>

            {selectedListing && (
                <BuyApartmentModal
                    listing={selectedListing}
                    onClose={() => setSelectedListing(null)}
                    onSuccess={() => {
                        // State updates automatically via store subscription
                    }}
                />
            )}
        </div>
    );
}
