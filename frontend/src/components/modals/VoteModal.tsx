"use client";

import { X, Loader2, CheckCircle, XCircle, Clock, Users, Calendar } from "lucide-react";
import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, RENTAL_REGISTRY_ID, CLOCK_OBJECT_ID } from "@/lib/constants";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore } from "@/lib/store";

interface Proposal {
  id: string;
  proposalId: number;
  title?: string;
  description: string;
  amount: number;
  yesVotes: number;
  noVotes: number;
  totalEligibleVoters?: number;
  votingEndsAt?: number;
  deadlineAt?: number;
  /// Zincirdeki paylaşılan Proposal nesnesinin ID'si (yoksa demo modu)
  onChainId?: string;
}

interface VoteModalProps {
  proposal: Proposal;
  onClose: () => void;
  onSuccess: () => void;
}

export function VoteModal({ proposal, onClose, onSuccess }: VoteModalProps) {
  const account = useCurrentAccount();
  const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();
  const {
    address: zkLoginAddress,
    isConnected: zkLoginConnected,
    email: zkLoginEmail,
    signAndExecuteTransaction: zkLoginSignAndExecute
  } = useZkLogin();
  const [selectedVote, setSelectedVote] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;

  // zkLogin veya wallet'a göre doğru sign fonksiyonunu seç
  const signAndExecute = async (params: { transaction: Transaction }) => {
    if (zkLoginConnected) {
      return await zkLoginSignAndExecute(params.transaction);
    } else {
      return await walletSignAndExecute(params);
    }
  };

  // Kullanıcının oy kullanabileceği varlıkları kontrol et (Store'dan)
  const getApartmentsByOwner = useSiteStore((state) => state.getApartmentsByOwner);
  const getTenantPassesByHolder = useSiteStore((state) => state.getTenantPassesByHolder);

  const allOwnedApartments = connectedAddress ? getApartmentsByOwner(connectedAddress) : [];
  const ownedTenantPasses = connectedAddress ? getTenantPassesByHolder(connectedAddress) : [];

  // Ev sahipleri sadece kirada OLMAYAN daireleri için oy kullanabilir
  // Kiradaki dairelerin oy hakkı kiracıya geçer
  const eligibleApartments = allOwnedApartments.filter(apt => !apt.isRented);

  // Modal içinde kullanılacak format
  const apartments = eligibleApartments.map(apt => ({
    id: apt.id,
    block: apt.block,
    flat: apt.flatNumber
  }));

  const tenantPasses = ownedTenantPasses.map(tp => ({
    id: tp.id,
    apartmentId: tp.apartmentId,
    block: tp.apartmentBlock,
    flat: tp.apartmentFlat
  }));

  const vote = useSiteStore((state) => state.vote);
  const getRentalListingByApartment = useSiteStore((state) => state.getRentalListingByApartment);

  // Kiraya çıkarılan daire Kiosk'a kilitlenir; o durumda oy Kiosk üzerinden verilir
  const votingApartment = apartments.length > 0 ? apartments[0] : null;
  const apartmentIsListed = votingApartment
    ? !!getRentalListingByApartment(votingApartment.id)?.isActive
    : false;

  // Kilitli daire için KioskOwnerCap gerekiyor
  const { data: kioskData } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: connectedAddress ?? "",
      filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
      options: { showContent: true },
    },
    { enabled: !!connectedAddress && apartmentIsListed }
  );

  const kioskOwnerCap = kioskData?.data?.[0]?.data ?? null;
  const kioskCapId = kioskOwnerCap?.objectId ?? null;
  const kioskContent = kioskOwnerCap?.content;
  const kioskId =
    kioskContent && kioskContent.dataType === "moveObject"
      ? ((kioskContent.fields as Record<string, unknown>)?.["for"] as string | undefined) ?? null
      : null;

  // Oy zincire yazılabilir mi? Teklifin zincirdeki nesne ID'si olmalı.
  // Ev sahibi oyu ayrıca RentalRegistry ister (sözleşme kiralama durumunu oradan okur).
  const onChainEnabled = !!(
    PACKAGE_ID &&
    proposal.onChainId &&
    (tenantPasses.length > 0
      ? true
      : RENTAL_REGISTRY_ID && (!apartmentIsListed || (kioskId && kioskCapId)))
  );

  const handleVote = async () => {
    if (selectedVote === null || !connectedAddress) return;

    setIsSubmitting(true);

    // Kiracılık önceliği: TenantPass varsa kiracı olarak oy kullanılır
    const votingAsTenant = tenantPasses.length > 0;
    const voterType: "tenant" | "owner" = votingAsTenant ? "tenant" : "owner";
    let onChainSucceeded = false;

    try {
      if (onChainEnabled) {
        const tx = new Transaction();
        tx.setSender(connectedAddress);

        if (votingAsTenant) {
          // vote_as_tenant(proposal, tenant_pass, vote, clock)
          tx.moveCall({
            target: `${PACKAGE_ID}::governance::vote_as_tenant`,
            arguments: [
              tx.object(proposal.onChainId!),
              tx.object(tenantPasses[0].id),
              tx.pure.bool(selectedVote),
              tx.object(CLOCK_OBJECT_ID),
            ],
          });
        } else if (apartmentIsListed) {
          // Daire Kiosk'ta kilitli: nesne doğrudan geçirilemez, cap ile ödünç alınır
          // vote_as_owner_in_kiosk(proposal, registry, kiosk, cap, apartment_id, vote, clock)
          tx.moveCall({
            target: `${PACKAGE_ID}::governance::vote_as_owner_in_kiosk`,
            arguments: [
              tx.object(proposal.onChainId!),
              tx.object(RENTAL_REGISTRY_ID),
              tx.object(kioskId!),
              tx.object(kioskCapId!),
              tx.pure.address(apartments[0].id),
              tx.pure.bool(selectedVote),
              tx.object(CLOCK_OBJECT_ID),
            ],
          });
        } else {
          // vote_as_owner(proposal, registry, apartment, vote, clock)
          tx.moveCall({
            target: `${PACKAGE_ID}::governance::vote_as_owner`,
            arguments: [
              tx.object(proposal.onChainId!),
              tx.object(RENTAL_REGISTRY_ID),
              tx.object(apartments[0].id),
              tx.pure.bool(selectedVote),
              tx.object(CLOCK_OBJECT_ID),
            ],
          });
        }

        const result = await signAndExecute({ transaction: tx });
        onChainSucceeded = true;
        console.log("Oy zincire yazıldı:", result);
      }
    } catch (error) {
      // Zincire yazılamazsa oy yalnızca yerel store'a işlenir (demo modu)
      console.error("Oy zincire yazılamadı, demo modunda devam ediliyor:", error);
    }

    try {
      // Sözleşmede her dairenin oyu 1 ağırlığındadır
      const weight = 1;
      vote(proposal.id, connectedAddress, selectedVote, weight, voterType);
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }

    if (!onChainEnabled) {
      console.info("Teklifin zincir kaydı yok, oy yalnızca yerel store'a işlendi.");
    } else if (!onChainSucceeded) {
      console.warn("Zincire yazma başarısız oldu, oy yalnızca yerel store'a işlendi.");
    }
  };

  const canVote = apartments.length > 0 || tenantPasses.length > 0;
  const amountInSui = proposal.amount / 1_000_000_000;
  const totalVotes = proposal.yesVotes + proposal.noVotes;
  const yesPercentage = totalVotes > 0 ? Math.round((proposal.yesVotes / totalVotes) * 100) : 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-xl border shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Oy Kullan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Teklif Özeti */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-1">
            Teklif #{proposal.proposalId}
          </p>
          {proposal.title && (
            <h3 className="font-semibold text-lg mb-1">{proposal.title}</h3>
          )}
          <p className="text-sm text-muted-foreground mb-2">{proposal.description}</p>
          <p className="text-2xl font-bold text-sui">{amountInSui.toFixed(2)} SUI</p>

          {/* Ek bilgiler */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            {proposal.votingEndsAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {Math.max(0, Math.ceil((proposal.votingEndsAt - Date.now()) / (1000 * 60 * 60)))} saat kaldı
              </span>
            )}
            {proposal.totalEligibleVoters && (
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {proposal.totalEligibleVoters} kişi oy kullanabilir
              </span>
            )}
            {proposal.deadlineAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Vade: {new Date(proposal.deadlineAt).toLocaleDateString("tr-TR")}
              </span>
            )}
          </div>
        </div>

        {/* Mevcut Oylama Durumu */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-green-600">Evet: {proposal.yesVotes}</span>
            <span className="text-red-600">Hayır: {proposal.noVotes}</span>
          </div>
          <div className="h-2 bg-red-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${yesPercentage}%` }}
            />
          </div>
        </div>

        {canVote ? (
          <>
            {/* Oy Seçimi */}
            <div className="mb-6">
              <p className="text-sm font-medium mb-3">Oyunuz:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedVote(true)}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedVote === true
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "border-muted hover:border-green-300"
                    }`}
                >
                  <CheckCircle
                    className={`w-6 h-6 ${selectedVote === true ? "text-green-500" : "text-muted-foreground"
                      }`}
                  />
                  <span className={selectedVote === true ? "text-green-700 dark:text-green-300 font-medium" : ""}>
                    Evet
                  </span>
                </button>
                <button
                  onClick={() => setSelectedVote(false)}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${selectedVote === false
                    ? "border-red-500 bg-red-50 dark:bg-red-950"
                    : "border-muted hover:border-red-300"
                    }`}
                >
                  <XCircle
                    className={`w-6 h-6 ${selectedVote === false ? "text-red-500" : "text-muted-foreground"
                      }`}
                  />
                  <span className={selectedVote === false ? "text-red-700 dark:text-red-300 font-medium" : ""}>
                    Hayır
                  </span>
                </button>
              </div>
            </div>

            {/* Oy Kullanma Bilgisi */}
            <div className="bg-muted/50 rounded-lg p-3 mb-6 text-sm">
              {tenantPasses.length > 0 ? (
                <p>
                  🏠 <strong>Kiracı</strong> olarak oy kullanacaksınız
                  <br />
                  <span className="text-muted-foreground">
                    {tenantPasses[0].block} - No: {tenantPasses[0].flat}
                  </span>
                </p>
              ) : (
                <p>
                  🔑 <strong>Ev Sahibi</strong> olarak oy kullanacaksınız
                  <br />
                  <span className="text-muted-foreground">
                    {apartments[0].block} - No: {apartments[0].flat}
                  </span>
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {onChainEnabled
                  ? "Oyunuz Sui ağına yazılacak, cüzdanınızda işlem onayı istenecek."
                  : "Bu teklifin zincir kaydı yok; oyunuz yalnızca yerel demo verisine işlenecek."}
              </p>
            </div>

            {/* Butonlar */}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">
                İptal
              </button>
              <button
                onClick={handleVote}
                disabled={selectedVote === null || isSubmitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  "Oyu Gönder"
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Oy kullanabilmek için bir Apartment NFT&apos;sine veya TenantPass kartına sahip olmalısınız.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
