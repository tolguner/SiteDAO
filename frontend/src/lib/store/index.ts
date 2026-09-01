// Store exports
export {
  useSiteStore,
  useApartments,
  useTenantPasses,
  useRentalListings,
  useRentalRequests,
  useProposals,
  useTreasury,
  useSiteConfig,
  getAddressFromEmail,
  EMAIL_TO_ADDRESS_MAP,
} from "./siteStore";

export type {
  Apartment,
  TenantPass,
  RentalListing,
  RentalRequest,
  Proposal,
  Treasury,
  DuesPayment,
  RentPayment,
  ActivityLog,
  SiteConfig,
  UserRole,
  UserProfile,
  UserProfileData,
  Notification,
  NotificationType,
  ProposalComment,
  RoutineExpense,
  SaleListing,
} from "./types";
