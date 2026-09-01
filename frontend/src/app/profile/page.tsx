"use client";

import { useCurrentAccount, useCurrentWallet, useSuiClientQuery } from "@mysten/dapp-kit";
import { User, Mail, Wallet, Building2, Key, ArrowLeft, Copy, ExternalLink, Shield, Coins, Edit3, Phone, FileText } from "lucide-react";
import Link from "next/link";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useState, useEffect } from "react";
import { isAdminEmail } from "@/lib/constants";
import { useSiteStore, type Apartment, type TenantPass } from "@/lib/store";
import { ProfileEditModal } from "@/components/modals/ProfileEditModal";
import { CompleteProfileModal } from "@/components/modals/CompleteProfileModal";

export default function ProfilePage() {
  const account = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const {
    isConnected: zkLoginConnected,
    address: zkLoginAddress,
    email: zkLoginEmail,
    name: zkLoginName,
    givenName: zkLoginGivenName,
    familyName: zkLoginFamilyName,
    picture: zkLoginPicture,
    logout: zkLogout
  } = useZkLogin();

  // Store'dan verileri al
  const getApartmentsByOwner = useSiteStore((state) => state.getApartmentsByOwner);
  const getTenantPassesByHolder = useSiteStore((state) => state.getTenantPassesByHolder);
  const getApartmentsWhereResident = useSiteStore((state) => state.getApartmentsWhereResident);
  const getUserProfile = useSiteStore((state) => state.getUserProfile);

  // Bağlı adres
  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;
  const isConnected = zkLoginConnected || !!account?.address;

  // Hydration için
  useEffect(() => {
    setMounted(true);
  }, []);

  // Store'dan verileri al
  const apartments: Apartment[] = mounted && connectedAddress
    ? getApartmentsByOwner(connectedAddress)
    : [];
  const rawTenantPasses: TenantPass[] = mounted && connectedAddress
    ? getTenantPassesByHolder(connectedAddress)
    : [];

  const tenantPasses = Object.values(rawTenantPasses.reduce((acc, curr) => {
    if (!acc[curr.apartmentId] || acc[curr.apartmentId].createdAt < curr.createdAt) {
      acc[curr.apartmentId] = curr;
    }
    return acc;
  }, {} as Record<string, TenantPass>));

  // Kullanıcının oturduğu daireler (aidat ödemesi gereken)
  const residingApartments: Apartment[] = mounted && connectedAddress
    ? getApartmentsWhereResident(connectedAddress)
    : [];

  // Kullanıcı profil verisi
  const userProfileData = mounted && connectedAddress
    ? getUserProfile(connectedAddress)
    : undefined;

  // SUI Bakiyesini sorgula
  const { data: balanceData, isLoading: balanceLoading } = useSuiClientQuery(
    "getBalance",
    {
      owner: connectedAddress || "",
      coinType: "0x2::sui::SUI",
    },
    {
      enabled: !!connectedAddress,
    }
  );

  // Bakiye hesapla (MIST'ten SUI'ye çevir)
  const suiBalance = balanceData
    ? Number(balanceData.totalBalance) / 1_000_000_000
    : 0;

  // Kullanıcı bilgileri - önce store'dan, sonra zkLogin'den
  const accountLabel = account?.label || null;
  const userName = userProfileData?.displayName
    || (zkLoginConnected ? (zkLoginName || (zkLoginGivenName && zkLoginFamilyName ? `${zkLoginGivenName} ${zkLoginFamilyName}` : null)) : accountLabel);
  const userEmail = userProfileData?.email || zkLoginEmail || null;
  const userPhone = userProfileData?.phone || null;
  const userBio = userProfileData?.bio || null;
  const userPicture = userProfileData?.avatarUrl || zkLoginPicture || null;

  // Yönetici kontrolü
  const isAdmin = isAdminEmail(zkLoginEmail);

  // Kullanıcı rolünü belirle
  const getUserRole = () => {
    if (isAdmin) {
      return "admin";
    }
    if (apartments.length > 0 && tenantPasses.length > 0) {
      return "owner-with-tenant";
    } else if (apartments.length > 0) {
      return apartments.some(a => a.isRented) ? "owner-with-tenant" : "owner";
    } else if (tenantPasses.length > 0) {
      return "tenant";
    }
    return "visitor";
  };

  const userRole = getUserRole();

  // Adresi kopyala
  const copyAddress = () => {
    if (connectedAddress) {
      navigator.clipboard.writeText(connectedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Aidat durumunu hesapla
  const getOverallDuesStatus = () => {
    if (residingApartments.length === 0) return { hasOverdue: false, totalOverdue: 0 };

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let totalOverdue = 0;
    let hasOverdue = false;

    for (const apt of residingApartments) {
      let unpaidMonths = 0;
      let checkDate = new Date(2026, 0, 1);

      while (checkDate.getTime() <= currentMonthStart) {
        if (apt.duesPaidUntil < checkDate.getTime()) {
          unpaidMonths++;
        }
        checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 1);
      }

      if (unpaidMonths > 0) {
        hasOverdue = true;
        totalOverdue += unpaidMonths * 0.1;
      }
    }

    return { hasOverdue, totalOverdue };
  };

  const duesStatus = mounted ? getOverallDuesStatus() : { hasOverdue: false, totalOverdue: 0 };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <User className="w-10 h-10 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Giriş Yapın</h1>
          <p className="text-muted-foreground mb-6">
            Profil bilgilerinizi görüntülemek için lütfen giriş yapın.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  // Profile Enforcement
  const isProfileComplete = !!(userProfileData?.displayName && userProfileData?.email && userProfileData?.phone);

  if (isConnected && !isProfileComplete && connectedAddress) {
    return (
      <CompleteProfileModal
        address={connectedAddress}
        initialData={{
          email: userProfileData?.email || zkLoginEmail || undefined,
          displayName: userProfileData?.displayName || zkLoginName || undefined,
          phone: userProfileData?.phone || undefined
        }}
        onSuccess={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Geri Butonu */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Konutlarıma Dön
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Kolon - Profil Kartı */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* Profil Başlık */}
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-8 text-white text-center relative">
              {/* Düzenle Butonu */}
              <button
                onClick={() => setShowEditModal(true)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                title="Profili Düzenle"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              {userPicture ? (
                <img
                  src={userPicture}
                  alt={userName || "Profil"}
                  className="w-24 h-24 rounded-full border-4 border-white/30 mx-auto mb-4 object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                  <User className="w-12 h-12" />
                </div>
              )}
              <h1 className="text-xl font-bold">
                {userName || "Kullanıcı"}
              </h1>
              <p className="text-sm opacity-80 mt-1">
                {zkLoginConnected ? "Google ile bağlandı" : "Cüzdan ile bağlandı"}
              </p>

              {/* Rol Badge */}
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-sm">
                  <Shield className="w-3 h-3" />
                  {userRole === "admin" ? "Yönetici" :
                    userRole === "owner" ? "Ev Sahibi" :
                      userRole === "tenant" ? "Kiracı" :
                        userRole === "owner-with-tenant" ? "Ev Sahibi (Kirada)" :
                          "Ziyaretçi"}
                </span>
              </div>
            </div>

            {/* Profil Detayları */}
            <div className="p-6 space-y-4">
              {/* Ad Soyad */}
              {userName && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ad Soyad</p>
                    <p className="font-medium">{userName}</p>
                  </div>
                </div>
              )}

              {/* E-posta */}
              {userEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">E-posta</p>
                    <p className="font-medium">{userEmail}</p>
                  </div>
                </div>
              )}

              {/* Telefon */}
              {userPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Telefon</p>
                    <p className="font-medium">{userPhone}</p>
                  </div>
                </div>
              )}

              {/* Biyografi */}
              {userBio && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Hakkımda</p>
                    <p className="text-sm">{userBio}</p>
                  </div>
                </div>
              )}

              {/* Cüzdan Adresi */}
              {connectedAddress && (
                <div className="flex items-start gap-3">
                  <Wallet className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cüzdan Adresi</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm truncate">{connectedAddress}</p>
                      <button
                        onClick={copyAddress}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Kopyala"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    {copied && (
                      <p className="text-xs text-green-500 mt-1">Kopyalandı!</p>
                    )}
                  </div>
                </div>
              )}

              {/* SUI Bakiye */}
              {connectedAddress && (
                <div className="flex items-start gap-3">
                  <Coins className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">SUI Bakiye</p>
                    <div className="flex items-center gap-2">
                      {balanceLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-gray-500">Yükleniyor...</span>
                        </div>
                      ) : (
                        <>
                          <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                            {suiBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </p>
                          <span className="text-sm text-gray-500 dark:text-gray-400">SUI</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sui Explorer Link */}
              {connectedAddress && (
                <a
                  href={`https://suiscan.xyz/testnet/account/${connectedAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 mt-4"
                >
                  <ExternalLink className="w-4 h-4" />
                  Sui Explorer&apos;da Görüntüle
                </a>
              )}
            </div>

            {/* Çıkış ve Düzenle Butonları */}
            <div className="px-6 pb-6 space-y-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full py-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Profili Düzenle
              </button>
              <button
                onClick={zkLogout}
                className="w-full py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-medium transition-colors"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>

        {/* Sağ Kolon - Özet Kartlar */}
        <div className="md:col-span-2 space-y-6">
          {/* Özet İstatistikler */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Daireler</span>
              </div>
              <p className="text-2xl font-bold">{apartments.length}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-muted-foreground">Kiracı Kart</span>
              </div>
              <p className="text-2xl font-bold">{tenantPasses.length}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-cyan-500" />
                <span className="text-sm text-muted-foreground">SUI</span>
              </div>
              <p className="text-2xl font-bold">{suiBalance.toFixed(2)}</p>
            </div>

            <div className={`rounded-xl p-4 shadow-lg ${duesStatus.hasOverdue ? 'bg-red-50 dark:bg-red-950' : 'bg-green-50 dark:bg-green-950'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Coins className={`w-5 h-5 ${duesStatus.hasOverdue ? 'text-red-500' : 'text-green-500'}`} />
                <span className={`text-sm ${duesStatus.hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  Aidat
                </span>
              </div>
              <p className={`text-2xl font-bold ${duesStatus.hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {duesStatus.hasOverdue ? `${duesStatus.totalOverdue.toFixed(2)}` : "Güncel"}
              </p>
            </div>
          </div>

          {/* Sahip Olunan Daireler Özet */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                Sahip Olduğum Daireler
              </h2>
              <Link
                href="/dashboard"
                className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                Detaylı Görüntüle →
              </Link>
            </div>

            {apartments.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {apartments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                        {apt.flatNumber}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{apt.block}</p>
                        <p className="text-xs text-muted-foreground">
                          Daire {apt.flatNumber}
                        </p>
                      </div>
                    </div>
                    {apt.isRented && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded">
                        Kirada
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Henüz sahip olduğunuz daire bulunmuyor.
              </p>
            )}
          </div>

          {/* Kiracı Kartları Özet */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-500" />
                Kiracı Kartlarım
              </h2>
              <Link
                href="/dashboard"
                className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                Detaylı Görüntüle →
              </Link>
            </div>

            {tenantPasses.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tenantPasses.map((pass) => {
                  const isExpired = pass.expiryDate < Date.now();
                  const daysLeft = Math.ceil((pass.expiryDate - Date.now()) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={pass.id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{pass.apartmentBlock}</p>
                          <p className="text-xs text-muted-foreground">
                            Daire {pass.apartmentFlat}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${isExpired
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        }`}>
                        {isExpired ? "Süresi Dolmuş" : `${daysLeft} gün`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Kiracı kartınız bulunmuyor.
              </p>
            )}
          </div>

          {/* Konutlarıma Yönlendirme */}
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">
              Detaylı Bilgiler Konutlarım Sayfasında
            </h3>
            <p className="text-sm opacity-90 mb-4">
              Dairelerinizi yönetmek, aidat ödemek ve kiracı kartlarınızın tüm detaylarını görmek için Konutlarım sayfasına gidin.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Konutlarıma Git →
            </Link>
          </div>
        </div>
      </div>

      {/* Profil Düzenleme Modalı */}
      <ProfileEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />
    </div>
  );
}
