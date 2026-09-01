import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAdminEmail } from "@/lib/constants";
import type {
  Apartment,
  TenantPass,
  RentalListing,
  RentalRequest,
  Proposal,
  Treasury,
  DuesPayment,
  ActivityLog,
  SiteConfig,
  Notification,
  NotificationType,
  ProposalComment,
  UserProfileData,
  SaleListing,
  RoutineExpense,
} from "./types";

// Rastgele ID oluştur
const generateId = () => `0x${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;

// Rastgele cüzdan adresi oluştur
const generateWalletAddress = () => `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

// Demo sahip cüzdan adresleri (kurgusal - gerçek bir cüzdana ait değildir)
export const DEMO_OWNER_A = "0x0a00000000000000000000000000000000000000000000000000000000000001";
export const DEMO_OWNER_B = "0x0b00000000000000000000000000000000000000000000000000000000000002";
export const DEMO_OWNER_C = "0x0c00000000000000000000000000000000000000000000000000000000000003";
export const DEMO_OWNER_D = "0x0d00000000000000000000000000000000000000000000000000000000000004";
export const DEMO_TENANT_A = "0x1a00000000000000000000000000000000000000000000000000000000000011";
export const DEMO_TENANT_B = "0x1b00000000000000000000000000000000000000000000000000000000000012";

// E-posta adresi -> Cüzdan adresi eşleştirmesi (zkLogin kullanıcıları için)
// Bu harita, zkLogin ile giriş yapan demo kullanıcılarının daireleri görmesini sağlar.
// Tümü kurgusaldır; gerçek bir kişiyi veya cüzdanı temsil etmez.
// Gerçek bir kurulumda bu eşleştirme zincir üzerindeki sahiplikten okunmalıdır.
export const EMAIL_TO_ADDRESS_MAP: Record<string, string> = {
  // A Blok sahibi (Daire 1, 2, 3)
  "ayse.demir@example.com": DEMO_OWNER_A,
  // B Blok sahibi (Daire 1, 2)
  "mehmet.yilmaz@example.com": DEMO_OWNER_B,
  // C Blok sahibi (Daire 1, 2)
  "zeynep.kaya@example.com": DEMO_OWNER_C,
  // B/C Blok Daire 3 sahibi
  "can.aydin@example.com": DEMO_OWNER_D,
};

// E-posta adresinden cüzdan adresini al
export const getAddressFromEmail = (email: string): string | null => {
  return EMAIL_TO_ADDRESS_MAP[email.toLowerCase()] || null;
};

// Site konfigürasyonu
const SITE_CONFIG: SiteConfig = {
  name: "SiteDAO Rezidans",
  blocks: ["A Blok", "B Blok", "C Blok"],
  monthlyDues: 100_000_000, // 0.1 SUI
  votingPeriodDays: 7,
  adminAddress: DEMO_OWNER_B,
};

// Başlangıç daireleri - 3 blok x 3 daire = 9 daire
const createInitialApartments = (): Apartment[] => {
  const apartments: Apartment[] = [];
  const now = Date.now();

  // Demo daire verileri (kurgusal)
  const seedApartments: Partial<Apartment>[] = [
    {
      id: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      owner: DEMO_OWNER_A,
      block: "A Blok",
      flatNumber: 1,
      isRented: false,
      isOwnerOccupied: true,
    },
    {
      id: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b3",
      owner: DEMO_OWNER_A,
      block: "A Blok",
      flatNumber: 2,
      isRented: false,
      isOwnerOccupied: true,
    },
    {
      id: "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b4",
      owner: DEMO_OWNER_A,
      block: "A Blok",
      flatNumber: 3,
      isRented: true,
      isOwnerOccupied: false,
      tenantAddress: DEMO_TENANT_A,
      monthlyRent: 1_200_000_000,
    },
    {
      id: "0x4048e96908fc452563a67806a4d25441d13f1edb366df30bcd4acb79869faf40",
      owner: DEMO_OWNER_B,
      block: "B Blok",
      flatNumber: 1,
      isRented: true,
      isOwnerOccupied: false,
      tenantAddress: DEMO_TENANT_B,
      monthlyRent: 1_000_000_000,
    },
    {
      id: "0x95c6daca1358db63eee20308bb7f8571cea3502e6b2a3f859638af9403f2b617",
      owner: DEMO_OWNER_B,
      block: "B Blok",
      flatNumber: 2,
      isRented: false,
      isOwnerOccupied: true,
    },
    {
      id: "0xc1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2e3f4a5b6c1d2",
      owner: DEMO_OWNER_C,
      block: "C Blok",
      flatNumber: 1,
      isRented: false,
      isOwnerOccupied: true,
    },
    {
      id: "0xd2e3f4a5b6c7d2e3f4a5b6c7d2e3f4a5b6c7d2e3f4a5b6c7d2e3f4a5b6c7d2e3",
      owner: DEMO_OWNER_C,
      block: "C Blok",
      flatNumber: 2,
      isRented: false,
      isOwnerOccupied: true,
    },
    // B Blok Daire 3
    {
      id: "0xb3c4d5e6f7a8b3c4d5e6f7a8b3c4d5e6f7a8b3c4d5e6f7a8b3c4d5e6f7a8b3c4",
      owner: DEMO_OWNER_D,
      block: "B Blok",
      flatNumber: 3,
      isRented: false,
      isOwnerOccupied: true,
    },
    // C Blok Daire 3
    {
      id: "0xc3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4",
      owner: DEMO_OWNER_D,
      block: "C Blok",
      flatNumber: 3,
      isRented: false,
      isOwnerOccupied: true,
    },
  ];

  // Demo daireleri ekle
  seedApartments.forEach((apt) => {
    apartments.push({
      id: apt.id!,
      owner: apt.owner!,
      block: apt.block!,
      flatNumber: apt.flatNumber!,
      duesPaidUntil: 0,
      isRented: apt.isRented ?? false,
      isOwnerOccupied: apt.isOwnerOccupied ?? false,
      tenantAddress: apt.tenantAddress,
      monthlyRent: apt.monthlyRent,
      createdAt: now,
    });
  });

  // Diğer daireleri oluştur (otomatik sahip atama)
  SITE_CONFIG.blocks.forEach((block) => {
    [1, 2, 3].forEach((flatNumber) => {
      // Zaten var mı kontrol et
      const exists = apartments.some(
        (a) => a.block === block && a.flatNumber === flatNumber
      );
      if (!exists) {
        apartments.push({
          id: generateId(),
          owner: generateWalletAddress(), // Otomatik sahip atama
          block,
          flatNumber,
          duesPaidUntil: 0,
          isRented: false,
          isOwnerOccupied: false,
          createdAt: now,
        });
      }
    });
  });

  return apartments;
};

