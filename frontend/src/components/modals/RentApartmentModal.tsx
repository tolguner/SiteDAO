"use client";

import { X, Loader2, Key, Calendar, Banknote, CheckCircle, AlertCircle, FileText, Shield } from "lucide-react";
import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { PACKAGE_ID, RENTAL_REGISTRY_ID, CLOCK_OBJECT_ID } from "@/lib/constants";
import { useSiteStore } from "@/lib/store";

interface RentalListing {
  id: string;
  apartmentId: string;
  owner: string;
  block: string;
  flatNumber: number;
  monthlyRent: number;
  duration: number;
  upfrontMonths: number;
}

interface RentApartmentModalProps {
  listing: RentalListing;
  onClose: () => void;
  onSuccess: () => void;
}

export function RentApartmentModal({ listing, onClose, onSuccess }: RentApartmentModalProps) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();
  const {
    address: zkLoginAddress,
    isConnected: zkLoginConnected,
    email: zkLoginEmail,
    signAndExecuteTransaction: zkLoginSignAndExecute
  } = useZkLogin();

  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;

  // zkLogin veya wallet'a göre doğru sign fonksiyonunu seç
  const signAndExecute = async (params: { transaction: Transaction }) => {
    if (zkLoginConnected) {
      return await zkLoginSignAndExecute(params.transaction);
    } else {
      return await walletSignAndExecute(params);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "confirm" | "success">("details");

  const monthlyRentSui = listing.monthlyRent / 1_000_000_000;
  const durationMonths = listing.duration;
  const upfrontSui = monthlyRentSui * listing.upfrontMonths;

  // Contracts dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + durationMonths);

  // Store'dan kiralama fonksiyonları
  const deactivateRentalListing = useSiteStore((state) => state.deactivateRentalListing);
  const createTenantPass = useSiteStore((state) => state.createTenantPass);

  // Store'dan kiralama fonksiyonları
  const createRentalRequest = useSiteStore((state) => state.createRentalRequest);

  // Talep ancak sözleşme adresleri tanımlıysa zincire yazılabilir
  const onChainEnabled = !!(PACKAGE_ID && RENTAL_REGISTRY_ID);
  const userProfile = useSiteStore((state) => state.getUserProfile(connectedAddress || ""));

  const handleRent = async () => {
    if (!connectedAddress) {
      alert("Lütfen cüzdan bağlayın!");
      return;
    }

    setIsSubmitting(true);
    let onChainId: string | undefined;

    try {
      if (onChainEnabled) {
        const tx = new Transaction();
        tx.setSender(connectedAddress);

        // rent_market::request_rental(registry, apartment_id, duration_months, clock)
        // Talep zincirde paylaşılan bir nesne olarak oluşur; kiralama ancak ilan
        // sahibi bu talebi onayladıktan sonra tamamlanabilir.
        tx.moveCall({
          target: `${PACKAGE_ID}::rent_market::request_rental`,
          arguments: [
            tx.object(RENTAL_REGISTRY_ID),
            tx.pure.address(listing.apartmentId),
            tx.pure.u64(durationMonths),
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
            change.objectType.endsWith("::rent_market::RentalRequest")
        );
        if (created && "objectId" in created) {
          onChainId = created.objectId;
        }
      }
    } catch (error) {
      // Zincire yazılamazsa talep yalnızca yerel veride oluşur (demo modu)
      console.error("Kiralama talebi zincire yazılamadı, demo modunda devam ediliyor:", error);
    }

    try {
      createRentalRequest({
        listingId: listing.id,
        apartmentId: listing.apartmentId,
        requesterAddress: connectedAddress,
        requesterName: userProfile?.displayName || "Misafir Kullanıcı",
        requesterEmail: userProfile?.email || "",
        requesterPhone: userProfile?.phone || "",
        message: "Bu daireyi kiralamak istiyorum.",
        requestedDuration: durationMonths,
        onChainId,
      });

      setStep("success");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-card rounded-xl border shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-500" />
            {step === "success" ? "Kiralama Tamamlandı!" : "Daireyi Kirala"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Başarı Ekranı */}
        {step === "success" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Başvuru Gönderildi! 🎉</h3>
            <p className="text-muted-foreground mb-6">
              {listing.block} - Daire {listing.flatNumber} için kiralama talebiniz iletildi.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-6 text-sm text-blue-700 dark:text-blue-300">
              <Shield className="w-4 h-4 inline mr-2" />
              Ev sahibi talebinizi onayladığında bildirim alacaksınız. Sonrasında ödeme yaparak kiralama işlemini tamamlayabilirsiniz.
            </div>

            <button onClick={onSuccess} className="btn-primary w-full">
              Tamam
            </button>
          </div>
        )}

        {/* Detay ve Onay Ekranları */}
        {step !== "success" && (
          <>
            {/* Daire Bilgisi */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                  {listing.flatNumber}
                </div>
                <div>
                  <p className="font-semibold text-lg">{listing.block}</p>
                  <p className="text-sm text-muted-foreground">Daire {listing.flatNumber}</p>
                  <p className="text-xl font-bold text-sui mt-1">{monthlyRentSui.toFixed(2)} SUI/ay</p>
                </div>
              </div>
            </div>

            {step === "details" && (
              <div className="space-y-4">
                {/* Sözleşme Bilgisi */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Sözleşme Şartları
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sözleşme Süresi:</span>
                    <span className="font-medium">{durationMonths} Ay</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">İstenen Peşinat:</span>
                    <span className="font-medium">{listing.upfrontMonths} Kira ({upfrontSui.toFixed(2)} SUI)</span>
                  </div>
                </div>

                {/* Sözleşme Tarihleri */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Sözleşme Detayları
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Başlangıç:</span>
                    <span>{startDate.toLocaleDateString("tr-TR")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bitiş:</span>
                    <span>{endDate.toLocaleDateString("tr-TR")}</span>
                  </div>
                </div>

                {/* Ödeme Özeti */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Maliyet Özeti
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Aylık Kira:</span>
                    <span>{monthlyRentSui.toFixed(2)} SUI</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                    <span>İlk Ödeme (Peşinat):</span>
                    <span className="text-sui text-lg">{upfrontSui.toFixed(2)} SUI</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    * Bu tutarı başvurunuz onaylandıktan sonra ödeyeceksiniz.
                  </p>
                </div>



                {/* Butonlar */}
                <div className="flex gap-3 pt-4">
                  <button onClick={onClose} className="btn-secondary flex-1">
                    İptal
                  </button>
                  <button
                    onClick={() => setStep("confirm")}
                    className="btn-primary flex-1"
                  >
                    Devam Et
                  </button>
                </div>
              </div>
            )}

            {step === "confirm" && (
              <div className="space-y-4">
                {/* Onay Bilgisi */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">
                      <p className="font-medium mb-2">Önemli Bilgiler</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Peşinat Tutarı: <strong>{upfrontSui.toFixed(2)} SUI</strong></li>
                        <li>Ödeme onay sonrası yapılacaktır</li>
                        <li>Size Soulbound TenantPass NFT verilecektir</li>
                        <li>Kira süresi: {durationMonths} ay</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Sözleşme Özeti */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Key className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">Akıllı Kira Sözleşmesi</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daire:</span>
                      <span>{listing.block} - No: {listing.flatNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kiracı:</span>
                      <span className="font-mono text-xs">{connectedAddress?.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Süre:</span>
                      <span>{startDate.toLocaleDateString("tr-TR")} - {endDate.toLocaleDateString("tr-TR")}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2 mt-2">
                      <span>Peşinat:</span>
                      <span className="text-sui">{upfrontSui.toFixed(2)} SUI</span>
                    </div>
                  </div>
                </div>

                {/* Butonlar */}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setStep("details")} className="btn-secondary flex-1">
                    Geri
                  </button>
                  <button
                    onClick={handleRent}
                    disabled={isSubmitting}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        İşleniyor...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        Başvuruyu Gönder
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
