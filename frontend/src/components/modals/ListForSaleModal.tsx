import { useState } from "react";
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useSiteStore, type Apartment } from "@/lib/store";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { PACKAGE_ID, RENTAL_REGISTRY_ID, CLOCK_OBJECT_ID } from "@/lib/constants";
import { Coins, Tag, X, Loader2 } from "lucide-react";

interface ListForSaleModalProps {
    apartment: Apartment;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ListForSaleModal({ apartment, onClose, onSuccess }: ListForSaleModalProps) {
    const [price, setPrice] = useState<string>("");
    const createSaleListing = useSiteStore((state) => state.createSaleListing);
    const [loading, setLoading] = useState(false);

    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();
    const {
        address: zkLoginAddress,
        isConnected: zkLoginConnected,
        signAndExecuteTransaction: zkLoginSignAndExecute,
    } = useZkLogin();

    const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;

    // Satış ilanı, daireyi emanete alan paylaşılan bir nesne oluşturur
    const onChainEnabled = !!(PACKAGE_ID && RENTAL_REGISTRY_ID);

    const signAndExecute = async (params: { transaction: Transaction }) => {
        if (zkLoginConnected) {
            return await zkLoginSignAndExecute(params.transaction);
        }
        return await walletSignAndExecute(params);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const priceInSui = parseFloat(price);
        if (isNaN(priceInSui) || priceInSui <= 0) {
            alert("Lütfen geçerli bir fiyat giriniz.");
            return;
        }

        // 1 SUI = 1_000_000_000 MIST
        const priceInMist = Math.floor(priceInSui * 1_000_000_000);
        let onChainId: string | undefined;

        setLoading(true);
        try {
            if (onChainEnabled && connectedAddress) {
                const tx = new Transaction();
                tx.setSender(connectedAddress);

                // sale_market::list_for_sale(rental_registry, apartment, price, clock)
                // Daire ilan süresince paylaşılan SaleListing nesnesinde emanette tutulur.
                tx.moveCall({
                    target: `${PACKAGE_ID}::sale_market::list_for_sale`,
                    arguments: [
                        tx.object(RENTAL_REGISTRY_ID),
                        tx.object(apartment.id),
                        tx.pure.u64(priceInMist),
                        tx.object(CLOCK_OBJECT_ID),
                    ],
                });

                const result = await signAndExecute({ transaction: tx });

                const details = await suiClient.waitForTransaction({
                    digest: result.digest,
                    options: { showObjectChanges: true },
                });

                const created = details.objectChanges?.find(
                    (change) =>
                        change.type === "created" &&
                        change.objectType.endsWith("::sale_market::SaleListing")
                );
                if (created && "objectId" in created) {
                    onChainId = created.objectId;
                }
            }
        } catch (error) {
            // Zincire yazılamazsa ilan yalnızca yerel veride oluşur (demo modu)
            console.error("Satış ilanı zincire yazılamadı, demo modunda devam ediliyor:", error);
        }

        try {
            createSaleListing({
                apartmentId: apartment.id,
                sellerAddress: apartment.owner,
                block: apartment.block,
                flatNumber: apartment.flatNumber,
                price: priceInMist,
                onChainId,
            });

            onSuccess?.();
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card rounded-xl border shadow-xl w-full max-w-md mx-4 p-6 animation-fade-in">

                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Tag className="w-5 h-5 text-green-600" />
                        Daireyi Satışa Çıkar
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Blok:</span>
                            <span className="font-medium">{apartment.block}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Daire:</span>
                            <span className="font-medium">{apartment.flatNumber}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="price" className="text-sm font-medium">Satış Fiyatı (SUI)</label>
                        <div className="relative">
                            <input
                                id="price"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                required
                            />
                            <Coins className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Satış gerçekleştiğinde ödeme doğrudan cüzdanınıza aktarılacaktır.
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
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> İşleniyor...
                                </>
                            ) : (
                                "İlanı Yayınla"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