// Başlangıç kiracı kartları
const createInitialTenantPasses = (): TenantPass[] => {
  const now = Date.now();
  return [
    {
      id: "0xaf1c167e87f976b9b4661033e7c7fd7ccb3b20162f4257b8e4695eaad71be820",
      holder: DEMO_TENANT_B,
      apartmentId: "0x4048e96908fc452563a67806a4d25441d13f1edb366df30bcd4acb79869faf40",
      apartmentBlock: "B Blok",
      apartmentFlat: 1,
      startDate: now,
      expiryDate: now + 12 * 30 * 24 * 60 * 60 * 1000, // 12 ay
      monthlyRent: 1_000_000_000,
      rentPaidUntil: now,
      createdAt: now,
    },
  ];
};

// Başlangıç teklif verileri
const createInitialProposals = (): Proposal[] => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  return [
    {
      id: "prop_1",
      proposalId: 1,
      creator: SITE_CONFIG.adminAddress,
      ipfsHash: "QmHash1",
      recipient: DEMO_OWNER_A, // Havuz servisi
      title: "Havuz Bakımı ve Onarımı",
      description: "Yaz sezonu öncesi havuz motorlarının bakımı, fayansların onarımı ve ilaçlama işlemleri için bütçe ayrılması.",
      amount: 450_000_000_000, // 450 SUI
      votingEndsAt: now + 2 * dayMs, // 2 gün sonra bitiyor
      yesVotes: 3,
      noVotes: 0,
      voters: {
        DEMO_OWNER_A: { vote: true, weight: 1, type: "owner" },
        DEMO_OWNER_C: { vote: true, weight: 1, type: "owner" },
        DEMO_OWNER_D: { vote: true, weight: 1, type: "owner" },
      },
      createdAt: now - 1 * dayMs,
      isActive: true,
      isExecuted: false,
    },
    {
      id: "prop_2",
      proposalId: 2,
      creator: SITE_CONFIG.adminAddress,
      ipfsHash: "QmHash2",
      recipient: DEMO_OWNER_B, // Güvenlik şirketi
      title: "Güvenlik Kameraları Yenileme",
      description: "Mevcut analog kamera sisteminin IP kameralar ile değiştirilmesi ve kayıt cihazının yenilenmesi.",
      amount: 1500_000_000_000, // 1500 SUI
      votingEndsAt: now - 2 * dayMs, // Oylama bitmiş
      yesVotes: 8,
      noVotes: 1,
      voters: {},
      createdAt: now - 10 * dayMs,
      isActive: true,
      isExecuted: false, // Onaylandı ama henüz fatura bekleniyor (awaiting_invoice)
    },
    {
      id: "prop_3",
      proposalId: 3,
      creator: SITE_CONFIG.adminAddress,
      ipfsHash: "QmHash3",
      recipient: DEMO_OWNER_C, // Çatı ustası
      title: "Çatı İzolasyon Tamiri",
      description: "B Blok çatısındaki su sızıntılarının giderilmesi.",
      amount: 300_000_000_000, // 300 SUI
      votingEndsAt: now - 30 * dayMs, // Çoktan bitmiş
      yesVotes: 9,
      noVotes: 0,
      voters: {},
      createdAt: now - 37 * dayMs,
      isActive: true,
      isExecuted: true, // Tamamlandı
      completedAt: now - 5 * dayMs,
      invoiceHash: "QmExampleInvoiceHash123", // Mock Fatura
    },
    {
      id: "prop_4",
      proposalId: 4,
      creator: DEMO_OWNER_D,
      ipfsHash: "QmHash4",
      recipient: DEMO_OWNER_D, // Spor ekipmanı tedarikçisi
      title: "Spor Salonu Ekipman Alımı",
      description: "Spor salonuna yeni koşu bandı ve ağırlık seti alınması.",
      amount: 2000_000_000_000, // 2000 SUI
      votingEndsAt: now - 15 * dayMs,
      yesVotes: 2,
      noVotes: 7, // Reddedilmiş
      voters: {},
      createdAt: now - 22 * dayMs,
      isActive: true,
      isExecuted: true, // Reddedildiği için tamamlandı sayılabilir (veya isActive false olur)
    },
  ];
};

interface SiteStore {
  // Veriler
  apartments: Apartment[];
  tenantPasses: TenantPass[];
  rentalListings: RentalListing[];
  saleListings: SaleListing[];
  rentalRequests: RentalRequest[];
  proposals: Proposal[];
  proposalComments: ProposalComment[];
  routineExpenses: RoutineExpense[];
  treasury: Treasury;
  duesPayments: DuesPayment[];
  activityLogs: ActivityLog[];
  notifications: Notification[];
  userProfiles: UserProfileData[];
  config: SiteConfig;

