// zkLogin Configuration

// Desteklenen OAuth provider'lar
export const OAUTH_PROVIDERS = {
  google: {
    name: "Google",
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
  },
} as const;

// zkLogin için Mysten prover servisi
export const ZKLOGIN_CONFIG = {
  // Prover endpoint - ZK proof oluşturmak için
  proverUrl: process.env.NEXT_PUBLIC_PROVER_URL || "https://prover-dev.mystenlabs.com/v1",
  
  // Salt service - kullanıcı salt'ını yönetmek için (kendi sunucunuz veya Mysten'in)
  saltServiceUrl: process.env.NEXT_PUBLIC_SALT_SERVICE_URL || "",
  
  // Epoch'ların geçerlilik süresi (maksimum 2 epoch ilerisi desteklenir)
  maxEpochOffset: 2,
  
  // Redirect URL'leri
  redirectUrl: typeof window !== "undefined" 
    ? `${window.location.origin}/api/auth/callback/google`
    : "",
};

// Google OAuth için nonce oluşturma
export function generateNonce(): string {
  const array = new Uint8Array(32);
  if (typeof window !== "undefined") {
    window.crypto.getRandomValues(array);
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// JWT'den subject (sub) claim'ini çıkar
export function extractSubFromJwt(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.sub || null;
  } catch {
    return null;
  }
}
