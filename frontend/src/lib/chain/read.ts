import type { SuiClient } from "@mysten/sui/client";
import {
  PACKAGE_ID,
  TREASURY_ID,
  RENTAL_REGISTRY_ID,
  PROPOSAL_REGISTRY_ID,
} from "@/lib/constants";
import type {
  Apartment,
  TenantPass,
  RentalListing,
  RentalRequest,
  SaleListing,
  RoutineExpense,
  Proposal,
  Treasury,
} from "@/lib/store/types";

/// Zincirden okunan tüm site durumu
export interface ChainState {
  apartments: Apartment[];
  tenantPasses: TenantPass[];
  rentalListings: RentalListing[];
  rentalRequests: RentalRequest[];
  saleListings: SaleListing[];
  routineExpenses: RoutineExpense[];
  proposals: Proposal[];
  treasury: Treasury;
}

/// Zincir okuması için gereken adresler tanımlı mı?
export const isChainConfigured = (): boolean =>
  !!(PACKAGE_ID && TREASURY_ID && RENTAL_REGISTRY_ID && PROPOSAL_REGISTRY_ID);

type Fields = Record<string, any>;

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => String(v ?? "");

/// Move nesnesinin alanlarını çıkarır
function moveFields(obj: any): Fields | null {
  const content = obj?.data?.content ?? obj?.content;
  if (!content || content.dataType !== "moveObject") return null;
  return content.fields as Fields;
}

/// Nesnenin adres sahibini döndürür; Kiosk'ta kilitliyse null olur
function addressOwner(obj: any): string | null {
  const owner = obj?.data?.owner ?? obj?.owner;
  if (owner && typeof owner === "object" && "AddressOwner" in owner) {
    return String(owner.AddressOwner);
  }
  return null;
}

