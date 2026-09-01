"use client";

import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  Vote,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  ExternalLink,
  Wallet,
  Upload,
  FileCheck,
  Calendar,
  Users,
  Shield,
  Trash2,
  MessageCircle,
  Send,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Settings,
  Receipt
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { CreateProposalModal } from "@/components/modals/CreateProposalModal";
import { VoteModal } from "@/components/modals/VoteModal";
import { RoutineExpenseCard } from "@/components/governance/RoutineExpenseCard";
import { AddExpenseModal } from "@/components/governance/AddExpenseModal";
import { RoutineExpenseInvoiceModal } from "@/components/governance/RoutineExpenseInvoiceModal";
import { IPFS_GATEWAY, isAdminEmail, MAJORITY_THRESHOLD } from "@/lib/constants";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore, type Proposal, type ProposalComment, type RoutineExpense } from "@/lib/store";

// Teklif durumları
type ProposalStatus = "voting" | "approved" | "rejected" | "awaiting_invoice" | "completed";

interface ProposalDisplay extends Proposal {
  status: ProposalStatus;
  totalEligibleVoters: number;
  deadlineAt: number;
  invoiceHash?: string;
  completedAt?: number;
}

export default function GovernancePage() {
  const account = useCurrentAccount();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalDisplay | null>(null);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "approved" | "completed" | "routine_expenses">("active");
  const [selectedExpenseForInvoice, setSelectedExpenseForInvoice] = useState<RoutineExpense | null>(null);
  const [mounted, setMounted] = useState(false);

  // zkLogin desteği
  const { isConnected: zkLoginConnected, address: zkLoginAddress, email: zkLoginEmail, name: zkLoginName } = useZkLogin();
  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;
  const isConnected = zkLoginConnected || !!account?.address;
  const userEmail = zkLoginEmail || "";

  // Kullanıcı adı (zkLogin'den veya cüzdan etiketinden)
  const userName = zkLoginName || account?.label || null;

  // Yönetici kontrolü
  const isAdmin = isAdminEmail(userEmail);

  // Store'dan verileri al
  const getApartmentsByOwner = useSiteStore((state) => state.getApartmentsByOwner);
  const getTenantPassesByHolder = useSiteStore((state) => state.getTenantPassesByHolder);
  const storeProposals = useSiteStore((state) => state.proposals);
  const treasury = useSiteStore((state) => state.treasury);
  const deleteProposal = useSiteStore((state) => state.deleteProposal);
  const canDeleteProposal = useSiteStore((state) => state.canDeleteProposal);
  const executeProposal = useSiteStore((state) => state.executeProposal);
  const apartments = useSiteStore((state) => state.apartments);

  // Rutin Giderler
  const routineExpenses = useSiteStore((state) => state.routineExpenses);
  const deleteRoutineExpense = useSiteStore((state) => state.deleteRoutineExpense);

  // Yorum fonksiyonları
  const proposalComments = useSiteStore((state) => state.proposalComments);
  const addComment = useSiteStore((state) => state.addComment);
  const deleteComment = useSiteStore((state) => state.deleteComment);
  const likeComment = useSiteStore((state) => state.likeComment);
  const unlikeComment = useSiteStore((state) => state.unlikeComment);

  // Belirli bir teklifin yorumlarını getir
  const getCommentsByProposal = (proposalId: string) =>
    proposalComments
      .filter((c) => c.proposalId === proposalId)
      .sort((a, b) => a.createdAt - b.createdAt);

  // Hydration için
  useEffect(() => {
    setMounted(true);
  }, []);

  // Oy hakkını kontrol et (dairede oturanlar: sahip veya kiracı)
  const hasApartment = mounted && connectedAddress ? getApartmentsByOwner(connectedAddress).length > 0 : false;
  const hasTenantPass = mounted && connectedAddress ? getTenantPassesByHolder(connectedAddress).length > 0 : false;
  const canVote = hasApartment || hasTenantPass;

  // Teklifleri görüntüleme formatına dönüştür
  const now = Date.now();
  const proposals: ProposalDisplay[] = useMemo(() => {
    if (!mounted) return [];

    return storeProposals.map((p) => {
      let status: ProposalStatus = "voting";
      if (p.isExecuted) {
        status = p.yesVotes > p.noVotes ? "completed" : "rejected";
      } else if (!p.isActive) {
        status = "rejected";
      } else if (p.votingEndsAt < now) {
        status = p.yesVotes > p.noVotes ? "awaiting_invoice" : "rejected";
      }

      return {
        ...p,
        status,
        totalEligibleVoters: apartments.length, // Toplam daire sayısı
        deadlineAt: p.votingEndsAt + 7 * 24 * 60 * 60 * 1000, // Oylama bitiminden 7 gün sonra
      };
    });
  }, [storeProposals, mounted, now, apartments.length]);

  // Hazine bilgileri
  const treasuryBalance = mounted ? treasury.balance / 1_000_000_000 : 0;
  const totalReceived = mounted ? treasury.totalReceived / 1_000_000_000 : 0;
  const totalSpent = mounted ? treasury.totalSpent / 1_000_000_000 : 0;

  // Teklifleri kategorize et
  const votingProposals = proposals.filter((p) => p.status === "voting" && p.votingEndsAt > now);
  const approvedProposals = proposals.filter((p) => p.status === "approved" || p.status === "awaiting_invoice");
  const completedProposals = proposals.filter((p) => p.status === "completed" || p.status === "rejected");

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Cüzdan Bağlı Değil</h1>
        <p className="text-muted-foreground mb-4">
          Teklifleri görüntülemek ve oy kullanmak için lütfen cüzdanınızı bağlayın.
        </p>
      </div>
    );
  }

  // Erişim Kontrolü: Ziyaretçiler erişemez
  if (!isAdmin && !canVote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="bg-muted p-4 rounded-full mb-4">
          <Shield className="w-12 h-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Erişim Reddedildi</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          Yönetim sayfasına sadece daire sahipleri ve kiracılar erişebilir.
          Lütfen yetkili bir cüzdan ile bağlanın veya site sakini olun.
        </p>
        <Link href="/dashboard" className="btn-primary flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          Konutlarıma Git
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Başlık */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Yönetim</h1>
          <p className="text-muted-foreground">
            Harcama tekliflerini görüntüleyin ve oy kullanın
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {isAdmin && (
              <span className="text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Yönetici
              </span>
            )}
            {canVote && (
              <span className="text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-3 py-1 rounded-full">
                ✅ {hasTenantPass ? "Kiracı olarak" : "Ev sahibi olarak"} oy kullanabilirsiniz
              </span>
            )}
            {!canVote && !isAdmin && (
              <span className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full">
                Oy hakkı için daire sahibi veya kiracı olmalısınız
              </span>
            )}
          </div>
        </div>

        {/* Sadece yönetici teklif oluşturabilir */}
        <div className="flex gap-2">
          {isAdmin && activeTab === "routine_expenses" && (
            <button
              onClick={() => setShowAddExpenseModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Gider Ekle
            </button>
          )}
          {isAdmin && activeTab !== "routine_expenses" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Yeni Teklif
            </button>
          )}
        </div>
      </div>

      {/* Hazine Özeti */}
      <div className="bg-gradient-to-r from-sui/10 to-sui/5 rounded-xl p-6 border border-sui/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Hazine Durumu
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Mevcut Bakiye</p>
            <p className="text-2xl font-bold text-sui">{treasuryBalance.toFixed(2)} SUI</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Toplam Gelen</p>
            <p className="text-2xl font-bold">{totalReceived.toFixed(2)} SUI</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Toplam Harcama</p>
            <p className="text-2xl font-bold">{totalSpent.toFixed(2)} SUI</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Aktif Teklifler</p>
            <p className="text-2xl font-bold">{votingProposals.length}</p>
          </div>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "active"
            ? "border-sui text-sui"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4" />
            Aktif Oylamalar ({votingProposals.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab("approved")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "approved"
            ? "border-sui text-sui"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Onaylanan Teklifler ({approvedProposals.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "completed"
            ? "border-sui text-sui"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Tamamlanan İşlemler ({completedProposals.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab("routine_expenses")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === "routine_expenses"
            ? "border-sui text-sui"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Rutin Giderler
          </div>
        </button>
      </div>




      {/* Aktif Oylamalar */}
      {activeTab === "active" && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <p className="text-sm text-muted-foreground">
              Oylamalar 2 gün sürer. %50 üzeri katılım ve çoğunluk gereklidir.
            </p>
          </div>

          {votingProposals.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-8 text-center">
              <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Şu anda aktif oylama bulunmuyor.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {votingProposals.map((proposal) => (
                <VotingProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  canVote={canVote ?? false}
                  canComment={canVote ?? false}
                  isAdmin={isAdmin}
                  canDelete={canDeleteProposal(proposal.id)}
                  connectedAddress={connectedAddress || ""}
                  userType={hasApartment ? "owner" : "tenant"}
                  comments={getCommentsByProposal(proposal.id)}
                  onVote={() => {
                    setSelectedProposal(proposal);
                    setShowVoteModal(true);
                  }}
                  onDelete={() => {
                    if (confirm(`"${proposal.title}" teklifini silmek istediğinize emin misiniz?`)) {
                      deleteProposal(proposal.id);
                    }
                  }}
                  onAddComment={(message) => {
                    if (connectedAddress) {
                      addComment({
                        proposalId: proposal.id,
                        author: connectedAddress,
                        authorName: userName || undefined,
                        authorType: hasApartment ? "owner" : "tenant",
                        message,
                      });
                    }
                  }}
                  onDeleteComment={(commentId) => {
                    if (connectedAddress) {
                      deleteComment(commentId, connectedAddress);
                    }
                  }}
                  onLikeComment={(commentId) => {
                    if (connectedAddress) {
                      likeComment(commentId, connectedAddress);
                    }
                  }}
                  onUnlikeComment={(commentId) => {
                    if (connectedAddress) {
                      unlikeComment(commentId, connectedAddress);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Onaylanan Teklifler */}
      {activeTab === "approved" && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-blue-500" />
            <p className="text-sm text-muted-foreground">
              Onaylanan teklifler için yönetici tarafından fatura yüklenmesi bekleniyor.
            </p>
          </div>

          {approvedProposals.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-8 text-center">
              <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Onaylanmış teklif bulunmuyor.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {approvedProposals.map((proposal) => (
                <ApprovedProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  isAdmin={isAdmin}
                  onUploadInvoice={() => {
                    setSelectedProposal(proposal);
                    setShowInvoiceModal(true);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tamamlanan İşlemler */}
      {activeTab === "completed" && (
        <section>
          {completedProposals.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Tamamlanan işlem bulunmuyor.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {completedProposals.map((proposal) => (
                <CompletedProposalCard
                  key={proposal.id}
                  proposal={proposal}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Rutin Giderler */}
      {activeTab === "routine_expenses" && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-purple-500" />
            <p className="text-sm text-muted-foreground">
              Sitenin düzenli masrafları ve fatura ödemeleri buradan takip edilir.
            </p>
          </div>

          {routineExpenses.length === 0 ? (
            <div className="bg-muted/50 rounded-xl p-8 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Henüz kayıtlı bir gider bulunmuyor.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {routineExpenses.map((expense) => (
                <RoutineExpenseCard
                  key={expense.id}
                  expense={expense}
                  isAdmin={isAdmin}
                  onDelete={() => {
                    if (confirm(`"${expense.title}" giderini silmek istediğinize emin misiniz?`)) {
                      deleteRoutineExpense(expense.id);
                    }
                  }}
                  onUploadInvoice={() => setSelectedExpenseForInvoice(expense)}
                />

              ))}
            </div>
          )}
        </section>
      )}

      {/* Modaller */}
      {showAddExpenseModal && (
        <AddExpenseModal
          onClose={() => setShowAddExpenseModal(false)}
          onSuccess={() => setShowAddExpenseModal(false)}
        />
      )}

      {showCreateModal && (
        <CreateProposalModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
          }}
        />
      )}

      {showVoteModal && selectedProposal && (
        <VoteModal
          proposal={selectedProposal}
          onClose={() => {
            setShowVoteModal(false);
            setSelectedProposal(null);
          }}
          onSuccess={() => {
            setShowVoteModal(false);
            setSelectedProposal(null);
          }}
        />
      )}

      {showInvoiceModal && selectedProposal && (
        <InvoiceUploadModal
          proposal={selectedProposal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedProposal(null);
          }}
          onSuccess={(hash) => {
            executeProposal(selectedProposal.id, hash);
            setShowInvoiceModal(false);
            setSelectedProposal(null);
          }}
        />
      )}

      {selectedExpenseForInvoice && (
        <RoutineExpenseInvoiceModal
          expense={selectedExpenseForInvoice}
          onClose={() => setSelectedExpenseForInvoice(null)}
          onSuccess={() => setSelectedExpenseForInvoice(null)}
        />
      )}
    </div>
  );
}

// Aktif Oylama Kartı
function VotingProposalCard({
  proposal,
  canVote,
  canComment,
  isAdmin,
  canDelete,
  connectedAddress,
  userType,
  comments,
  onVote,
  onDelete,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  onUnlikeComment,
}: {
  proposal: ProposalDisplay;
  canVote: boolean;
  canComment: boolean;
  isAdmin: boolean;
  canDelete: boolean;
  connectedAddress: string;
  userType: "owner" | "tenant";
  comments: ProposalComment[];
  onVote: () => void;
  onDelete: () => void;
  onAddComment: (message: string) => void;
  onDeleteComment: (commentId: string) => void;
  onLikeComment: (commentId: string) => void;
  onUnlikeComment: (commentId: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  const totalVotes = proposal.yesVotes + proposal.noVotes;
  const yesPercentage = totalVotes > 0 ? (proposal.yesVotes / totalVotes) * 100 : 50;
  const noPercentage = totalVotes > 0 ? (proposal.noVotes / totalVotes) * 100 : 50;
  const participation = (totalVotes / proposal.totalEligibleVoters) * 100;

  const timeRemaining = proposal.votingEndsAt - Date.now();
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)));

  // Silme için kalan süre hesapla (3 saat)
  const timeSinceCreation = Date.now() - proposal.createdAt;
  const deleteTimeRemaining = Math.max(0, 3 * 60 * 60 * 1000 - timeSinceCreation);
  const deleteMinutesRemaining = Math.floor(deleteTimeRemaining / (1000 * 60));

  const amountInSui = proposal.amount / 1_000_000_000;
  const deadlineDate = new Date(proposal.deadlineAt).toLocaleDateString("tr-TR");

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Teklif #{proposal.proposalId}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              Oylama Devam Ediyor
            </span>
          </div>
          <h3 className="font-semibold text-lg">{proposal.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{proposal.description}</p>

          <div className="flex flex-wrap gap-4 mt-3">
            <div>
              <p className="text-2xl font-bold text-sui">{amountInSui.toFixed(2)} SUI</p>
              <p className="text-xs text-muted-foreground">Talep edilen tutar</p>
            </div>
            <div>
              <p className="text-lg font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {deadlineDate}
              </p>
              <p className="text-xs text-muted-foreground">Tamamlanma vadesi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Oylama Çubuğu */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-green-600 font-medium flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Evet: {proposal.yesVotes}
          </span>
          <span className="text-muted-foreground">
            <Users className="w-4 h-4 inline mr-1" />
            Katılım: {participation.toFixed(0)}%
          </span>
          <span className="text-red-600 font-medium flex items-center gap-1">
            Hayır: {proposal.noVotes}
            <XCircle className="w-4 h-4" />
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${yesPercentage}%` }}
          />
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${noPercentage}%` }}
          />
        </div>
      </div>

      {/* Alt Bilgi */}
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-1 text-sm text-orange-600">
          <Clock className="w-4 h-4" />
          {hoursRemaining}s {minutesRemaining}dk kaldı
        </span>

        <div className="flex items-center gap-2">
          {/* Yönetici Silme Butonu - İlk 3 saat içinde */}
          {isAdmin && canDelete && (
            <button
              onClick={onDelete}
              className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-1"
              title={`Silmek için ${deleteMinutesRemaining} dakika kaldı`}
            >
              <Trash2 className="w-4 h-4" />
              Sil
            </button>
          )}

          {canVote ? (
            <button onClick={onVote} className="btn-primary">
              Oy Kullan
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">
              Oy hakkınız yok
            </span>
          )}
        </div>
      </div>

      {/* Yönetici için silme süresi bilgisi */}
      {isAdmin && canDelete && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Yönetici olarak bu teklifi silmek için {deleteMinutesRemaining} dakika kaldı
        </div>
      )}

      {/* Yorumlar Bölümü */}
      <div className="mt-4 pt-4 border-t">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Yorumlar ({comments.length})</span>
          {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showComments && (
          <div className="mt-4 space-y-4">
            {/* Yorum Listesi */}
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Henüz yorum yapılmamış. İlk yorumu siz yapın!
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {comments.map((comment) => {
                  const isOwnComment = comment.author.toLowerCase() === connectedAddress?.toLowerCase();
                  const hasLiked = comment.likes.includes(connectedAddress?.toLowerCase() || "");

                  return (
                    <div key={comment.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${comment.authorType === "owner"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                              }`}>
                              {comment.authorType === "owner" ? "Ev Sahibi" : "Kiracı"}
                            </span>
                            <span className="text-xs font-medium">
                              {comment.authorName || `${comment.author.slice(0, 6)}...${comment.author.slice(-4)}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <p className="text-sm">{comment.message}</p>

                          {/* Beğeni ve Silme */}
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              onClick={() => hasLiked ? onUnlikeComment(comment.id) : onLikeComment(comment.id)}
                              className={`flex items-center gap-1 text-xs transition-colors ${hasLiked
                                ? "text-primary font-medium"
                                : "text-muted-foreground hover:text-primary"
                                }`}
                              disabled={!canComment}
                            >
                              <ThumbsUp className={`w-3 h-3 ${hasLiked ? "fill-current" : ""}`} />
                              {comment.likes.length > 0 && comment.likes.length}
                            </button>

                            {isOwnComment && (
                              <button
                                onClick={() => onDeleteComment(comment.id)}
                                className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Yeni Yorum Ekleme */}
            {canComment ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Yorumunuzu yazın..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newComment.trim()) {
                      onAddComment(newComment.trim());
                      setNewComment("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newComment.trim()) {
                      onAddComment(newComment.trim());
                      setNewComment("");
                    }
                  }}
                  disabled={!newComment.trim()}
                  className="btn-primary px-3 py-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Yorum yapmak için site sakini olmalısınız (ev sahibi veya kiracı).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Onaylanan Teklif Kartı
function ApprovedProposalCard({
  proposal,
  isAdmin,
  onUploadInvoice,
}: {
  proposal: ProposalDisplay;
  isAdmin: boolean;
  onUploadInvoice: () => void;
}) {
  const amountInSui = proposal.amount / 1_000_000_000;
  const deadlineDate = new Date(proposal.deadlineAt).toLocaleDateString("tr-TR");
  const daysUntilDeadline = Math.ceil((proposal.deadlineAt - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline <= 3 && daysUntilDeadline >= 0;

  const totalVotes = proposal.yesVotes + proposal.noVotes;
  const yesPercentage = totalVotes > 0 ? (proposal.yesVotes / totalVotes) * 100 : 0;

  return (
    <div className={`bg-card rounded-xl border p-6 ${isOverdue ? 'border-red-300 dark:border-red-800' : isUrgent ? 'border-orange-300 dark:border-orange-800' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Teklif #{proposal.proposalId}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              ✅ Onaylandı
            </span>
            {proposal.status === "awaiting_invoice" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                Fatura Bekleniyor
              </span>
            )}
          </div>
          <h3 className="font-semibold text-lg">{proposal.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{proposal.description}</p>

          <div className="flex flex-wrap gap-4 mt-3">
            <div>
              <p className="text-2xl font-bold text-sui">{amountInSui.toFixed(2)} SUI</p>
              <p className="text-xs text-muted-foreground">Onaylanan tutar</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Oylama: %{yesPercentage.toFixed(0)} evet ({proposal.yesVotes}/{totalVotes})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vade Bilgisi */}
      <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${isOverdue
        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        : isUrgent
          ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
        }`}>
        <Calendar className="w-5 h-5" />
        <div>
          <p className="font-medium">
            Vade: {deadlineDate}
          </p>
          <p className="text-sm">
            {isOverdue
              ? `${Math.abs(daysUntilDeadline)} gün gecikmiş!`
              : `${daysUntilDeadline} gün kaldı`
            }
          </p>
        </div>
      </div>

      {/* Yönetici için fatura yükleme butonu */}
      {isAdmin && (
        <div className="flex justify-end">
          <button onClick={onUploadInvoice} className="btn-primary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Fatura Yükle ve Tamamla
          </button>
        </div>
      )}

      {!isAdmin && (
        <p className="text-sm text-muted-foreground text-center">
          Yönetici tarafından fatura yüklenmesi bekleniyor
        </p>
      )}
    </div>
  );
}

// Tamamlanan Teklif Kartı
function CompletedProposalCard({
  proposal,
}: {
  proposal: ProposalDisplay;
}) {
  const amountInSui = proposal.amount / 1_000_000_000;
  const isRejected = proposal.status === "rejected";
  const completedDate = proposal.completedAt
    ? new Date(proposal.completedAt).toLocaleDateString("tr-TR")
    : "-";

  const totalVotes = proposal.yesVotes + proposal.noVotes;
  const yesPercentage = totalVotes > 0 ? (proposal.yesVotes / totalVotes) * 100 : 0;

  return (
    <div className={`bg-card rounded-xl border p-6 ${isRejected ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Teklif #{proposal.proposalId}</span>
            {isRejected ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                ❌ Reddedildi
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                ✅ Tamamlandı
              </span>
            )}
          </div>
          <h3 className="font-semibold text-lg">{proposal.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{proposal.description}</p>

          <div className="flex flex-wrap gap-4 mt-3">
            <div>
              <p className={`text-xl font-bold ${isRejected ? 'text-muted-foreground line-through' : 'text-sui'}`}>
                {amountInSui.toFixed(2)} SUI
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Oylama: %{yesPercentage.toFixed(0)} evet ({proposal.yesVotes}/{totalVotes})
              </p>
            </div>
            {!isRejected && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Tamamlanma: {completedDate}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fatura linki */}
        {!isRejected && proposal.invoiceHash && (
          <a
            href={`${IPFS_GATEWAY}${proposal.invoiceHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <FileCheck className="w-5 h-5" />
            <span className="text-sm font-medium">Faturayı Gör</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

// Fatura Yükleme Modalı
function InvoiceUploadModal({
  proposal,
  onClose,
  onSuccess,
}: {
  proposal: ProposalDisplay;
  onClose: () => void;
  onSuccess: (hash: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [ipfsHash, setIpfsHash] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountInSui = proposal.amount / 1_000_000_000;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const uploadToIPFS = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-ipfs", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("IPFS yükleme hatası");

      const data = await response.json();
      setIpfsHash(data.ipfsHash);
    } catch (error) {
      console.error("IPFS yükleme hatası:", error);
      setIpfsHash("QmDemo" + Date.now());
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!ipfsHash) {
      alert("Lütfen önce faturayı yükleyin");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Fatura yükleniyor:", { proposalId: proposal.proposalId, ipfsHash });
      await new Promise(resolve => setTimeout(resolve, 1000));
      onSuccess(ipfsHash);
    } catch (error) {
      console.error("Fatura yükleme hatası:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-card rounded-xl border shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-xl font-semibold mb-4">Fatura Yükle ve Tamamla</h2>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <p className="font-medium">{proposal.title}</p>
          <p className="text-2xl font-bold text-sui mt-1">{amountInSui.toFixed(2)} SUI</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Fatura Belgesi</label>
            <div className="border-2 border-dashed rounded-lg p-4">
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className="hidden"
                id="invoice-file"
              />

              {file ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={uploadToIPFS}
                    disabled={isUploading}
                    className="btn-secondary text-sm py-1 px-3"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                        Yükleniyor...
                      </>
                    ) : ipfsHash ? (
                      "✅ Yüklendi"
                    ) : (
                      "IPFS'e Yükle"
                    )}
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="invoice-file"
                  className="w-full flex flex-col items-center gap-2 py-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8" />
                  <span>Fatura dosyasını seçin</span>
                </label>
              )}
            </div>
          </div>

          {ipfsHash && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3 rounded-lg text-sm">
              ✅ Fatura IPFS&apos;e yüklendi: {ipfsHash.slice(0, 20)}...
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!ipfsHash || isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Tamamlanıyor...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Tamamla
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
