// Sanal Veritabanı Tip Tanımları

export interface Apartment {
  id: string;
  owner: string; // wallet address
  block: string;
  flatNumber: number;
  duesPaidUntil: number; // timestamp
  isRented: boolean;
  isOwnerOccupied: boolean; // ev sahibi kendisi mi oturuyor
  tenantPassId?: string;
  tenantAddress?: string;
  monthlyRent?: number;
  createdAt: number;
}

export interface TenantPass {
  id: string;
  holder: string; // wallet address (kiracı)
  apartmentId: string;
  apartmentBlock: string;
  apartmentFlat: number;
  startDate: number;
  expiryDate: number;
  monthlyRent: number;
  rentPaidUntil: number; // timestamp
  createdAt: number;
  /// Zincirdeki soulbound TenantPass nesnesinin ID'si.
  /// Yalnızca kiralama gerçekten zincire yazıldığında dolar.
  onChainId?: string;
}

// Kiralık İlan
export interface RentalListing {
  id: string;
  apartmentId: string;
  owner: string;
  block: string;
  flatNumber: number;
  monthlyRent: number; // MIST cinsinden
  duration: number; // ay cinsinden
  upfrontMonths: number; // peşinat (ay sayısı)
  description?: string;
  isActive: boolean;
  createdAt: number;
}

// Kiralama Talebi
export interface RentalRequest {
  id: string;
  listingId: string;
  apartmentId: string;
  requesterAddress?: string; // giriş yapmışsa
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  requestedDuration: number; // ay
  message?: string;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  createdAt: number;
  respondedAt?: number;
  /// Zincirdeki paylaşılan RentalRequest nesnesinin ID'si.
  /// Onay ve kiralama işlemleri bu nesne üzerinden yürür.
  onChainId?: string;
}

export interface Proposal {
  id: string;
  proposalId: number;
  creator: string;
  ipfsHash: string;
  title: string;
  description: string;
  amount: number; // MIST cinsinden
  recipient: string;
  yesVotes: number;
  noVotes: number;
  voters: Record<string, { vote: boolean; weight: number; type: "tenant" | "owner" }>; // address -> vote info
  votingEndsAt: number;
  isExecuted: boolean;
  isActive: boolean;
  createdAt: number;
  completedAt?: number;
  invoiceHash?: string; // IPFS hash
  /// Zincirdeki paylaşılan Proposal nesnesinin ID'si.
  /// Yalnızca create_proposal işlemi gerçekten zincire yazıldığında dolar;
  /// demo modunda undefined kalır ve oylama yerel store üzerinde yürür.
  onChainId?: string;
}

export interface Treasury {
  balance: number; // MIST
  totalReceived: number;
  totalSpent: number;
}

export interface DuesPayment {
  id: string;
  apartmentId: string;
  payer: string;
  amount: number;
  months: number;
  timestamp: number;
}

export interface RentPayment {
  id: string;
  tenantPassId: string;
  apartmentId: string;
  payer: string;
  amount: number;
  timestamp: number;
}

export interface ActivityLog {
  id: string;
  type: "apartment_created" | "dues_paid" | "proposal_created" | "vote_cast" | "proposal_executed" | "tenant_pass_created" | "rent_paid" | "apartment_sold";
  actor: string;
  details: Record<string, any>;
  timestamp: number;
}

// Rutin Giderler
export interface RoutineExpense {
  id: string;
  title: string;
  amount: number; // MIST
  category: "maintenance" | "utilities" | "security" | "cleaning" | "other";
  expenseDate: number; // harcama tarihi
  recipient?: string;
  invoiceHash?: string;
  description?: string;
  createdAt: number;
}

// Satılık İlan
export interface SaleListing {
  id: string;
  apartmentId: string;
  sellerAddress: string;
  block: string;
  flatNumber: number;
  price: number; // SUI cinsinden
  createdAt: number;
  isActive: boolean;
  /// Zincirdeki paylaşılan SaleListing nesnesinin ID'si.
  /// Satın alma işlemi bu nesneyi tüketir; yoksa satış demo modunda yürür.
  onChainId?: string;
}

// Bildirim Türleri
export type NotificationType =
  | "new_proposal"        // Yeni teklif oluşturuldu
  | "proposal_approved"   // Teklif onaylandı
  | "proposal_rejected"   // Teklif reddedildi
  | "proposal_completed"  // Teklif tamamlandı
  | "new_rental_listing"  // Yeni kira ilanı
  | "new_rental_request"  // Yeni kiracı talebi
  | "rental_approved"     // Kiralama onaylandı
  | "rental_request_approved"
  | "rental_request_rejected"
  | "dues_reminder"       // Aidat hatırlatması
  | "vote_reminder"       // Oy kullanma hatırlatması
  | "new_sale_listing"    // Yeni satılık ilanı
  | "apartment_sold";     // Daire satıldı (yeni sahip)

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string; // Tıklayınca gidilecek sayfa
  isRead: boolean;
  createdAt: number;
  // Kime gösterilecek (opsiyonel - boşsa herkese)
  targetAudience?: "all" | "owners" | "tenants" | "admin";
}

// Teklif Yorumları
export interface ProposalComment {
  id: string;
  proposalId: string;
  author: string; // wallet address
  authorName?: string; // görünen isim (varsa)
  authorType: "owner" | "tenant"; // ev sahibi mi kiracı mı
  message: string;
  createdAt: number;
  // Yanıt ise parent comment id
  parentId?: string;
  // Beğeni sayısı
  likes: string[]; // beğenen adreslerin listesi
}

export interface SiteConfig {
  name: string;
  blocks: string[];
  monthlyDues: number; // MIST
  votingPeriodDays: number;
  adminAddress: string;
}

export type UserRole = "admin" | "owner" | "tenant" | "owner-with-tenant" | "visitor";

// Kullanıcı profil bilgileri (güncellenebilir)
export interface UserProfileData {
  address: string;
  displayName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  updatedAt: number;
}

export interface UserProfile {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  apartments: string[]; // apartment IDs
  tenantPasses: string[]; // tenant pass IDs
  isAdmin: boolean;
}