  // Daire İşlemleri
  getApartment: (id: string) => Apartment | undefined;
  getApartmentsByOwner: (owner: string) => Apartment[];
  getApartmentsByBlock: (block: string) => Apartment[];
  getResidentOfApartment: (apartmentId: string) => string | null; // Dairede oturan kişi (kiracı veya ev sahibi)
  canPayDues: (apartmentId: string, address: string) => boolean; // Bu adres aidat ödeyebilir mi
  getApartmentsWhereResident: (address: string) => Apartment[]; // Adresin oturduğu daireler (kiracı veya ev sahibi olarak)
  updateApartment: (id: string, updates: Partial<Apartment>) => void;
  setApartmentOwner: (id: string, owner: string) => void;
  payDues: (apartmentId: string, payer: string, months: number) => void;
  payRent: (passId: string, payer: string, months: number) => void;

  // Kiracı Kartı İşlemleri
  getTenantPass: (id: string) => TenantPass | undefined;
  getTenantPassesByHolder: (holder: string) => TenantPass[];
  getTenantPassByApartment: (apartmentId: string) => TenantPass | undefined;
  createTenantPass: (data: Omit<TenantPass, "id" | "createdAt">) => TenantPass;
  removeTenantPass: (id: string) => void;

  // Kiralık İlan İşlemleri
  getRentalListings: (activeOnly?: boolean) => RentalListing[];
  getRentalListingsByOwner: (owner: string) => RentalListing[];
  getRentalListingByApartment: (apartmentId: string) => RentalListing | undefined;
  getRentalListing: (id: string) => RentalListing | undefined;
  createRentalListing: (data: Omit<RentalListing, "id" | "createdAt" | "isActive">) => RentalListing;
  updateRentalListing: (id: string, updates: Partial<RentalListing>) => void;
  deactivateRentalListing: (id: string) => void;

  // Satılık İlan İşlemleri
  getSaleListings: (activeOnly?: boolean) => SaleListing[];
  getSaleListingByApartment: (apartmentId: string) => SaleListing | undefined;
  createSaleListing: (data: Omit<SaleListing, "id" | "createdAt" | "isActive">) => void;
  cancelSaleListing: (listingId: string) => void;
  buyApartment: (listingId: string, buyerAddress: string) => void;

  // Kiralama Talebi İşlemleri
  getRentalRequests: () => RentalRequest[];
  getRentalRequestsByListing: (listingId: string) => RentalRequest[];
  getRentalRequestsByOwner: (ownerAddress: string) => RentalRequest[];
  createRentalRequest: (data: Omit<RentalRequest, "id" | "createdAt" | "status">) => RentalRequest;
  approveRentalRequest: (requestId: string) => void;
  rejectRentalRequest: (requestId: string) => void;
  cancelRentalRequest: (requestId: string) => void;
  completeRental: (requestId: string, tenantPassOnChainId?: string) => void;

  // Teklif İşlemleri
  getProposals: (activeOnly?: boolean) => Proposal[];
  createProposal: (data: Omit<Proposal, "id" | "proposalId" | "createdAt" | "yesVotes" | "noVotes" | "voters" | "isExecuted" | "isActive">) => Proposal;
  deleteProposal: (proposalId: string) => boolean; // Sadece ilk 3 saat içinde silinebilir
  canDeleteProposal: (proposalId: string) => boolean; // Silinebilir mi kontrol
  vote: (proposalId: string, voter: string, vote: boolean, weight: number, voterType: "tenant" | "owner") => void;
  executeProposal: (proposalId: string, invoiceHash?: string) => void;

  // Hazine İşlemleri
  addToTreasury: (amount: number) => void;
  spendFromTreasury: (amount: number) => void;

  // Aktivite Log
  addActivityLog: (log: Omit<ActivityLog, "id" | "timestamp">) => void;

  // Rutin Giderler
  getRoutineExpenses: () => RoutineExpense[];
  addRoutineExpense: (data: Omit<RoutineExpense, "id" | "createdAt">) => void;
  deleteRoutineExpense: (id: string) => void;
  updateRoutineExpense: (id: string, updates: Partial<RoutineExpense>) => void;


  // Bildirimler
  getNotifications: (unreadOnly?: boolean) => Notification[];
  getUnreadNotificationCount: () => number;
  addNotification: (data: Omit<Notification, "id" | "createdAt" | "isRead">) => Notification;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Teklif Yorumları
  getCommentsByProposal: (proposalId: string) => ProposalComment[];
  addComment: (data: Omit<ProposalComment, "id" | "createdAt" | "likes">) => ProposalComment;
  deleteComment: (commentId: string, requesterAddress: string) => boolean;
  likeComment: (commentId: string, userAddress: string) => void;
  unlikeComment: (commentId: string, userAddress: string) => void;

  // Kullanıcı yardımcı fonksiyonları
  getUserRole: (address: string, email?: string) => "admin" | "owner" | "tenant" | "owner-with-tenant" | "visitor";
  isAdmin: (address: string, email?: string) => boolean;

  // Kullanıcı Profil İşlemleri
  getUserProfile: (address: string) => UserProfileData | undefined;
  updateUserProfile: (address: string, data: Partial<Omit<UserProfileData, "address" | "updatedAt">>) => UserProfileData;

