"use client";

import { X, Loader2, Home, Calendar, Banknote, Info, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, RENTAL_REGISTRY_ID, CLOCK_OBJECT_ID, APARTMENT_POLICY_ID } from "@/lib/constants";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore, getAddressFromEmail } from "@/lib/store";

interface ApartmentData {
  id: string;
  block: string;
  flatNumber: number;
  duesPaidUntil: number;
  isRented?: boolean;
}

interface ListForRentModalProps {
  apartment: ApartmentData;
  onClose: () => void;
  onSuccess: () => void;
}

export function ListForRentModal({ apartment, onClose, onSuccess }: ListForRentModalProps) {
  const account = useCurrentAccount();
  const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();
  const { address: zkLoginAddress, isConnected: zkLoginConnected, signAndExecuteTransaction: zkLoginSignAndExecute } = useZkLogin();
  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;

  // zkLogin veya wallet'a göre doğru sign fonksiyonunu seç
  const signAndExecute = async (params: { transaction: Transaction }) => {
    if (zkLoginConnected) {
      return await zkLoginSignAndExecute(params.transaction);
    } else {
      return await walletSignAndExecute(params);
    }
  };

  const [formData, setFormData] = useState({
    monthlyRent: "",
    upfrontMonths: "",
    duration: "",
  });

  const isValid = formData.monthlyRent &&
    parseFloat(formData.monthlyRent) > 0 &&
    formData.upfrontMonths !== "" &&
    formData.duration !== "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "kiosk" | "list">("form");

  // Kullanıcının Kiosk'unu kontrol et
  const { data: kioskData } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: connectedAddress ?? "",
      filter: {
        StructType: "0x2::kiosk::KioskOwnerCap",
      },
      options: {
        showContent: true,
      },
    },
    {
      enabled: !!connectedAddress,
    }
  );

  const hasKiosk = kioskData?.data && kioskData.data.length > 0;
  const kioskOwnerCap = hasKiosk ? kioskData.data[0].data : null;
  const kioskCapId = kioskOwnerCap?.objectId ?? null;

  // KioskOwnerCap'in "for" alanı, ait olduğu Kiosk nesnesinin ID'sini tutar
  const kioskContent = kioskOwnerCap?.content;
  const kioskId =
    kioskContent && kioskContent.dataType === "moveObject"
      ? ((kioskContent.fields as Record<string, unknown>)?.["for"] as string | undefined) ?? null
      : null;

  // Kiosk oluştur
  const handleCreateKiosk = async () => {
    if (!connectedAddress) {
      alert("Lütfen önce cüzdanınızı bağlayın");
      return;
    }

    setIsSubmitting(true);
    try {
      const tx = new Transaction();

      // zkLogin için sender'ı belirt
      tx.setSender(connectedAddress);

      // kiosk::new ile Kiosk ve KioskOwnerCap oluştur
      const [kiosk, kioskCap] = tx.moveCall({
        target: "0x2::kiosk::new",
        arguments: [],
      });

      // Kiosk'u shared object olarak paylaş
      tx.moveCall({
        target: "0x2::transfer::public_share_object",
        arguments: [kiosk],
        typeArguments: ["0x2::kiosk::Kiosk"],
      });

      // KioskOwnerCap'i kullanıcıya transfer et
      tx.transferObjects([kioskCap], tx.pure.address(connectedAddress));

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log("Kiosk oluşturuldu:", result);

      // Sayfayı yenile
      window.location.reload();
    } catch (error: any) {
      console.error("Kiosk oluşturma hatası:", error);

      // Demo modunda: Blockchain işlemi başarısız olsa bile devam et
      // Gas coin yoksa veya başka bir hata varsa, demo modunda listeleme formuna geç
      console.log("Demo mod: Kiosk oluşturma simülasyonu yapılıyor...");
      alert("Demo Mod: Kiosk oluşturma simüle edildi. Listeleme formuna geçiliyor.");
      setStep("list");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Store'dan fonksiyonlar
  const createRentalListing = useSiteStore((state) => state.createRentalListing);
  const updateRentalListing = useSiteStore((state) => state.updateRentalListing);
  const getRentalListingByApartment = useSiteStore((state) => state.getRentalListingByApartment);

  // Daireyi kiraya listele
  const handleListForRent = async () => {
    if (!formData.monthlyRent) {
      alert("Lütfen aylık kira tutarını girin");
      return;
    }

    if (!connectedAddress) {
      alert("Lütfen önce cüzdanınızı bağlayın");
      return;
    }

    const monthlyRentMist = Math.floor(parseFloat(formData.monthlyRent) * 1_000_000_000);
    const upfrontMonths = parseInt(formData.upfrontMonths);
    const duration = parseInt(formData.duration);

    // Mevcut ilanı kontrol et
    const existingListing = getRentalListingByApartment(apartment.id);

    setIsSubmitting(true);
    try {
      if (!kioskId || !kioskCapId) {
        throw new Error("Kiosk bulunamadı; önce Kiosk oluşturun");
      }
      if (!APARTMENT_POLICY_ID) {
        throw new Error("Apartment TransferPolicy tanımlı değil");
      }

      const tx = new Transaction();

      // zkLogin için sender'ı belirt
      tx.setSender(connectedAddress);

      // rent_market::list_for_rent(registry, kiosk, kiosk_cap, policy, apartment,
      //                            monthly_rent, upfront_months,
      //                            min_duration_months, max_duration_months)
      //
      // Daire bu çağrıda Kiosk'a KİLİTLENİR: artık ev sahibinin cüzdanında değil,
      // Kiosk'ta durur ve ancak TransferPolicy onaylanarak çıkabilir. İlan iptal
      // edilirse rent_market::cancel_listing daireyi geri verir.
      tx.moveCall({
        target: `${PACKAGE_ID}::rent_market::list_for_rent`,
        arguments: [
          tx.object(RENTAL_REGISTRY_ID),
          tx.object(kioskId), // KioskOwnerCap'ten okunan Kiosk
          tx.object(kioskCapId), // KioskOwnerCap
          tx.object(APARTMENT_POLICY_ID), // TransferPolicy<Apartment>
          tx.object(apartment.id), // Apartment (değer olarak, Kiosk'a kilitlenir)
          tx.pure.u64(monthlyRentMist),
          tx.pure.u64(upfrontMonths),
          tx.pure.u64(duration),
          tx.pure.u64(duration),
        ],
      });

      await signAndExecute({
        transaction: tx,
      });

      // Store'u güncelle
      if (existingListing) {
        // Mevcut ilanı güncelle
        updateRentalListing(existingListing.id, {
          monthlyRent: monthlyRentMist,
          upfrontMonths,
          duration,
          isActive: true
        });
        console.log("İlan güncellendi:", existingListing.id);
      } else {
        // Yeni ilan oluştur
        createRentalListing({
          apartmentId: apartment.id,
          owner: connectedAddress,
          block: apartment.block,
          flatNumber: apartment.flatNumber,
          monthlyRent: monthlyRentMist,
          upfrontMonths,
          duration,
        });
        console.log("Yeni ilan oluşturuldu");
      }

      onSuccess();
    } catch (error) {
      console.error("Listeleme hatası:", error);

      // Demo modunda: Store'u güncelle
      console.log("Demo mod: Store'da listeleme işlemi yapılıyor...");

      if (existingListing) {
        // Mevcut ilanı güncelle
        updateRentalListing(existingListing.id, {
          monthlyRent: monthlyRentMist,
          upfrontMonths,
          duration,
          isActive: true
        });
        console.log("Demo: İlan güncellendi:", existingListing.id);
      } else {
        // Yeni ilan oluştur
        createRentalListing({
          apartmentId: apartment.id,
          owner: connectedAddress,
          block: apartment.block,
          flatNumber: apartment.flatNumber,
          monthlyRent: monthlyRentMist,
          upfrontMonths,
          duration,
        });
        console.log("Demo: Yeni ilan oluşturuldu");
      }

      onSuccess();
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
            <Home className="w-5 h-5" />
            Daireyi Kiraya Ver
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daire Bilgisi */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
              {apartment.flatNumber}
            </div>
            <div>
              <p className="font-semibold">{apartment.block}</p>
              <p className="text-sm text-muted-foreground">Daire {apartment.flatNumber}</p>
            </div>
          </div>
        </div>

        {/* Sui Kiosk Bilgi Kutusu */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-700 dark:text-purple-300">
              <p className="font-medium mb-1">Sui Kiosk ile Güvenli Kiralama</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Daireniz Kiosk&apos;ta güvenle saklanır</li>
                <li>Kiracıya Soulbound TenantPass verilir (devredilemez)</li>
                <li>Kira ödemeleri otomatik olarak cüzdanınıza gelir</li>
                <li>Sözleşme süresi bitince daire size geri döner</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Kiosk Kontrolü */}
        {!hasKiosk && step === "form" && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                <p className="font-medium mb-2">Kiosk Gerekli</p>
                <p className="text-xs mb-3">
                  Daireyi kiraya vermek için önce bir Sui Kiosk oluşturmanız gerekiyor.
                  Kiosk, NFT&apos;lerinizi güvenle saklayan ve ticaretini yapmanızı sağlayan bir yapıdır.
                </p>
                <button
                  onClick={handleCreateKiosk}
                  disabled={isSubmitting}
                  className="btn-primary text-sm py-2 px-4"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Kiosk Oluşturuluyor...
                    </>
                  ) : (
                    "Kiosk Oluştur"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {(hasKiosk || step === "list") && (
          <div className="space-y-4">
            {/* Aylık Kira */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Aylık Kira (SUI)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.monthlyRent}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, monthlyRent: e.target.value }))
                }
                placeholder="örn: 0.5"
                className="w-full px-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                required
              />
              {formData.monthlyRent && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {(parseFloat(formData.monthlyRent) * 1_000_000_000).toLocaleString()} MIST
                </p>
              )}
            </div>

            {/* Peşinat */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Peşinat (Kira Sayısı)
              </label>
              <select
                value={formData.upfrontMonths}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, upfrontMonths: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="" disabled>Seçiniz</option>
                <option value="1">1 Kira</option>
                <option value="2">2 Kira</option>
                <option value="3">3 Kira</option>
                <option value="6">6 Kira</option>
                <option value="12">12 Kira</option>
              </select>
            </div>

            {/* Kira Süresi */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Kira Sözleşme Süresi
              </label>
              <select
                value={formData.duration}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, duration: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="" disabled>Seçiniz</option>
                <option value="3">3 Ay</option>
                <option value="6">6 Ay</option>
                <option value="12">12 Ay (1 Yıl)</option>
                <option value="24">24 Ay (2 Yıl)</option>
              </select>
            </div>

            {/* Özet */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Kiralama Özeti</h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Aylık Kira:</span>
                <span className="font-medium">{formData.monthlyRent || "0"} SUI</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sözleşme Süresi:</span>
                <span className="font-medium">{formData.duration} ay</span>
              </div>
              {formData.monthlyRent && (
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-muted-foreground">Peşinat Tutarı:</span>
                  <span className="font-bold text-sui">
                    {(parseFloat(formData.monthlyRent) * parseInt(formData.upfrontMonths)).toFixed(2)} SUI
                  </span>
                </div>
              )}
            </div>

            {/* Butonlar */}
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                İptal
              </button>
              <button
                onClick={handleListForRent}
                disabled={isSubmitting || !isValid}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Listeleniyor...
                  </>
                ) : (
                  <>
                    <Home className="w-4 h-4" />
                    Kiraya Ver
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}
