"use client";

import { X, Loader2, Upload, Calendar, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  PACKAGE_ID,
  PROPOSAL_REGISTRY_ID,
  GOVERNANCE_ADMIN_CAP_ID,
  CLOCK_OBJECT_ID,
  VOTING_PERIOD_MS,
} from "@/lib/constants";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore } from "@/lib/store";

interface CreateProposalModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProposalModal({ onClose, onSuccess }: CreateProposalModalProps) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();

  // Sözleşme adresleri tanımlı değilse zincire yazma denenmez, demo modda çalışılır
  const onChainEnabled = !!(PACKAGE_ID && PROPOSAL_REGISTRY_ID && GOVERNANCE_ADMIN_CAP_ID);
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

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    amount: "",
    recipient: "",
    deadlineDays: "7", // Vade süresi (gün)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store'dan createProposal fonksiyonu
  const createProposal = useSiteStore((state) => state.createProposal);

  // Oylama bitiş tarihi (2 gün sonra)
  const votingEndsAt = new Date(Date.now() + VOTING_PERIOD_MS);

  // Tamamlanma vadesi
  const deadlineAt = new Date(Date.now() + parseInt(formData.deadlineDays || "7") * 24 * 60 * 60 * 1000);

  // Teklif oluştur
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.amount || !connectedAddress) {
      alert("Lütfen tüm alanları doldurun");
      return;
    }

    setIsSubmitting(true);

    const amountInMist = Math.floor(parseFloat(formData.amount) * 1_000_000_000);
    const recipient = formData.recipient || connectedAddress || "";
    let onChainId: string | undefined;

    try {
      if (onChainEnabled) {
        const tx = new Transaction();

        // zkLogin için sender'ı belirt
        tx.setSender(connectedAddress);

        // Argüman sırası governance::create_proposal imzasıyla birebir aynı olmalı:
        // (admin_cap, registry, ipfs_hash, description, amount, recipient, clock)
        // Not: Sözleşmede başlık alanı ve ayarlanabilir vade yok; ikisi de yerel olarak tutulur.
        tx.moveCall({
          target: `${PACKAGE_ID}::governance::create_proposal`,
          arguments: [
            tx.object(GOVERNANCE_ADMIN_CAP_ID),
            tx.object(PROPOSAL_REGISTRY_ID),
            tx.pure.string(""), // ipfs_hash - fatura yüklendiğinde teklife eklenir
            tx.pure.string(formData.description),
            tx.pure.u64(amountInMist),
            tx.pure.address(recipient),
            tx.object(CLOCK_OBJECT_ID),
          ],
        });

        const result = await signAndExecute({ transaction: tx });

        // Oylama için zincirdeki paylaşılan Proposal nesnesinin ID'si gerekiyor
        const details = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showObjectChanges: true },
        });

        const created = details.objectChanges?.find(
          (change) =>
            change.type === "created" &&
            change.objectType.endsWith("::governance::Proposal")
        );

        if (created && "objectId" in created) {
          onChainId = created.objectId;
        } else {
          console.warn("Teklif zincire yazıldı ama nesne ID'si okunamadı:", result.digest);
        }
      }
    } catch (error) {
      // Zincire yazılamadıysa teklif yalnızca yerel store'da oluşturulur (demo modu)
      console.error("Teklif zincire yazılamadı, demo modunda devam ediliyor:", error);
    }

    try {
      createProposal({
        title: formData.title,
        description: formData.description,
        amount: amountInMist,
        recipient,
        creator: connectedAddress || "",
        votingEndsAt: Date.now() + VOTING_PERIOD_MS,
        ipfsHash: "", // Fatura yüklendiğinde doldurulur
        onChainId,
      });

      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-xl border shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Yeni Harcama Teklifi</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bilgi Kutusu */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Oylama Süreci</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Oylama 2 gün sürer</li>
                <li>Dairede oturanlar (sahip/kiracı) oy kullanabilir</li>
                <li>%50 üzeri katılım ve çoğunluk gerekir</li>
                <li>Onaylandıktan sonra belirlenen vade içinde fatura yüklenmelidir</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Başlık */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Başlık
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="örn: Asansör Bakımı"
              className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Harcamanın ne için olduğunu açıklayın..."
              className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              rows={3}
              required
            />
          </div>

          {/* Tutar */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Talep Edilen Tutar (SUI)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={formData.amount}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="0.00"
              className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          {/* Alıcı Adresi (opsiyonel) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Alıcı Cüzdan Adresi (opsiyonel)
            </label>
            <input
              type="text"
              value={formData.recipient}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, recipient: e.target.value }))
              }
              placeholder="Boş bırakılırsa hazineye kalır"
              className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* Vade Süresi */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tamamlanma Vadesi (gün)
            </label>
            <select
              value={formData.deadlineDays}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, deadlineDays: e.target.value }))
              }
              className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="7">7 gün</option>
              <option value="14">14 gün</option>
              <option value="21">21 gün</option>
              <option value="30">30 gün</option>
              <option value="60">60 gün</option>
              <option value="90">90 gün</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Onaylandıktan sonra fatura yükleme süresi
            </p>
          </div>

          {/* Tarih Özeti */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Oylama Bitiş:
              </span>
              <span className="font-medium">
                {votingEndsAt.toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Tamamlanma Vadesi:
              </span>
              <span className="font-medium">
                {deadlineAt.toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </span>
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                "Teklif Oluştur"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
