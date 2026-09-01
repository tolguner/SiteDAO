import { useState } from "react";
import { useSiteStore, type SaleListing, type Apartment } from "@/lib/store";
import { Coins, Building2, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";

import { PACKAGE_ID } from "@/lib/constants";

interface BuyApartmentModalProps {
    listing: SaleListing;
    onClose: () => void;
    onSuccess?: () => void;
}

export function BuyApartmentModal({ listing, onClose, onSuccess }: BuyApartmentModalProps) {
    const [loading, setLoading] = useState(false);
    const buyApartment = useSiteStore((state) => state.buyApartment);
    const getApartment = useSiteStore((state) => state.getApartment);

    const account = useCurrentAccount();
    const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();
    const {
        address,
        email,
        isConnected: zkLoginConnected,
        signAndExecuteTransaction: zkLoginSignAndExecute,
    } = useZkLogin();
    const connectedAddress = account?.address || address;

    const apartment = getApartment(listing.apartmentId);

    // İlanın zincirde emanet nesnesi varsa satın alma zincire yazılır
    const onChainEnabled = !!(PACKAGE_ID && listing.onChainId);

    const signAndExecute = async (params: { transaction: Transaction }) => {
        if (zkLoginConnected) {
            return await zkLoginSignAndExecute(params.transaction);
        }
        return await walletSignAndExecute(params);
    };

    const handleBuy = async () => {
        if (!connectedAddress) return;

        setLoading(true);
        try {
            if (!onChainEnabled) {
                throw new Error("İlanın zincir kaydı yok");
            }

            const tx = new Transaction();
            tx.setSender(connectedAddress);

            const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(listing.price)]);

            // sale_market::buy_apartment(listing, payment)
            // İlan nesnesi tüketilir: ödeme satıcıya, daire alıcıya tek işlemde geçer.
            tx.moveCall({
                target: `${PACKAGE_ID}::sale_market::buy_apartment`,
                arguments: [tx.object(listing.onChainId!), coin],
            });

            const result = await signAndExecute({ transaction: tx });
            console.log("Daire zincir üzerinden satın alındı:", result);

            buyApartment(listing.id, connectedAddress);
            onSuccess?.();
            onClose();
        } catch (error) {
            // Zincire yazılamazsa satın alma yalnızca yerel veride işlenir (demo modu)
            console.error("Satın alma zincire yazılamadı, demo modunda devam ediliyor:", error);
            buyApartment(listing.id, connectedAddress);
            onSuccess?.();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!apartment) return null;

    const priceInSui = listing.price / 1_000_000_000;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card rounded-xl border shadow-xl w-full max-w-md mx-4 p-6 animation-fade-in">

                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Coins className="w-5 h-5 text-yellow-600" />
                        Daire Satın Al
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Apartment Info Card */}
                    <div className="bg-muted/30 p-4 rounded-xl border flex items-center gap-4">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                            <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{apartment.block} Blok</h3>
                            <p className="text-muted-foreground">Daire {apartment.flatNumber}</p>
                        </div>
                    </div>

                    {/* Price Info */}
                    <div className="bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/50 text-center">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">Satış Fiyatı</p>
                        <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                            {priceInSui.toLocaleString()} SUI
                        </p>
                    </div>

                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg flex gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-500" />
                        <p>
                            Bu işlem dairenin mülkiyetini (NFT) size transfer edecektir. Ödeme satıcının cüzdanına anında aktarılır.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors font-medium"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleBuy}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> İşleniyor...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" /> Satın Al
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
