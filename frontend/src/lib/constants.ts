// SiteDAO Contract Constants
// Bu değerler deploy sonrası güncellenmelidir

import { getFullnodeUrl } from "@mysten/sui/client";

export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
export const TREASURY_ID = process.env.NEXT_PUBLIC_TREASURY_ID || "";
export const RENTAL_REGISTRY_ID = process.env.NEXT_PUBLIC_RENTAL_REGISTRY_ID || "";
export const PROPOSAL_REGISTRY_ID = process.env.NEXT_PUBLIC_PROPOSAL_REGISTRY_ID || "";
export const GOVERNANCE_ADMIN_CAP_ID = process.env.NEXT_PUBLIC_GOVERNANCE_ADMIN_CAP_ID || "";
// Apartment için paylaşılan TransferPolicy - Kiosk kilidi bunsuz çalışmaz
export const APARTMENT_POLICY_ID = process.env.NEXT_PUBLIC_APARTMENT_POLICY_ID || "";

// Desteklenen Sui ağları
export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

const SUPPORTED_NETWORKS: SuiNetwork[] = ["mainnet", "testnet", "devnet", "localnet"];
const RAW_NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "testnet").trim().toLowerCase();

// Geçersiz bir değer verilirse testnet'e düşer
export const NETWORK: SuiNetwork = SUPPORTED_NETWORKS.includes(RAW_NETWORK as SuiNetwork)
  ? (RAW_NETWORK as SuiNetwork)
  : "testnet";
export const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

// Yönetici E-posta Listesi
// NEXT_PUBLIC_ADMIN_EMAILS ortam değişkeninden virgülle ayrılmış olarak okunur.
// Gömülü varsayılan yoktur; tanımlanmadığında kimse yönetici olmaz.
export const ADMIN_EMAILS: string[] = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.length > 0);

// E-postanın yönetici listesinde olup olmadığını büyük/küçük harf duyarsız kontrol eder
export const isAdminEmail = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());

/// Kullanılacak RPC uç noktası
///
/// Sui'nin genel fullnode'ları JSON-RPC'yi kaldırdı ve tarayıcıdan CORS'a izin
/// vermiyor; bu yüzden JSON-RPC sunan bir uç nokta NEXT_PUBLIC_SUI_RPC_URL ile
/// verilebilir. Tanımsızsa varsayılan fullnode kullanılır.
export const SUI_RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL?.trim() || getFullnodeUrl(NETWORK);

// Sui Network URLs
export const SUI_NETWORK_URLS = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

// Explorer URLs
export const EXPLORER_URLS: Record<SuiNetwork, string> = {
  mainnet: "https://suiscan.xyz/mainnet",
  testnet: "https://suiscan.xyz/testnet",
  devnet: "https://suiscan.xyz/devnet",
  localnet: "http://127.0.0.1:9001",
};

// Contract Constants
export const MONTHLY_DUES_SUI = 0.1; // SUI cinsinden aylık aidat
export const VOTING_PERIOD_MS = 172_800_000; // 2 gün (milisaniye) - oylama süresi
export const MONTH_IN_MS = 2_592_000_000; // 30 gün (milisaniye)
export const MAJORITY_THRESHOLD = 0.5; // %50 üzeri çoğunluk

// Clock Object ID (Sui'de sabit)
export const CLOCK_OBJECT_ID = "0x6";
