import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateNonce, generateRandomness, getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";
import { SuiClient } from "@mysten/sui/client";
import { SUI_RPC_URL } from "@/lib/constants";

// Ephemeral keypair ve randomness için tip
export interface EphemeralData {
  keypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  expiresAt: number;
}

// zkLogin session verisi
export interface ZkLoginSession {
  ephemeralData: EphemeralData;
  jwt?: string;
  salt?: string;
  zkProof?: ZkProof;
  userAddress?: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  provider: string;
}

// ZK Proof tipi
export interface ZkProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
  addressSeed: string;
}

// Ephemeral keypair oluştur
export async function createEphemeralKeyPair(): Promise<{
  keypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  expiresAt: number;
}> {
  // Sui client ile mevcut epoch'u al
  const suiClient = new SuiClient({ url: SUI_RPC_URL });
  const { epoch } = await suiClient.getLatestSuiSystemState();
  
  // Maksimum epoch (2 epoch sonrasına kadar geçerli)
  const maxEpoch = Number(epoch) + 2;
  
  // Ephemeral keypair oluştur
  const keypair = new Ed25519Keypair();
  
  // Randomness oluştur
  const randomness = generateRandomness();
  
  // Extended public key al
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(keypair.getPublicKey());
  
  // Nonce oluştur
  const nonce = generateNonce(keypair.getPublicKey(), maxEpoch, randomness);
  
  // Yaklaşık süre sonu (epoch başına ~24 saat)
  const expiresAt = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 gün
  
  return {
    keypair,
    randomness,
    nonce,
    maxEpoch,
    expiresAt,
  };
}

// Session storage'a kaydet
export function saveZkLoginSession(session: Partial<ZkLoginSession>): void {
  if (typeof window === "undefined") return;
  
  const existing = getZkLoginSession();
  const merged = { ...existing, ...session };
  
  // Keypair'i serialize et
  const serialized = {
    ...merged,
    ephemeralData: merged.ephemeralData ? {
      ...merged.ephemeralData,
      keypair: merged.ephemeralData.keypair.getSecretKey(),
    } : undefined,
  };
  
  sessionStorage.setItem("zklogin_session", JSON.stringify(serialized));
}

// Session storage'dan oku
export function getZkLoginSession(): ZkLoginSession | null {
  if (typeof window === "undefined") return null;
  
  try {
    const data = sessionStorage.getItem("zklogin_session");
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    
    // Keypair'i deserialize et
    if (parsed.ephemeralData?.keypair) {
      parsed.ephemeralData.keypair = Ed25519Keypair.fromSecretKey(parsed.ephemeralData.keypair);
    }
    
    return parsed;
  } catch {
    return null;
  }
}

// Session'ı temizle
export function clearZkLoginSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("zklogin_session");
}

// Session geçerli mi kontrol et
export function isSessionValid(): boolean {
  const session = getZkLoginSession();
  if (!session?.ephemeralData) return false;
  
  return session.ephemeralData.expiresAt > Date.now();
}