  // Veri sıfırlama
  resetToInitial: () => void;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set, get) => ({
      // Başlangıç verileri
      apartments: createInitialApartments(),
      tenantPasses: createInitialTenantPasses(),
      rentalListings: [],
      saleListings: [],
      rentalRequests: [],
      proposals: createInitialProposals(),
      routineExpenses: [
        {
          id: "exp_1",
          title: "Ocak 2026 Site Elektrik Faturası",
          amount: 4500_000_000,
          category: "utilities",
          expenseDate: Date.now() - 15 * 24 * 60 * 60 * 1000,
          description: "Ortak alan aydınlatma ve asansör elektriği.",
          createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000
        },
        {
          id: "exp_2",
          title: "Ocak 2026 Su Faturası",
          amount: 1200_000_000,
          category: "utilities",
          expenseDate: Date.now() - 14 * 24 * 60 * 60 * 1000,
          description: "Bahçe sulama ve ortak alan suyu.",
          createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000
        },
        {
          id: "exp_3",
          title: "Güvenlik Personeli Maaşı",
          amount: 30000_000_000, // 30 SUI
          category: "security",
          expenseDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
          description: "Ocak ayı güvenlik hizmet bedeli.",
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000
        }
      ] as RoutineExpense[],
      proposalComments: [],
      treasury: { balance: 1250000000000, totalReceived: 5000000000000, totalSpent: 300000000000 },
      duesPayments: [],
      activityLogs: [
        {
          id: "log_1",
          type: "dues_paid",
          actor: DEMO_OWNER_A, // Owner 1
          details: { apartmentId: "apt_1", months: 1, amount: 100_000_000 },
          timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000 // 5 days ago
        },
        {
          id: "log_2",
          type: "rent_paid",
          actor: DEMO_TENANT_B, // Tenant
          details: { passId: "pass_1", months: 1, amount: 1_000_000_000 },
          timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 // 2 days ago
        },
        {
          id: "log_3",
          type: "apartment_sold",
          actor: DEMO_OWNER_B, // Buyer (Admin)
          details: { apartmentId: "apt_sold", price: 5000_000_000, seller: DEMO_OWNER_C },
          timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago
        }
      ],
      notifications: [],
      userProfiles: [],
      config: SITE_CONFIG,

      // Daire İşlemleri
      getApartment: (id) => get().apartments.find((a) => a.id === id),

      getApartmentsByOwner: (owner) =>
        get().apartments.filter((a) => a.owner.toLowerCase() === owner.toLowerCase()),

      getApartmentsByBlock: (block) =>
        get().apartments.filter((a) => a.block === block),

      // Dairede oturan kişiyi döndür (kiracı varsa kiracı, ev sahibi oturuyorsa o, boşsa null)
      getResidentOfApartment: (apartmentId) => {
        const apt = get().apartments.find((a) => a.id === apartmentId);
        if (!apt) return null;

        // Kiracı varsa kiracı aidat öder
        if (apt.isRented && apt.tenantAddress) {
          return apt.tenantAddress;
        }

        // Ev sahibi oturuyorsa ev sahibi aidat öder
        if (apt.isOwnerOccupied) {
          return apt.owner;
        }

        // Boş daire - kimse oturmuyor
        return null;
      },

      canPayDues: (apartmentId, address) => {
        const apt = get().apartments.find((a) => a.id === apartmentId);
        if (!apt) return false;

        const resident = get().getResidentOfApartment(apartmentId);

        // Eğer dairede oturan biri varsa (Kiracı veya oturan ev sahibi), sadece o ödeyebilir
        if (resident) {
          return resident.toLowerCase() === address.toLowerCase();
        }

        // Eğer daire boşsa, ev sahibi ödeyebilir
        return apt.owner.toLowerCase() === address.toLowerCase();
      },

      // Adresin oturduğu daireler (kiracı veya ev sahibi olarak)
      getApartmentsWhereResident: (address) => {
        const lowerAddress = address.toLowerCase();
        return get().apartments.filter((apt) => {
          // Kiracı olarak oturuyor
          if (apt.isRented && apt.tenantAddress?.toLowerCase() === lowerAddress) {
            return true;
          }
          // Ev sahibi olarak oturuyor
          if (apt.isOwnerOccupied && apt.owner.toLowerCase() === lowerAddress) {
            return true;
          }
          return false;
        });
      },

      updateApartment: (id, updates) =>
        set((state) => ({
          apartments: state.apartments.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),

      setApartmentOwner: (id, owner) =>
        set((state) => ({
          apartments: state.apartments.map((a) =>
            a.id === id ? { ...a, owner } : a
          ),
        })),

      payDues: (apartmentId, payer, months) => {
        const now = Date.now();
        const monthInMs = 30 * 24 * 60 * 60 * 1000;
        const amount = months * get().config.monthlyDues;

        // Sadece dairede oturan kişi aidat ödeyebilir
        if (!get().canPayDues(apartmentId, payer)) {
          console.warn("Bu kullanıcı bu dairenin aidatını ödeyemez");
          return;
        }

        set((state) => {
          const apt = state.apartments.find((a) => a.id === apartmentId);
          if (!apt) return state;

          const currentPaidUntil = apt.duesPaidUntil > now ? apt.duesPaidUntil : now;
          const newPaidUntil = currentPaidUntil + months * monthInMs;

          const payment: DuesPayment = {
            id: generateId(),
            apartmentId,
            payer,
            amount,
            months,
            timestamp: now,
          };

          return {
            apartments: state.apartments.map((a) =>
              a.id === apartmentId ? { ...a, duesPaidUntil: newPaidUntil } : a
            ),
            duesPayments: [...state.duesPayments, payment],
            treasury: {
              ...state.treasury,
              balance: state.treasury.balance + amount,
              totalReceived: state.treasury.totalReceived + amount,
            },
          };
        });

        get().addActivityLog({
          type: "dues_paid",
          actor: payer,
          details: { apartmentId, months, amount },
        });
      },

      payRent: (passId, payer, months) => {
        const pass = get().tenantPasses.find(p => p.id === passId);
        if (!pass) return;

        const now = Date.now();
        const monthInMs = 30 * 24 * 60 * 60 * 1000;
        const currentPaidUntil = pass.rentPaidUntil > now ? pass.rentPaidUntil : now;
        const newPaidUntil = currentPaidUntil + months * monthInMs;

        set((state) => ({
          tenantPasses: state.tenantPasses.map(p =>
            p.id === passId ? { ...p, rentPaidUntil: newPaidUntil } : p
          )
        }));

        get().addActivityLog({
          type: "rent_paid",
          actor: payer,
          details: { passId, months, amount: pass.monthlyRent * months }
        });
      },

      // Kiracı Kartı İşlemleri
      getTenantPass: (id) => get().tenantPasses.find((t) => t.id === id),

      getTenantPassesByHolder: (holder) =>
        get().tenantPasses.filter((t) => t.holder.toLowerCase() === holder.toLowerCase()),

      getTenantPassByApartment: (apartmentId) =>
        get().tenantPasses.find((t) => t.apartmentId === apartmentId),

      createTenantPass: (data) => {
        // Duplicate check
        const existing = get().tenantPasses.find(
          t => t.apartmentId === data.apartmentId &&
            t.holder.toLowerCase() === data.holder.toLowerCase() &&
            t.expiryDate > Date.now()
        );
        if (existing) return existing;

        const pass: TenantPass = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };

        set((state) => ({
          tenantPasses: [...state.tenantPasses, pass],
          apartments: state.apartments.map((a) =>
            a.id === data.apartmentId
              ? {
                ...a,
                isRented: true,
                isOwnerOccupied: false,
                tenantPassId: pass.id,
                tenantAddress: data.holder,
                monthlyRent: data.monthlyRent,
              }
              : a
          ),
        }));

        get().addActivityLog({
          type: "tenant_pass_created",
          actor: data.holder,
          details: { apartmentId: data.apartmentId, duration: Math.round((data.expiryDate - data.startDate) / (30 * 24 * 60 * 60 * 1000)) },
        });

        return pass;
      },

      removeTenantPass: (id) => {
        const pass = get().getTenantPass(id);
        if (!pass) return;

        set((state) => ({
          tenantPasses: state.tenantPasses.filter((t) => t.id !== id),
          apartments: state.apartments.map((a) =>
            a.id === pass.apartmentId
              ? {
                ...a,
                isRented: false,
                tenantPassId: undefined,
                tenantAddress: undefined,
                monthlyRent: undefined,
              }
              : a
          ),
        }));
      },

      // Kiralık İlan İşlemleri
      getRentalListings: (activeOnly = true) => {
        const listings = get().rentalListings;
        const apartments = get().apartments;

        // Dolu dairelerin ilanlarını filtrele ve aktif olanları getir
        return listings.filter((l) => {
          const apartment = apartments.find(a => a.id === l.apartmentId);
          const isApartmentOccupied = apartment?.isRented;

          if (activeOnly) {
            return l.isActive && !isApartmentOccupied;
          }
          return !isApartmentOccupied; // Pasif ilanları getirirken de doluları gizle? Ya da inactive olarak kalsın.
          // User requirement: "içinde kiracı olan daireler kiraya verilemez" -> İlanı gözükmemeli.
        });
      },

      getRentalListingsByOwner: (owner) =>
        get().rentalListings.filter((l) => l.owner.toLowerCase() === owner.toLowerCase()),

      getRentalListingByApartment: (apartmentId) =>
        get().rentalListings.find(
          (l) => l.apartmentId === apartmentId && l.isActive
        ),
      getRentalListing: (id) => get().rentalListings.find((l) => l.id === id),

      createRentalListing: (data) => {
        const apartment = get().apartments.find(a => a.id === data.apartmentId);
        if (apartment?.isRented) {
          throw new Error("Dolu daire kiraya verilemez.");
        }

        const listing: RentalListing = {
          ...data,
          id: generateId(),
          isActive: true,
          createdAt: Date.now(),
        };

        set((state) => ({
          rentalListings: [...state.rentalListings, listing],
        }));

        // Bildirim oluştur
        get().addNotification({
          type: "new_rental_listing",
          title: "Yeni Kiralık İlan",
          message: `${data.block} Blok Daire ${data.flatNumber} kiralığa açıldı. Aylık: ${(data.monthlyRent / 1_000_000_000).toFixed(2)} SUI`,
          link: "/rentals",
          targetAudience: "all",
        });

        return listing;
      },

      updateRentalListing: (id, updates) =>
        set((state) => ({
          rentalListings: state.rentalListings.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          ),
        })),

      deactivateRentalListing: (id) =>
        set((state) => ({
          rentalListings: state.rentalListings.map((l) =>
            l.id === id ? { ...l, isActive: false } : l
          ),
        })),

      // Satılık İlan İşlemleri
      getSaleListings: (activeOnly = true) =>
        activeOnly
          ? get().saleListings.filter(l => l.isActive)
          : get().saleListings,

      getSaleListingByApartment: (apartmentId) =>
        get().saleListings.find(l => l.apartmentId === apartmentId && l.isActive),

      createSaleListing: (data) => {
        const listing: SaleListing = {
          ...data,
          id: generateId(),
          isActive: true,
          createdAt: Date.now()
        };

        set(state => ({
          saleListings: [...state.saleListings, listing]
        }));

        get().addNotification({
          type: "new_sale_listing",
          title: "Satılık Daire",
          message: `${data.block} Blok Daire ${data.flatNumber}, ${data.price / 1_000_000_000} SUI fiyatla satışa çıktı.`,
          link: "/sales",
          targetAudience: "all",
        });
      },

      cancelSaleListing: (listingId) =>
        set(state => ({
          saleListings: state.saleListings.map(l =>
            l.id === listingId ? { ...l, isActive: false } : l
          )
        })),

      buyApartment: (listingId, buyerAddress) => {
        const listing = get().saleListings.find(l => l.id === listingId);
        if (!listing || !listing.isActive) return;

        // Burada buyer bakiye kontrolü yapılabilir (mock olduğu için geçiyoruz)
        // Ancak alıcının parası olduğunu varsayıyoruz.

        const now = Date.now();

        set(state => {
          // 1. Daire sahibini güncelle
          const updatedApartments = state.apartments.map(a =>
            a.id === listing.apartmentId ? { ...a, owner: buyerAddress } : a
          );

          // 2. İlanı kapat
          const updatedListings = state.saleListings.map(l =>
            l.id === listingId ? { ...l, isActive: false } : l
          );

          // 3. Hazine veya Satıcı Bakiyesi Güncellemesi (Log ile simüle ediyoruz)
          // Gerçekte: Transfer SUI from buyer to seller.

          return {
            apartments: updatedApartments,
            saleListings: updatedListings
          };
        });

        get().addActivityLog({
          type: "apartment_sold", // Bu type generic log olarak eklenecek, asagida cast ediyoruz
          actor: buyerAddress,
          details: { apartmentId: listing.apartmentId, price: listing.price, seller: listing.sellerAddress }
        } as any);

        get().addNotification({
          type: "apartment_sold",
          title: "Daire Satıldı",
          message: `${listing.block} Blok Daire ${listing.flatNumber} satıldı.`,
          link: "/dashboard",
          targetAudience: "all"
        });
      },

      // Kiralama Talebi İşlemleri
      getRentalRequests: () => get().rentalRequests,

      getRentalRequestsByListing: (listingId) =>
        get().rentalRequests.filter((r) => r.listingId === listingId),

      getRentalRequestsByOwner: (ownerAddress) => {
        const ownerListings = get().getRentalListingsByOwner(ownerAddress);
        const listingIds = ownerListings.map((l) => l.id);
        return get().rentalRequests.filter((r) => listingIds.includes(r.listingId));
      },

      createRentalRequest: (data) => {
        const request: RentalRequest = {
          ...data,
          id: generateId(),
          status: "pending",
          createdAt: Date.now(),
        };

        set((state) => ({
          rentalRequests: [...state.rentalRequests, request],
        }));

        // Bildirim oluştur (ev sahiplerine)
        const listing = get().rentalListings.find((l) => l.id === data.listingId);
        if (listing) {
          get().addNotification({
            type: "new_rental_request",
            title: "Yeni Kiracı Talebi",
            message: `${listing.block} Blok Daire ${listing.flatNumber} için yeni bir kiralama talebi alındı.`,
            link: "/rentals",
            targetAudience: "owners",
          });
        }

        return request;
      },

      approveRentalRequest: (requestId) => {
        const now = Date.now();
        set((state) => ({
          rentalRequests: state.rentalRequests.map((r) =>
            r.id === requestId ? { ...r, status: "approved", respondedAt: now } : r
          ),
        }));

        // Bildirim oluştur (kiracıya)
        const request = get().rentalRequests.find((r) => r.id === requestId);
        if (request && request.requesterAddress) {
          get().addNotification({
            type: "rental_request_approved",
            title: "Kiralama Talebi Onaylandı",
            message: "Kiralama talebiniz ev sahibi tarafından onaylandı. Ödemeyi tamamlayarak kiralama işlemini bitirebilirsiniz.",
            link: "/dashboard",
            targetAudience: "tenants", // This logic needs to be handled in notification system based on address
          });
        }
      },

      rejectRentalRequest: (requestId) => {
        const now = Date.now();
        set((state) => ({
          rentalRequests: state.rentalRequests.map((r) =>
            r.id === requestId ? { ...r, status: "rejected", respondedAt: now } : r
          ),
        }));
      },

      cancelRentalRequest: (requestId) => {
        set((state) => ({
          rentalRequests: state.rentalRequests.map((r) =>
            r.id === requestId && r.status === "pending"
              ? { ...r, status: "cancelled" }
              : r
          ),
        }));
      },

      completeRental: (requestId, tenantPassOnChainId) => {
        const request = get().rentalRequests.find((r) => r.id === requestId);
        if (!request || request.status !== "approved") return;

        const listing = get().rentalListings.find((l) => l.id === request.listingId);
        if (!listing) return;

        const now = Date.now();
        const monthInMs = 30 * 24 * 60 * 60 * 1000;

        // Kiracı kartı oluştur
        if (request.requesterAddress) {
          get().createTenantPass({
            holder: request.requesterAddress,
            apartmentId: listing.apartmentId,
            apartmentBlock: listing.block,
            apartmentFlat: listing.flatNumber,
            startDate: now,
            expiryDate: now + request.requestedDuration * monthInMs,
            monthlyRent: listing.monthlyRent,
            rentPaidUntil: now + (listing.upfrontMonths || 1) * monthInMs,
            onChainId: tenantPassOnChainId,
          });
        }

        // İlanı kapat
        set((state) => ({
          rentalListings: state.rentalListings.map((l) =>
            l.id === request.listingId ? { ...l, isActive: false } : l
          ),
          rentalRequests: state.rentalRequests.map((r) =>
            r.id === requestId ? { ...r, status: "completed" } : r
          ),
        }));

        // Bildirim oluştur (kiralama onaylandı)
        get().addNotification({
          type: "rental_approved",
          title: "Kiralama Onaylandı",
          message: `${listing.block} Blok Daire ${listing.flatNumber} kiralama işlemi tamamlandı.`,
          link: "/dashboard",
          targetAudience: "all",
        });
      },

      // Teklif İşlemleri
      getProposals: (activeOnly = false) =>
        activeOnly
          ? get().proposals.filter((p) => p.isActive && p.votingEndsAt > Date.now())
          : get().proposals,

      createProposal: (data) => {
        const proposals = get().proposals;
        const proposal: Proposal = {
          ...data,
          id: generateId(),
          proposalId: proposals.length + 1,
          yesVotes: 0,
          noVotes: 0,
          voters: {},
          isExecuted: false,
          isActive: true,
          createdAt: Date.now(),
        };

        set((state) => ({
          proposals: [...state.proposals, proposal],
        }));

        get().addActivityLog({
          type: "proposal_created",
          actor: data.creator,
          details: { title: data.title, amount: data.amount },
        });

        // Bildirim oluştur
        get().addNotification({
          type: "new_proposal",
          title: "Yeni Harcama Teklifi",
          message: `"${data.title}" başlıklı ${(data.amount / 1_000_000_000).toFixed(2)} SUI tutarında yeni bir teklif oluşturuldu.`,
          link: "/governance",
          targetAudience: "all",
        });

        return proposal;
      },

      canDeleteProposal: (proposalId) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return false;

        // 3 saat = 3 * 60 * 60 * 1000 = 10,800,000 ms
        const threeHoursMs = 3 * 60 * 60 * 1000;
        const timeSinceCreation = Date.now() - proposal.createdAt;

        return timeSinceCreation <= threeHoursMs && proposal.isActive;
      },

      deleteProposal: (proposalId) => {
        if (!get().canDeleteProposal(proposalId)) {
          return false;
        }

        const proposal = get().proposals.find((p) => p.id === proposalId);

        set((state) => ({
          proposals: state.proposals.filter((p) => p.id !== proposalId),
        }));

        if (proposal) {
          get().addActivityLog({
            type: "proposal_created", // Silme için yeni tip eklenebilir
            actor: proposal.creator,
            details: { title: `Silindi: ${proposal.title}`, amount: proposal.amount },
          });
        }

        return true;
      },

      vote: (proposalId, voter, vote, weight, voterType) => {
        set((state) => ({
          proposals: state.proposals.map((p) => {
            if (p.id !== proposalId) return p;
            if (p.voters[voter]) return p; // Zaten oy kullanmış

            return {
              ...p,
              yesVotes: vote ? p.yesVotes + weight : p.yesVotes,
              noVotes: !vote ? p.noVotes + weight : p.noVotes,
              voters: {
                ...p.voters,
                [voter]: { vote, weight, type: voterType },
              },
            };
          }),
        }));

        get().addActivityLog({
          type: "vote_cast",
          actor: voter,
          details: { proposalId, vote, weight },
        });
      },

      executeProposal: (proposalId, invoiceHash) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal || proposal.isExecuted) return;

        const passed = proposal.yesVotes > proposal.noVotes;

        if (passed) {
          get().spendFromTreasury(proposal.amount);
        }

        set((state) => ({
          proposals: state.proposals.map((p) =>
            p.id === proposalId ? { ...p, isExecuted: true, isActive: false, invoiceHash, completedAt: Date.now() } : p
          ),
        }));

        get().addActivityLog({
          type: "proposal_executed",
          actor: "system",
          details: { proposalId, passed, invoiceHash },
        });

        // Bildirim oluştur
        get().addNotification({
          type: passed ? "proposal_completed" : "proposal_rejected",
          title: passed ? "Teklif Tamamlandı" : "Teklif Reddedildi",
          message: passed
            ? `"${proposal.title}" teklifi onaylandı ve ${(proposal.amount / 1_000_000_000).toFixed(2)} SUI harcandı.`
            : `"${proposal.title}" teklifi reddedildi.`,
          link: "/governance",
          targetAudience: "all",
        });
      },

      // Hazine İşlemleri
      addToTreasury: (amount) =>
        set((state) => ({
          treasury: {
            ...state.treasury,
            balance: state.treasury.balance + amount,
            totalReceived: state.treasury.totalReceived + amount,
          },
        })),

      spendFromTreasury: (amount) =>
        set((state) => ({
          treasury: {
            ...state.treasury,
            balance: Math.max(0, state.treasury.balance - amount),
            totalSpent: state.treasury.totalSpent + amount,
          },
        })),

      // Aktivite Log
      addActivityLog: (log) =>
        set((state) => ({
          activityLogs: [
            {
              ...log,
              id: generateId(),
              timestamp: Date.now(),
            },
            ...state.activityLogs,
          ].slice(0, 100), // Son 100 aktivite
        })),



      // Rutin Giderler
      getRoutineExpenses: () => get().routineExpenses,

      addRoutineExpense: (data) => {
        const expense: RoutineExpense = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
        };

        // Hazineden düş
        get().spendFromTreasury(data.amount);

        set((state) => ({
          routineExpenses: [expense, ...state.routineExpenses],
        }));

        get().addActivityLog({
          type: "dues_paid",
          actor: "Admin",
          details: { title: data.title, amount: data.amount, category: data.category },
        });
      },

      deleteRoutineExpense: (id) => {
        set((state) => ({
          routineExpenses: state.routineExpenses.filter((e) => e.id !== id),
        }));
      },

      updateRoutineExpense: (id, updates) => {
        set((state) => ({
          routineExpenses: state.routineExpenses.map((expense) =>
            expense.id === id ? { ...expense, ...updates } : expense
          ),
        }));
      },

      // Bildirimler
      getNotifications: (unreadOnly = false) =>
        unreadOnly
          ? get().notifications.filter((n) => !n.isRead)
          : get().notifications,

      getUnreadNotificationCount: () =>
        get().notifications.filter((n) => !n.isRead).length,

      addNotification: (data) => {
        const notification: Notification = {
          ...data,
          id: generateId(),
          isRead: false,
          createdAt: Date.now(),
        };

        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50), // Son 50 bildirim
        }));

        return notification;
      },

      markNotificationAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })),

      markAllNotificationsAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        })),

      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearAllNotifications: () =>
        set({ notifications: [] }),

      // Teklif Yorumları
      getCommentsByProposal: (proposalId) =>
        get().proposalComments
          .filter((c) => c.proposalId === proposalId)
          .sort((a, b) => a.createdAt - b.createdAt), // Eski yorumlar önce

      addComment: (data) => {
        const comment: ProposalComment = {
          ...data,
          id: generateId(),
          createdAt: Date.now(),
          likes: [],
        };

        set((state) => ({
          proposalComments: [...state.proposalComments, comment],
        }));

        return comment;
      },

      deleteComment: (commentId, requesterAddress) => {
        const comment = get().proposalComments.find((c) => c.id === commentId);
        if (!comment) return false;

        // Sadece yorum sahibi silebilir
        if (comment.author.toLowerCase() !== requesterAddress.toLowerCase()) {
          return false;
        }

        set((state) => ({
          proposalComments: state.proposalComments.filter((c) => c.id !== commentId),
        }));

        return true;
      },

      likeComment: (commentId, userAddress) =>
        set((state) => ({
          proposalComments: state.proposalComments.map((c) => {
            if (c.id !== commentId) return c;
            if (c.likes.includes(userAddress.toLowerCase())) return c;
            return { ...c, likes: [...c.likes, userAddress.toLowerCase()] };
          }),
        })),

      unlikeComment: (commentId, userAddress) =>
        set((state) => ({
          proposalComments: state.proposalComments.map((c) => {
            if (c.id !== commentId) return c;
            return { ...c, likes: c.likes.filter((addr) => addr.toLowerCase() !== userAddress.toLowerCase()) };
          }),
        })),

      // Kullanıcı yardımcı fonksiyonları
      getUserRole: (address, email) => {
        if (isAdminEmail(email)) {
          return "admin";
        }

        const apartments = get().getApartmentsByOwner(address);
        const tenantPasses = get().getTenantPassesByHolder(address);

        if (apartments.length > 0 && tenantPasses.length > 0) {
          return "owner-with-tenant";
        } else if (apartments.length > 0) {
          const hasRentedApartment = apartments.some((a) => a.isRented);
          return hasRentedApartment ? "owner-with-tenant" : "owner";
        } else if (tenantPasses.length > 0) {
          return "tenant";
        }

        return "visitor";
      },

      isAdmin: (address, email) => isAdminEmail(email),

      // User Profile functions
      getUserProfile: (address) => {
        return get().userProfiles.find(
          (p) => p.address.toLowerCase() === address.toLowerCase()
        );
      },

      updateUserProfile: (address, data) => {
        // Email uniqueness check
        if (data.email) {
          const duplicate = get().userProfiles.find(
            p => p.email === data.email && p.address.toLowerCase() !== address.toLowerCase()
          );
          if (duplicate) {
            throw new Error("Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.");
          }
        }

        const existingIndex = get().userProfiles.findIndex(
          (p) => p.address.toLowerCase() === address.toLowerCase()
        );

        if (existingIndex >= 0) {
          // Mevcut profili güncelle
          set((state) => ({
            userProfiles: state.userProfiles.map((p, i) =>
              i === existingIndex
                ? { ...p, ...data, updatedAt: Date.now() }
                : p
            ),
          }));
        } else {
          // Yeni profil oluştur
          const newProfile = {
            address,
            ...data,
            updatedAt: Date.now(),
          };
          set((state) => ({
            userProfiles: [...state.userProfiles, newProfile],
          }));
        }

        return get().getUserProfile(address)!;
      },

      // Veri sıfırlama
      resetToInitial: () =>
        set({
          apartments: createInitialApartments(),
          tenantPasses: createInitialTenantPasses(),
          rentalListings: [],
          rentalRequests: [],
          proposals: [],
          proposalComments: [],
          treasury: { balance: 0, totalReceived: 0, totalSpent: 0 },
          duesPayments: [],
          activityLogs: [],
          notifications: [],
          userProfiles: [],
        }),
    }),
    {
      name: "sitedao-store",
      version: 7, // Version artırıldı - Routine Expenses eklendi
      migrate: (persistedState: any, version: number) => {
        // Eski sürümden yükseltme yapılıyorsa, verileri yenile
        if (version < 7) {
          console.log("Store migration v7: Refreshing mock data for routine expenses");
          return {
            ...persistedState,
            routineExpenses: [
              {
                id: "exp_1",
                title: "Ocak 2026 Site Elektrik Faturası",
                amount: 4500_000_000,
                category: "utilities",
                expenseDate: Date.now() - 15 * 24 * 60 * 60 * 1000,
                description: "Ortak alan aydınlatma ve asansör elektriği.",
                createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000
              },
              {
                id: "exp_2",
                title: "Ocak 2026 Su Faturası",
                amount: 1200_000_000,
                category: "utilities",
                expenseDate: Date.now() - 14 * 24 * 60 * 60 * 1000,
                description: "Bahçe sulama ve ortak alan suyu.",
                createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000
              },
              {
                id: "exp_3",
                title: "Güvenlik Personeli Maaşı",
                amount: 30000_000_000,
                category: "security",
                expenseDate: Date.now() - 10 * 24 * 60 * 60 * 1000,
                description: "Ocak ayı güvenlik hizmet bedeli.",
                createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000
              }
            ],
            apartments: createInitialApartments(),
            tenantPasses: createInitialTenantPasses(),
            proposals: createInitialProposals(),
            treasury: { balance: 1250000000000, totalReceived: 5000000000000, totalSpent: 300000000000 },
          };
        }
        return persistedState;
      },
    }
  )
);

// Hooks
export const useApartments = () => useSiteStore((state) => state.apartments);
export const useTenantPasses = () => useSiteStore((state) => state.tenantPasses);
export const useRentalListings = () => useSiteStore((state) => state.rentalListings);
export const useRentalRequests = () => useSiteStore((state) => state.rentalRequests);
export const useProposals = () => useSiteStore((state) => state.proposals);
export const useTreasury = () => useSiteStore((state) => state.treasury);
export const useSiteConfig = () => useSiteStore((state) => state.config);
