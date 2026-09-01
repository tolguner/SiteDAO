import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, TREASURY_ID, RENTAL_REGISTRY_ID, PROPOSAL_REGISTRY_ID, CLOCK_OBJECT_ID } from "./constants";

// SUI miktarını MIST'e çevir
export function suiToMist(sui: number): bigint {
  return BigInt(Math.floor(sui * 1_000_000_000));
}

// MIST miktarını SUI'ye çevir
export function mistToSui(mist: bigint | number): number {
  return Number(mist) / 1_000_000_000;
}

// Adresi kısalt
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Timestamp'i tarih string'ine çevir
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Kalan süreyi hesapla
export function getTimeRemaining(endTime: number): {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
} {
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isExpired: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    isExpired: false,
  };
}

// Aidat ödeme transaction'ı oluştur
export function createPayDuesTransaction(
  apartmentId: string,
  months: number,
  monthlyDuesSui: number
): Transaction {
  const tx = new Transaction();
  const totalMist = suiToMist(months * monthlyDuesSui);

  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(totalMist)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::apartment::pay_dues`,
    arguments: [
      tx.object(apartmentId),
      coin,
      tx.pure.address(TREASURY_ID),
      tx.pure.u64(months),
      tx.pure.u64(Date.now()),
    ],
  });

  return tx;
}

// Kiracı olarak oy kullan transaction'ı
export function createVoteAsTenantTransaction(
  proposalId: string,
  tenantPassId: string,
  vote: boolean
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::governance::vote_as_tenant`,
    arguments: [
      tx.object(proposalId),
      tx.object(tenantPassId),
      tx.pure.bool(vote),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// Ev sahibi olarak oy kullan transaction'ı
export function createVoteAsOwnerTransaction(
  proposalId: string,
  apartmentId: string,
  vote: boolean
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::governance::vote_as_owner`,
    arguments: [
      tx.object(proposalId),
      tx.object(apartmentId),
      tx.pure.bool(vote),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

// Hazine bakiyesini sorgula
export async function getTreasuryBalance(client: SuiClient): Promise<number> {
  try {
    const treasury = await client.getObject({
      id: TREASURY_ID,
      options: { showContent: true },
    });

    if (treasury.data?.content?.dataType === "moveObject") {
      const fields = treasury.data.content.fields as Record<string, any>;
      return mistToSui(BigInt(fields.balance));
    }
  } catch (error) {
    console.error("Treasury balance fetch error:", error);
  }
  return 0;
}

// Kullanıcının varlıklarını sorgula
export async function getUserAssets(
  client: SuiClient,
  address: string
): Promise<{
  apartments: any[];
  tenantPasses: any[];
}> {
  const apartments: any[] = [];
  const tenantPasses: any[] = [];

  try {
    const objects = await client.getOwnedObjects({
      owner: address,
      filter: {
        MatchAny: [
          { StructType: `${PACKAGE_ID}::apartment::Apartment` },
          { StructType: `${PACKAGE_ID}::rent_market::TenantPass` },
        ],
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    objects.data.forEach((obj) => {
      const content = obj.data?.content;
      if (content?.dataType === "moveObject") {
        const fields = content.fields as Record<string, any>;
        const type = content.type;

        if (type?.includes("::apartment::Apartment")) {
          apartments.push({
            id: obj.data?.objectId,
            block: fields.block,
            flatNumber: Number(fields.flat_number),
            duesPaidUntil: Number(fields.dues_paid_until),
          });
        } else if (type?.includes("::rent_market::TenantPass")) {
          tenantPasses.push({
            id: obj.data?.objectId,
            apartmentId: fields.apartment_id,
            apartmentBlock: fields.apartment_block,
            apartmentFlat: Number(fields.apartment_flat),
            expiryDate: Number(fields.expiry_date),
          });
        }
      }
    });
  } catch (error) {
    console.error("User assets fetch error:", error);
  }

  return { apartments, tenantPasses };
}