/// Bir Table'ın içindeki tüm değerleri okur
///
/// Sui'de Table girdileri, Table'ın UID'si altındaki dinamik alanlardır; bu yüzden
/// önce alan listesi, sonra her alanın nesnesi çekilir.
async function readTableValues(client: SuiClient, tableId: string): Promise<Fields[]> {
  const values: Fields[] = [];
  let cursor: string | null | undefined = null;

  do {
    const page = await client.getDynamicFields({ parentId: tableId, cursor });
    if (page.data.length === 0) break;

    const entries = await client.multiGetObjects({
      ids: page.data.map((f) => f.objectId),
      options: { showContent: true },
    });

    for (const entry of entries) {
      const fields = moveFields(entry);
      // Dinamik alan nesnesi { name, value } biçimindedir
      const value = fields?.value;
      if (value?.fields) values.push(value.fields as Fields);
      else if (value !== undefined) values.push({ value } as Fields);
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return values;
}

/// Bir shared nesnenin içindeki Table'ın UID'sini bulur
async function tableIdOf(
  client: SuiClient,
  parentId: string,
  fieldName: string
): Promise<string | null> {
  const obj = await client.getObject({ id: parentId, options: { showContent: true } });
  const fields = moveFields(obj);
  const table = fields?.[fieldName];
  return table?.fields?.id?.id ?? null;
}

/// Hazine
export async function readTreasury(client: SuiClient): Promise<Treasury> {
  const obj = await client.getObject({ id: TREASURY_ID, options: { showContent: true } });
  const f = moveFields(obj);
  return {
    balance: num(f?.balance),
    totalReceived: num(f?.total_received),
    totalSpent: num(f?.total_spent),
  };
}

/// Kiralama ilanları - RentalRegistry içindeki listings tablosundan
export async function readRentalListings(client: SuiClient): Promise<RentalListing[]> {
  const tableId = await tableIdOf(client, RENTAL_REGISTRY_ID, "listings");
  if (!tableId) return [];

  const rows = await readTableValues(client, tableId);

  return rows.map((r) => ({
    id: str(r.apartment_id),
    apartmentId: str(r.apartment_id),
    owner: str(r.owner),
    block: str(r.apartment_block),
    flatNumber: num(r.apartment_flat),
    monthlyRent: num(r.monthly_rent),
    duration: num(r.max_duration_months),
    upfrontMonths: num(r.upfront_months),
    isActive: Boolean(r.is_active),
    createdAt: 0,
  }));
}

/// Aktif kiralamalar: daire ID -> TenantPass ID
///
/// Kayıt zincirde ActiveRental { tenant_pass_id, tenant, expiry_date } olarak tutulur.
async function readActiveRentals(client: SuiClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const tableId = await tableIdOf(client, RENTAL_REGISTRY_ID, "active_rentals");
  if (!tableId) return map;

  let cursor: string | null | undefined = null;
  do {
    const page = await client.getDynamicFields({ parentId: tableId, cursor });
    if (page.data.length === 0) break;

    const entries = await client.multiGetObjects({
      ids: page.data.map((f) => f.objectId),
      options: { showContent: true },
    });

    for (const entry of entries) {
      const f = moveFields(entry);
      const passId = f?.value?.fields?.tenant_pass_id;
      if (f?.name && passId) map.set(str(f.name), str(passId));
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return map;
}

/// Kiracı kartları - aktif kiralamalardan bulunur
export async function readTenantPasses(
  client: SuiClient,
  activeRentals: Map<string, string>
): Promise<TenantPass[]> {
  const ids = Array.from(activeRentals.values());
  if (ids.length === 0) return [];

  const objects = await client.multiGetObjects({
    ids,
    options: { showContent: true },
  });

  const passes: TenantPass[] = [];
  for (const obj of objects) {
    const f = moveFields(obj);
    if (!f) continue; // yakılmış olabilir
    passes.push({
      id: str(obj.data?.objectId),
      onChainId: str(obj.data?.objectId),
      holder: str(f.tenant),
      apartmentId: str(f.apartment_id),
      apartmentBlock: str(f.apartment_block),
      apartmentFlat: num(f.apartment_flat),
      startDate: num(f.start_date),
      expiryDate: num(f.expiry_date),
      monthlyRent: num(f.monthly_rent),
      rentPaidUntil: num(f.rent_paid_until),
      createdAt: num(f.start_date),
    });
  }
  return passes;
}

/// Daireler - ApartmentMinted olaylarından bulunup güncel halleri okunur
///
/// Sahiplik olaydan değil nesnenin o anki sahibinden alınır; daire satılmış olabilir.
/// Kiraya çıkarılan daire Kiosk'ta kilitli olduğu için adres sahibi görünmez;
/// bu durumda sahip bilgisi ilandan okunur.
export async function readApartments(
  client: SuiClient,
  listings: RentalListing[],
  passes: TenantPass[]
): Promise<Apartment[]> {
  const ids = new Set<string>();
  let cursor: any = null;

  do {
    const page = await client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::apartment::ApartmentMinted` },
      cursor,
      limit: 50,
    });
    for (const ev of page.data) {
      const id = (ev.parsedJson as Fields)?.apartment_id;
      if (id) ids.add(String(id));
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  if (ids.size === 0) return [];

  const listingByApartment = new Map(listings.map((l) => [l.apartmentId, l]));
  const passByApartment = new Map(passes.map((p) => [p.apartmentId, p]));

  const apartments: Apartment[] = [];
  const idList = Array.from(ids);

  // multiGetObjects tek çağrıda sınırlı sayıda nesne döndürür
  for (let i = 0; i < idList.length; i += 50) {
    const objects = await client.multiGetObjects({
      ids: idList.slice(i, i + 50),
      options: { showContent: true, showOwner: true },
    });

    for (const obj of objects) {
      const f = moveFields(obj);
      if (!f) continue; // yok edilmiş olabilir

      const id = str(obj.data?.objectId);
      const listing = listingByApartment.get(id);
      const pass = passByApartment.get(id);

      // Kiosk'ta kilitliyken adres sahibi görünmez, ilandaki sahip kullanılır
      const owner = addressOwner(obj) ?? listing?.owner ?? "";

      apartments.push({
        id,
        owner,
        block: str(f.block),
        flatNumber: num(f.flat_number),
        duesPaidUntil: num(f.dues_paid_until),
        isRented: !!pass,
        isOwnerOccupied: !pass,
        tenantPassId: pass?.id,
        tenantAddress: pass?.holder,
        monthlyRent: listing?.monthlyRent ?? pass?.monthlyRent,
        createdAt: 0,
      });
    }
  }

  return apartments;
}

/// Harcama teklifleri - ProposalRegistry içindeki active_proposals tablosundan
export async function readProposals(client: SuiClient): Promise<Proposal[]> {
  const tableId = await tableIdOf(client, PROPOSAL_REGISTRY_ID, "active_proposals");
  if (!tableId) return [];

  const objectIds: string[] = [];
  let cursor: string | null | undefined = null;

  do {
    const page = await client.getDynamicFields({ parentId: tableId, cursor });
    if (page.data.length === 0) break;

    const entries = await client.multiGetObjects({
      ids: page.data.map((f) => f.objectId),
      options: { showContent: true },
    });

    for (const entry of entries) {
      const f = moveFields(entry);
      // Tablo proposal_id -> Proposal nesne ID'si eşlemesi tutar
      if (f?.value) objectIds.push(str(f.value));
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  if (objectIds.length === 0) return [];

  const objects = await client.multiGetObjects({
    ids: objectIds,
    options: { showContent: true },
  });

  const proposals: Proposal[] = [];
  for (const obj of objects) {
    const f = moveFields(obj);
    if (!f) continue;

    const id = str(obj.data?.objectId);
    const voters: Proposal["voters"] = {};
    const voterList: string[] = f.voters?.fields?.contents ?? [];
    for (const v of voterList) {
      // Zincirde oyun yönü kişi bazında tutulmuyor, yalnızca kimin oy kullandığı
      voters[String(v)] = { vote: true, weight: 1, type: "owner" };
    }

    proposals.push({
      id,
      onChainId: id,
      proposalId: num(f.proposal_id),
      creator: str(f.creator),
      ipfsHash: str(f.ipfs_hash),
      // Sözleşmede ayrı bir başlık alanı yok, açıklama başlık olarak kullanılır
      title: str(f.description),
      description: str(f.description),
      amount: num(f.amount),
      recipient: str(f.recipient),
      yesVotes: num(f.yes_votes),
      noVotes: num(f.no_votes),
      voters,
      votingEndsAt: num(f.voting_ends_at),
      isExecuted: Boolean(f.is_executed),
      isActive: Boolean(f.is_active),
      createdAt: num(f.created_at),
    });
  }

  return proposals;
}


/// Bir Move olayının tüm kayıtlarını toplar
async function queryAllEvents(client: SuiClient, eventType: string): Promise<Fields[]> {
  const out: Fields[] = [];
  let cursor: any = null;

  do {
    const page = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit: 50,
    });
    for (const ev of page.data) {
      if (ev.parsedJson) out.push(ev.parsedJson as Fields);
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return out;
}

/// Kiralama talepleri - RentalRequested olaylarındaki nesneler okunur
export async function readRentalRequests(client: SuiClient): Promise<RentalRequest[]> {
  const events = await queryAllEvents(client, `${PACKAGE_ID}::rent_market::RentalRequested`);
  const ids = events.map((e) => str(e.request_id)).filter(Boolean);
  if (ids.length === 0) return [];

  const requests: RentalRequest[] = [];

  for (let i = 0; i < ids.length; i += 50) {
    const objects = await client.multiGetObjects({
      ids: ids.slice(i, i + 50),
      options: { showContent: true },
    });

    for (const obj of objects) {
      const f = moveFields(obj);
      if (!f) continue;

      // Sözleşmedeki durum kodları: 0 beklemede, 1 onaylı, 2 reddedildi, 3 tamamlandı
      const statusMap: RentalRequest["status"][] = [
        "pending",
        "approved",
        "rejected",
        "completed",
      ];

      const id = str(obj.data?.objectId);
      requests.push({
        id,
        onChainId: id,
        listingId: str(f.apartment_id),
        apartmentId: str(f.apartment_id),
        requesterAddress: str(f.requester),
        // İletişim bilgileri zincirde tutulmaz
        requesterName: "",
        requesterEmail: "",
        requesterPhone: "",
        requestedDuration: num(f.duration_months),
        status: statusMap[num(f.status)] ?? "pending",
        createdAt: num(f.created_at),
      });
    }
  }

  return requests;
}

/// Satılık ilanlar - ApartmentListedForSale olaylarındaki nesneler okunur
///
/// Satılan veya iptal edilen ilanın nesnesi tüketildiği için artık okunamaz;
/// bu yüzden yalnızca hâlâ açık olan ilanlar listeye girer.
export async function readSaleListings(client: SuiClient): Promise<SaleListing[]> {
  const events = await queryAllEvents(client, `${PACKAGE_ID}::sale_market::ApartmentListedForSale`);
  const ids = events.map((e) => str(e.listing_id)).filter(Boolean);
  if (ids.length === 0) return [];

  const listings: SaleListing[] = [];

  for (let i = 0; i < ids.length; i += 50) {
    const objects = await client.multiGetObjects({
      ids: ids.slice(i, i + 50),
      options: { showContent: true },
    });

    for (const obj of objects) {
      const f = moveFields(obj);
      if (!f) continue; // satılmış veya iptal edilmiş

      const id = str(obj.data?.objectId);
      listings.push({
        id,
        onChainId: id,
        apartmentId: str(f.apartment?.fields?.id?.id ?? f.apartment?.fields?.id),
        sellerAddress: str(f.seller),
        block: str(f.apartment_block),
        flatNumber: num(f.apartment_flat),
        price: num(f.price),
        createdAt: num(f.created_at),
        isActive: true,
      });
    }
  }

  return listings;
}

/// Rutin giderler - RoutineExpenseRecorded olaylarından
///
/// Gider zincirde ayrı bir nesne olarak tutulmaz, olay kaydı tek kaynaktır.
export async function readRoutineExpenses(client: SuiClient): Promise<RoutineExpense[]> {
  const events = await queryAllEvents(client, `${PACKAGE_ID}::governance::RoutineExpenseRecorded`);

  const categories: RoutineExpense["category"][] = [
    "maintenance",
    "utilities",
    "security",
    "cleaning",
    "other",
  ];

  return events.map((e) => {
    const category = str(e.category) as RoutineExpense["category"];
    return {
      id: `expense_${str(e.expense_id)}`,
      title: str(e.title),
      amount: num(e.amount),
      category: categories.includes(category) ? category : "other",
      expenseDate: num(e.recorded_at),
      recipient: str(e.recipient),
      invoiceHash: str(e.ipfs_hash) || undefined,
      createdAt: num(e.recorded_at),
    };
  });
}

/// Sitenin zincirdeki tüm durumunu okur
export async function readChainState(client: SuiClient): Promise<ChainState> {
  const [treasury, listings, activeRentals, proposals, rentalRequests, saleListings, routineExpenses] =
    await Promise.all([
      readTreasury(client),
      readRentalListings(client),
      readActiveRentals(client),
      readProposals(client),
      readRentalRequests(client),
      readSaleListings(client),
      readRoutineExpenses(client),
    ]);

  const tenantPasses = await readTenantPasses(client, activeRentals);
  const apartments = await readApartments(client, listings, tenantPasses);

  return {
    apartments,
    tenantPasses,
    rentalListings: listings,
    rentalRequests,
    saleListings,
    routineExpenses,
    proposals,
    treasury,
  };
}
