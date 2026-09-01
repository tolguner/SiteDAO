"use client";

import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Building2, CreditCard, Calendar, AlertCircle, Key, User, Users, Banknote, Home, Wallet, Coins, AlertTriangle, ChevronDown, Clock, CheckCircle2, XCircle, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { PayDuesModal } from "@/components/modals/PayDuesModal";
import { PayRentModal } from "@/components/modals/PayRentModal";
import { ListForRentModal } from "@/components/modals/ListForRentModal";
import { CompleteProfileModal } from "@/components/modals/CompleteProfileModal";
import { CompleteRentalModal } from "@/components/modals/CompleteRentalModal";
import { TenantDetailsModal } from "@/components/modals/TenantDetailsModal";
import { ListForSaleModal } from "@/components/modals/ListForSaleModal";
import { MONTHLY_DUES_SUI, PACKAGE_ID } from "@/lib/constants";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore, type Apartment, type TenantPass, type RentalRequest, type ActivityLog } from "@/lib/store";
import { InvoiceModal } from "@/components/modals/InvoiceModal";

// Helper function for dues calculation
function getDuesStatus(apartment: Apartment) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const effectivePaidUntil = Math.max(apartment.duesPaidUntil, new Date(2025, 11, 31).getTime());

  let unpaidMonths = 0;
  let checkDate = new Date(2026, 0, 1); // İlk aidat: Ocak 2026

  while (checkDate.getTime() <= currentMonthStart) {
    if (effectivePaidUntil < checkDate.getTime()) {
      unpaidMonths++;
    }
    checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 1);
  }

  const totalUnpaidAmount = unpaidMonths * MONTHLY_DUES_SUI;

  if (unpaidMonths > 0) {
    const lastUnpaidMonth = new Date(currentYear, currentMonth - unpaidMonths + 1, 1);
    const daysOverdue = Math.ceil((now.getTime() - lastUnpaidMonth.getTime()) / (1000 * 60 * 60 * 24));

    return {
      text: `${unpaidMonths} ay gecikmiş`,
      subtext: `Toplam: ${totalUnpaidAmount.toFixed(2)} SUI`,
      daysText: `${daysOverdue} gün`,
      isPaid: false,
      unpaidMonths,
      totalUnpaidAmount
    };
  } else {
    const daysUntilNextDue = Math.ceil((nextMonthStart - now.getTime()) / (1000 * 60 * 60 * 24));
    const nextDueDate = new Date(nextMonthStart).toLocaleDateString("tr-TR");

    return {
      text: "Aidat Ödendi ✓",
      subtext: `Sonraki: ${nextDueDate}`,
      daysText: `${daysUntilNextDue} gün kaldı`,
      isPaid: true,
      unpaidMonths: 0,
      totalUnpaidAmount: 0
    };
  }
}

function getRentStatus(pass: TenantPass) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const effectivePaidUntil = pass.rentPaidUntil && pass.rentPaidUntil > 0
    ? pass.rentPaidUntil
    : pass.startDate;

  let unpaidMonths = 0;
  let checkDate = new Date(pass.startDate);

  while (checkDate.getTime() <= currentMonthStart) {
    if (effectivePaidUntil < checkDate.getTime()) {
      unpaidMonths++;
    }
    checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 1);
    // Safety break
    if (unpaidMonths > 240) break;
  }

  return {
    unpaidMonths,
    unpaidAmount: unpaidMonths * (pass.monthlyRent / 1_000_000_000),
    isPaid: unpaidMonths === 0
  };
}

