import { jwtToAddress } from "@mysten/sui/zklogin";
import { ZKLOGIN_CONFIG } from "./config";
import { ZkProof, getZkLoginSession, saveZkLoginSession } from "./ephemeral";

// JWT'den claims çıkar
interface JwtClaims {
  iss: string;
  sub: string;
  aud: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  nonce: string;
  exp: number;
  iat: number;
}

export function decodeJwt(jwt: string): JwtClaims {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  
  // Base64 URL'yi standart Base64'e çevir ve decode et
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  
  const payload = JSON.parse(jsonPayload);
  return payload as JwtClaims;
}

// Salt hesapla (basit versiyon - production'da salt service kullanılmalı)
export function computeSalt(sub: string, email?: string): string {
  // Basit bir hash - production'da daha güvenli bir yöntem kullanın
  // Gerçek uygulamada salt service'den alınmalı
  const input = `${sub}_${email || ""}_sitedao_v1`;
  
  // Simple hash for demo purposes
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // BigInt olarak döndür
  return BigInt(Math.abs(hash)).toString();
}

// zkLogin adresi türet
export function deriveZkLoginAddress(jwt: string, salt: string): string {
  // jwtToAddress, adres seed'ini JWT ve salt'tan kendisi hesaplar
  return jwtToAddress(jwt, salt);
}

// ZK Proof oluştur (Mysten prover servisi ile)
export async function generateZkProof(
  jwt: string,
  salt: string,
  maxEpoch: number,
  randomness: string,
  extendedEphemeralPublicKey: string
): Promise<ZkProof> {
  const response = await fetch(ZKLOGIN_CONFIG.proverUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey,
      maxEpoch,
      jwtRandomness: randomness,
      salt,
      keyClaimName: "sub",
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate ZK proof: ${error}`);
  }
  
  return response.json();
}

// JWT'yi işle ve session'ı güncelle
export async function processJwt(jwt: string): Promise<{
  address: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}> {
  const session = getZkLoginSession();
  if (!session?.ephemeralData) {
    throw new Error("No ephemeral data found");
  }
  
  const claims = decodeJwt(jwt);
  
  // Nonce kontrolü
  if (claims.nonce !== session.ephemeralData.nonce) {
    throw new Error("Nonce mismatch");
  }
  
  // Salt hesapla
  const salt = computeSalt(claims.sub, claims.email);
  
  // zkLogin adresi türet
  const address = deriveZkLoginAddress(jwt, salt);
  
  // Session'ı güncelle
  saveZkLoginSession({
    jwt,
    salt,
    userAddress: address,
    email: claims.email,
    name: claims.name,
    givenName: claims.given_name,
    familyName: claims.family_name,
    picture: claims.picture,
  });
  
  return {
    address,
    email: claims.email,
    name: claims.name,
    givenName: claims.given_name,
    familyName: claims.family_name,
    picture: claims.picture,
  };
}

// ZK proof oluştur ve session'ı güncelle
export async function createAndSaveZkProof(): Promise<ZkProof> {
  const session = getZkLoginSession();
  if (!session?.ephemeralData || !session.jwt || !session.salt) {
    throw new Error("Missing session data for ZK proof");
  }
  
  const { getExtendedEphemeralPublicKey } = await import("@mysten/sui/zklogin");
  
  const extendedPublicKey = getExtendedEphemeralPublicKey(
    session.ephemeralData.keypair.getPublicKey()
  );
  
  const zkProof = await generateZkProof(
    session.jwt,
    session.salt,
    session.ephemeralData.maxEpoch,
    session.ephemeralData.randomness,
    extendedPublicKey
  );
  
  saveZkLoginSession({ zkProof });
  
  return zkProof;
}