function RentalRequestCard({
  request,
  onApprove,
  onReject
}: {
  request: RentalRequest;
  onApprove: () => void;
  onReject: () => void;
}) {
  const getApartment = useSiteStore((state) => state.getApartment);
  const apartment = getApartment(request.apartmentId);

  if (!apartment) return null;

  return (
    <div className="bg-card rounded-xl border p-6 mb-4 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            {request.requesterName}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {apartment.block} Blok Daire {apartment.flatNumber} için kiralama talebi
          </p>

          <div className="space-y-2 text-sm bg-muted/30 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <span>📧</span>
              <span className="font-medium">{request.requesterEmail || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📱</span>
              <span className="font-medium">{request.requesterPhone || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>Talep Edilen Süre: <strong>{request.requestedDuration} Ay</strong></span>
            </div>
            {request.message && (
              <div className="flex items-start gap-2 mt-2 pt-2 border-t">
                <span className="text-gray-500">📝</span>
                <span className="italic text-muted-foreground">&quot;{request.message}&quot;</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 min-w-[120px]">
          <div className="text-right text-xs text-muted-foreground mb-2">
            {new Date(request.createdAt).toLocaleDateString("tr-TR")}
          </div>
          {request.status === "pending" && (
            <>
              <button
                onClick={onApprove}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium w-full"
              >
                <CheckCircle2 className="w-4 h-4" />
                Onayla
              </button>
              <button
                onClick={onReject}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium w-full"
              >
                <XCircle className="w-4 h-4" />
                Reddet
              </button>
            </>
          )}
          {request.status !== "pending" && (
            <span className={`px-3 py-2 rounded-lg text-sm font-medium text-center ${request.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
              {request.status === "approved" ? "Onaylandı" : "Reddedildi"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MyRequestCard({
  request,
  onComplete,
  onCancel
}: {
  request: RentalRequest;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const getApartment = useSiteStore((state) => state.getApartment);
  const getRentalListing = useSiteStore((state) => state.rentalListings.find(l => l.id === request.listingId));

  const apartment = getApartment(request.apartmentId);
  const listing = getRentalListing;

  if (!apartment) return null;

  return (
    <div className="bg-card rounded-xl border p-6 mb-4 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Home className="w-5 h-5 text-purple-500" />
            {apartment.block} Blok Daire {apartment.flatNumber}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(request.createdAt).toLocaleDateString("tr-TR")}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {request.requestedDuration} Ay</span>
          </div>
        </div>
        <div className="text-right w-full md:w-auto">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-2 ${request.status === "approved" ? "bg-green-100 text-green-700" :
            request.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
            }`}>
            {request.status === "approved" && <CheckCircle2 className="w-4 h-4" />}
            {request.status === "rejected" && <XCircle className="w-4 h-4" />}
            {request.status === "pending" && <Clock className="w-4 h-4" />}

            {request.status === "approved" ? "Onaylandı - Ödeme Bekliyor" :
              request.status === "rejected" ? "Reddedildi" :
                request.status === "cancelled" ? "İptal Edildi" : "Onay Bekliyor"}
          </div>

          {request.status === "pending" && (
            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-2 w-full px-6 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium mb-2"
            >
              <XCircle className="w-4 h-4" />
              Talebi İptal Et
            </button>
          )}

          {request.status === "approved" && listing && (
            <button
              onClick={onComplete}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium animate-pulse shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              Öde ve Kirala
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ApartmentCard({
  apartment,
  onPayDues,
  onListForRent,
  onListForSale,
  onShowTenantDetails
}: {
  apartment: Apartment;
  onPayDues: (apt: Apartment) => void;
  onListForRent: (apt: Apartment) => void;
  onListForSale: (apt: Apartment) => void;
  onShowTenantDetails: (pass: TenantPass) => void;
}) {
  const duesStatus = getDuesStatus(apartment);

  // Rental & Sale listing status
  const getRentalListingByApartment = useSiteStore((state) => state.getRentalListingByApartment);
  const deactivateRentalListing = useSiteStore((state) => state.deactivateRentalListing);
  const getSaleListingByApartment = useSiteStore((state) => state.getSaleListingByApartment);
  const cancelSaleListing = useSiteStore((state) => state.cancelSaleListing);
  const getTenantPassByApartment = useSiteStore((state) => state.getTenantPassByApartment);

  const activeListing = getRentalListingByApartment(apartment.id);
  const activeSaleListing = getSaleListingByApartment(apartment.id);
  const tenantPass = getTenantPassByApartment(apartment.id);
  const rentStatus = tenantPass ? getRentStatus(tenantPass) : null;

  const [showListingMenu, setShowListingMenu] = useState(false);
  const [showSaleMenu, setShowSaleMenu] = useState(false);

  const handleCancelListing = () => {
    if (activeListing) {
      if (confirm("Kiralık ilanını yayından kaldırmak istediğinize emin misiniz?")) {
        deactivateRentalListing(activeListing.id);
        setShowListingMenu(false);
      }
    }
  };

  const handleCancelSaleListing = () => {
    if (activeSaleListing) {
      if (confirm("Satılık ilanını yayından kaldırmak istediğinize emin misiniz?")) {
        cancelSaleListing(activeSaleListing.id);
        setShowSaleMenu(false);
      }
    }
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      {/* NFT Badge & ID */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <div className="bg-black/50 backdrop-blur-md text-white/90 px-2 py-1 rounded text-[10px] font-mono border border-white/20">
          NFT DEED
        </div>
        <div className="bg-black/50 backdrop-blur-md text-white/90 px-2 py-1 rounded text-[10px] font-mono border border-white/20 truncate max-w-[80px]">
          #{apartment.id.slice(0, 8)}
        </div>
      </div>

      <div className="h-32 bg-gradient-to-br from-slate-800 to-slate-900 relative">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
        <div className="absolute bottom-4 left-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium tracking-wider text-blue-300">MÜLK TAPUSU</span>
          </div>
          <h3 className="text-xl font-bold tracking-tight">{apartment.block} Blok</h3>
          <p className="text-white/80 font-medium">Daire {apartment.flatNumber}</p>
        </div>
        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
          {activeListing && !apartment.isRented && (
            <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 animate-pulse">
              <span>📋</span> Kiralık
            </div>
          )}
          {activeSaleListing && (
            <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 animate-pulse">
              <span>🏷️</span> Satılık
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Info */}
        <div className="space-y-3">
          {/* Rent Status (Only if rented) */}
          {apartment.isRented && tenantPass && (
            <div className={`p-3 rounded-lg flex items-start gap-3 border ${rentStatus?.isPaid ? "bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900" : "bg-red-50/50 border-red-100"}`}>
              {rentStatus?.isPaid ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className={`font-medium text-sm ${rentStatus?.isPaid ? "text-green-700 dark:text-green-400" : "text-red-700"}`}>
                  {rentStatus?.isPaid ? "Kira Geliri Tamam" : `${rentStatus?.unpaidMonths} Ay Kira Eksik`}
                </p>
                {!rentStatus?.isPaid && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tahsil Edilecek: {rentStatus?.unpaidAmount.toFixed(2)} SUI
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Dues Status */}
          <div className={`p-3 rounded-lg flex items-start gap-3 border ${duesStatus.isPaid ? "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900" : "bg-red-50/50 border-red-100"}`}>
            {duesStatus.isPaid ? (
              <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            )}
            <div>
              <p className={`font-medium text-sm ${duesStatus.isPaid ? "text-blue-700 dark:text-blue-400" : "text-red-700"}`}>
                {duesStatus.text}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {duesStatus.daysText}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          {/* Sol Kolon: Aidat */}
          <button
            onClick={() => onPayDues(apartment)}
            disabled={apartment.isRented}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${apartment.isRented
              ? "bg-muted text-muted-foreground cursor-not-allowed border"
              : duesStatus.isPaid
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                : "bg-red-600 text-white hover:bg-red-700"
              }`}
          >
            <Banknote className="w-4 h-4" />
            {apartment.isRented ? "Aidat (Kiracı)" : duesStatus.isPaid ? "Aidat Geçmişi" : "Aidat Öde"}
          </button>

          {/* Sağ Kolon: Yönetim (Kira/Satış) */}
          <div className="flex flex-col gap-2">
            {/* Kiradaki Ev */}
            {apartment.isRented ? (
              <button
                onClick={() => tenantPass && onShowTenantDetails(tenantPass)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg text-sm font-medium border border-purple-200 dark:border-purple-800 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                <User className="w-4 h-4" />
                Kiracı Profili
              </button>
            ) : (
              /* Boş Ev Aksiyonları */
              <>
                {/* Kiralama Butonu */}
                {activeListing ? (
                  <div className="relative z-20">
                    <button
                      onClick={() => setShowListingMenu(!showListingMenu)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                    >
                      <Home className="w-4 h-4" />
                      İlanı Yönet <ChevronDown className="w-3 h-3" />
                    </button>
                    {showListingMenu && (
                      <div className="absolute  bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-xl overflow-hidden">
                        <button
                          onClick={() => {
                            onListForRent(apartment);
                            setShowListingMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                        >
                          <span>✏️</span> Düzenle
                        </button>
                        <button
                          onClick={handleCancelListing}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2"
                        >
                          <span>❌</span> İlanı Kaldır
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onListForRent(apartment)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Key className="w-4 h-4" />
                    Kiraya Ver
                  </button>
                )}

                {/* Satış Butonu */}
                {activeSaleListing ? (
                  <div className="relative z-10">
                    <button
                      onClick={() => setShowSaleMenu(!showSaleMenu)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm font-medium"
                    >
                      <Tag className="w-4 h-4" />
                      {activeSaleListing.price / 1_000_000_000} SUI <ChevronDown className="w-3 h-3" />
                    </button>
                    {showSaleMenu && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-xl overflow-hidden">
                        <button
                          onClick={handleCancelSaleListing}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2"
                        >
                          <span>❌</span> Satışı İptal Et
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onListForSale(apartment)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Tag className="w-4 h-4" />
                    Satışa Çıkar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantPassCard({ pass }: { pass: TenantPass }) {
  const isValid = Date.now() < pass.expiryDate;
  const [showPayDues, setShowPayDues] = useState(false);
  const [showPayRent, setShowPayRent] = useState(false);
  const getApartment = useSiteStore(s => s.getApartment);
  const apartment = getApartment(pass.apartmentId);

  const duesStatus = apartment ? getDuesStatus(apartment) : { unpaidMonths: 0, totalUnpaidAmount: 0, isPaid: true };
  const rentStatus = getRentStatus(pass);

  return (
    <div className="relative group">
      {/* Glow Effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${isValid ? 'from-green-500 to-emerald-500' : 'from-red-500 to-orange-500'} rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500`}></div>

      <div className="relative bg-card rounded-xl border overflow-hidden">
        {/* Card Header (Identity Style) */}
        <div className={`h-24 relative p-4 flex flex-col justify-between ${isValid ? 'bg-gradient-to-r from-green-600 to-emerald-700' : 'bg-gradient-to-r from-red-600 to-red-800'}`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-1.5 text-white/90">
              <div className="p-1 bg-white/20 rounded">
                <Users className="w-4 h-4" />
              </div>
              <span className="font-mono text-xs font-bold tracking-widest">SITEDAO IDENTITY</span>
            </div>
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isValid ? 'bg-green-400/20 border-green-200/50 text-green-50' : 'bg-red-400/20 border-red-200/50 text-red-50'}`}>
              {isValid ? 'ACTIVE' : 'EXPIRED'}
            </div>
          </div>

          <div className="text-white">
            <div className="text-[10px] text-white/60 font-mono mb-0.5">TOKEN ID</div>
            <div className="font-mono text-sm tracking-wider flex items-center gap-2">
              {pass.id.slice(0, 12)}...
              <span className="bg-white/20 text-[9px] px-1.5 py-0.5 rounded">SBT</span>
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* Photo / Avatar Placeholder */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center border-2 border-background shadow-sm -mt-10 relative z-10">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-none">{pass.apartmentBlock} Blok</h3>
                <p className="text-sm text-muted-foreground mt-1">Daire {pass.apartmentFlat}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-muted-foreground font-medium mb-0.5">Kira Durumu</div>
              <div className={`text-xs font-bold px-2 py-1 rounded-full inline-block ${rentStatus.isPaid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700'}`}>
                {rentStatus.isPaid ? 'DÜZENLİ' : 'GECİKMİŞ'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div className="bg-muted/40 p-2 rounded">
              <span className="block text-muted-foreground mb-1">Başlangıç</span>
              <span className="font-medium text-foreground">{new Date(pass.startDate).toLocaleDateString("tr-TR")}</span>
            </div>
            <div className="bg-muted/40 p-2 rounded">
              <span className="block text-muted-foreground mb-1">Geçerlilik</span>
              <span className="font-medium text-foreground">{new Date(pass.expiryDate).toLocaleDateString("tr-TR")}</span>
            </div>
          </div>

          <div className="text-[10px] text-center text-muted-foreground font-mono bg-muted/20 p-1.5 rounded mb-4 border border-dashed">
            ⛔ NON-TRANSFERABLE (SOULBOUND)
          </div>

          {/* Overdue Alerts */}
          {(rentStatus.unpaidMonths > 0 || duesStatus.unpaidMonths > 0) && (
            <div className="mb-4 space-y-2">
              {rentStatus.unpaidMonths > 0 && (
                <div className="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 p-2 rounded-lg text-xs font-bold border border-red-100 dark:border-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>{rentStatus.unpaidMonths} ay kira gecikmesi ({rentStatus.unpaidAmount.toFixed(2)} SUI)</span>
                </div>
              )}
              {duesStatus.unpaidMonths > 0 && (
                <div className="bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 p-2 rounded-lg text-xs font-bold border border-orange-100 dark:border-orange-900 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>{duesStatus.unpaidMonths} ay aidat gecikmesi</span>
                </div>
              )}
            </div>
          )}

          {isValid && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowPayRent(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-xs font-bold transition-all shadow-sm"
              >
                <Banknote className="w-3.5 h-3.5" />
                Kira Öde
              </button>
              <button
                onClick={() => setShowPayDues(true)}
                disabled={!apartment}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                <Building2 className="w-3.5 h-3.5" />
                Aidat Öde
              </button>
            </div>
          )}
        </div>

        {showPayRent && (
          <PayRentModal pass={pass} onClose={() => setShowPayRent(false)} />
        )}
        {showPayDues && apartment && (
          <PayDuesModal apartment={apartment} onClose={() => setShowPayDues(false)} />
        )}
      </div>
    </div>
  );
}



// ... (existing imports)

export default function DashboardPage() {
  const account = useCurrentAccount();
  const {
    address,
    email,
    name,
    isConnected: zkLoginConnected,
    signAndExecuteTransaction: zkLoginSignAndExecute,
  } = useZkLogin();
  const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();

  const signAndExecute = async (params: { transaction: Transaction }) => {
    if (zkLoginConnected) {
      return await zkLoginSignAndExecute(params.transaction);
    }
    return await walletSignAndExecute(params);
  };

  // Local state
  const [mounted, setMounted] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showRentModal, setShowRentModal] = useState(false);
  const [showListForSaleModal, setShowListForSaleModal] = useState(false);
  const [showCompleteRentalModal, setShowCompleteRentalModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RentalRequest | null>(null);
  const [selectedTenantPass, setSelectedTenantPass] = useState<TenantPass | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<ActivityLog | null>(null);

  // Store actions & selectors
  const getApartmentsByOwner = useSiteStore((state) => state.getApartmentsByOwner);
  const getTenantPassesByHolder = useSiteStore((state) => state.getTenantPassesByHolder);
  const approveRentalRequest = useSiteStore((state) => state.approveRentalRequest);
  const rejectRentalRequest = useSiteStore((state) => state.rejectRentalRequest);

  // Kiralama talebine verilen yanıt zincire yazılır; talebin zincir kaydı yoksa
  // yalnızca yerel veri güncellenir (demo modu).
  const respondToRequest = async (
    request: { id: string; onChainId?: string },
    approve: boolean
  ) => {
    const onChainEnabled = !!(PACKAGE_ID && request.onChainId);

    if (onChainEnabled && connectedAddress) {
      try {
        const tx = new Transaction();
        tx.setSender(connectedAddress);
        tx.moveCall({
          target: `${PACKAGE_ID}::rent_market::${approve ? "approve_rental_request" : "reject_rental_request"}`,
          arguments: [tx.object(request.onChainId!)],
        });
        await signAndExecute({ transaction: tx });
      } catch (error) {
        console.error("Talep yanıtı zincire yazılamadı, demo modunda devam ediliyor:", error);
      }
    }

    if (approve) {
      approveRentalRequest(request.id);
    } else {
      rejectRentalRequest(request.id);
    }
  };
  const cancelRentalRequest = useSiteStore((state) => state.cancelRentalRequest);
  const completeRental = useSiteStore((state) => state.completeRental);
  const createTenantPass = useSiteStore((state) => state.createTenantPass);
  const getRentalRequestsByOwner = useSiteStore((state) => state.getRentalRequestsByOwner);
  const rentalRequests = useSiteStore((state) => state.rentalRequests);
  const getUserProfile = useSiteStore((state) => state.getUserProfile);
  const activityLogs = useSiteStore((state) => state.activityLogs);

  const connectedAddress = account?.address || address;

  // Filter financial history
  const financialHistory = connectedAddress ? activityLogs.filter(log => {
    // Ödemeler: Kira veya Aidat (yapan kişi)
    if (log.actor.toLowerCase() === connectedAddress.toLowerCase() &&
      (log.type === 'rent_paid' || log.type === 'dues_paid')) {
      return true;
    }
    // Satışlar: Alan veya Satan
    if (log.type === 'apartment_sold') {
      return log.actor.toLowerCase() === connectedAddress.toLowerCase() ||
        log.details.seller?.toLowerCase() === connectedAddress.toLowerCase();
    }
    return false;
  }).sort((a, b) => b.timestamp - a.timestamp) : [];

  // Data queries
  const apartments = connectedAddress ? getApartmentsByOwner(connectedAddress) : [];
  const rawTenantPasses = connectedAddress ? getTenantPassesByHolder(connectedAddress) : [];
  // Dedup passes by apartmentId, keep latest
  const tenantPasses = Object.values(rawTenantPasses.reduce((acc, curr) => {
    if (!acc[curr.apartmentId] || acc[curr.apartmentId].createdAt < curr.createdAt) {
      acc[curr.apartmentId] = curr;
    }
    return acc;
  }, {} as Record<string, TenantPass>));
  const incomingRequests = connectedAddress ? getRentalRequestsByOwner(connectedAddress) : [];
  const myRequests = connectedAddress ? rentalRequests.filter(r => r.requesterAddress === connectedAddress && r.status !== "completed") : [];



  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handlePayDues = (apt: Apartment) => {
    setSelectedApartment(apt);
    setShowPayModal(true);
  };

  const handleListForRent = (apt: Apartment) => {
    setSelectedApartment(apt);
    setShowRentModal(true);
  };

  const handleListForSale = (apt: Apartment) => {
    setSelectedApartment(apt);
    setShowListForSaleModal(true);
  };

  const handleCompleteRental = async (request: RentalRequest) => {
    setSelectedRequest(request);
    setShowCompleteRentalModal(true);
  };

  if (!connectedAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="bg-primary/10 p-6 rounded-full mb-6">
          <Wallet className="w-16 h-16 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Cüzdan Bağlı Değil</h2>
        <p className="text-muted-foreground max-w-md">
          Dairelerinizi yönetmek ve aidat ödemek için lütfen cüzdanınızı bağlayın veya Google ile giriş yapın.
        </p>
      </div>
    );
  }

  // Profile Enforcement
  const userProfile = connectedAddress ? getUserProfile(connectedAddress) : null;
  const isProfileComplete = !!(userProfile?.displayName && userProfile?.email && userProfile?.phone);

  if (!isProfileComplete) {
    return (
      <CompleteProfileModal
        address={connectedAddress}
        initialData={{
          email: email || undefined,
          displayName: name || undefined
        }}
        onSuccess={() => window.location.reload()}
      />
    );
  }

  const hasNoAssets = apartments.length === 0 && tenantPasses.length === 0 && incomingRequests.length === 0 && myRequests.length === 0;

  if (hasNoAssets) {
    return (
      <div className="min-h-screen pb-20">
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-4 border rounded-xl bg-card">
            <div className="bg-primary/10 p-6 rounded-full mb-6">
              <Building2 className="w-16 h-16 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Henüz Bir Varlığınız Yok</h2>
            <p className="text-muted-foreground max-w-md">
              Kayıtlı bir daireniz veya kiracı kimliğiniz bulunmamaktadır.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Incoming Requests Section (For Owners) */}
        {incomingRequests.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
              <User className="w-6 h-6 text-blue-500" />
              Gelen Kiralama Talepleri
              <span className="text-sm font-normal text-muted-foreground ml-2">({incomingRequests.length})</span>
            </h2>
            <div className="grid gap-4">
              {incomingRequests.map(req => (
                <RentalRequestCard
                  key={req.id}
                  request={req}
                  onApprove={() => respondToRequest(req, true)}
                  onReject={() => respondToRequest(req, false)}
                />
              ))}
            </div>
          </div>
        )}

        {/* My Requests Section (For Tenants) */}
        {myRequests.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
              <Home className="w-6 h-6 text-purple-500" />
              Kiralama Taleplerim
              <span className="text-sm font-normal text-muted-foreground ml-2">({myRequests.length})</span>
            </h2>
            <div className="grid gap-4">
              {myRequests.map(req => (
                <MyRequestCard
                  key={req.id}
                  request={req}
                  onComplete={() => handleCompleteRental(req)}
                  onCancel={() => {
                    if (confirm("Başvuruyu iptal etmek istediğinize emin misiniz?")) {
                      cancelRentalRequest(req.id);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Owner Apartments Section */}
        {apartments.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
              <Building2 className="w-6 h-6 text-blue-500" />
              Mülklerim (NFT Tapu)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apartments.map((apt) => (
                <ApartmentCard
                  key={apt.id}
                  apartment={apt}
                  onPayDues={handlePayDues}
                  onListForRent={handleListForRent}
                  onListForSale={handleListForSale}
                  onShowTenantDetails={(pass) => setSelectedTenantPass(pass)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tenant Passes Section */}
        {tenantPasses.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
              <Key className="w-6 h-6 text-green-500" />
              Kimlik Kartlarım (SBT)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenantPasses.map((pass) => (
                <TenantPassCard key={pass.id} pass={pass} />
              ))}
            </div>
          </div>
        )}

        {/* Financial History Section */}
        {financialHistory.length > 0 && (
          <div className="mb-10 animate-fade-in">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 border-b pb-2">
              <Banknote className="w-6 h-6 text-green-600" />
              Finansal Geçmiş
            </h2>
            <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left font-medium text-muted-foreground">Tarih</th>
                      <th className="px-6 py-4 text-left font-medium text-muted-foreground">İşlem</th>
                      <th className="px-6 py-4 text-left font-medium text-muted-foreground">Tutar</th>
                      <th className="px-6 py-4 text-right font-medium text-muted-foreground">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {financialHistory.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          {new Date(log.timestamp).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {log.type === 'rent_paid' && "Kira Ödemesi"}
                          {log.type === 'dues_paid' && "Aidat Ödemesi"}
                          {log.type === 'apartment_sold' && (
                            log.actor.toLowerCase() === connectedAddress?.toLowerCase()
                              ? "Daire Satın Alımı"
                              : "Daire Satışı"
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-medium">
                          {log.type === 'apartment_sold'
                            ? (log.details.price / 1_000_000_000).toLocaleString('tr-TR')
                            : (log.details.amount / 1_000_000_000).toLocaleString('tr-TR')
                          } SUI
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedTransaction(log)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Banknote className="w-3 h-3" />
                            Fatura Görüntüle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Modals */}
      {selectedTenantPass && (
        <TenantDetailsModal
          pass={selectedTenantPass}
          onClose={() => setSelectedTenantPass(null)}
        />
      )}
      {selectedApartment && showPayModal && (
        <PayDuesModal
          onClose={() => setShowPayModal(false)}
          apartment={selectedApartment}
        />
      )}
      {selectedApartment && showRentModal && (
        <ListForRentModal
          onClose={() => setShowRentModal(false)}
          apartment={selectedApartment}
          onSuccess={() => setShowRentModal(false)}
        />
      )}
      {selectedApartment && showListForSaleModal && (
        <ListForSaleModal
          apartment={selectedApartment}
          onClose={() => setShowListForSaleModal(false)}
          onSuccess={() => setShowListForSaleModal(false)}
        />
      )}
      {showCompleteRentalModal && selectedRequest && (
        <CompleteRentalModal
          request={selectedRequest}
          onClose={() => setShowCompleteRentalModal(false)}
          onSuccess={() => {
            // Refreshed by state update
          }}
        />
      )}
      {selectedTransaction && (
        <InvoiceModal
          open={!!selectedTransaction}
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}
