"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import {
  createEphemeralKeyPair,
  saveZkLoginSession,
  getZkLoginSession,
  clearZkLoginSession,
  isSessionValid,
  processJwt,
  createAndSaveZkProof,
  ZkLoginSession,
  OAUTH_PROVIDERS,
} from "@/lib/zklogin";
import { SUI_RPC_URL } from "@/lib/constants";

// zkLogin context tipi
interface ZkLoginContextType {
  // Durum
  isConnected: boolean;
  isLoading: boolean;
  address: string | null;
  email: string | null;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
  session: ZkLoginSession | null;
  error: string | null;
  
  // Fonksiyonlar
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  signAndExecuteTransaction: (transaction: Transaction) => Promise<any>;
}

const ZkLoginContext = createContext<ZkLoginContextType | null>(null);

export function useZkLogin() {
  const context = useContext(ZkLoginContext);
  if (!context) {
    throw new Error("useZkLogin must be used within ZkLoginProvider");
  }
  return context;
}

interface ZkLoginProviderProps {
  children: React.ReactNode;
}

export function ZkLoginProvider({ children }: ZkLoginProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [givenName, setGivenName] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [session, setSession] = useState<ZkLoginSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mevcut session'ı kontrol et
  useEffect(() => {
    const checkSession = async () => {
      try {
        const existingSession = getZkLoginSession();
        
        if (existingSession && isSessionValid()) {
          setSession(existingSession);
          setAddress(existingSession.userAddress || null);
          setEmail(existingSession.email || null);
          setName(existingSession.name || null);
          setGivenName(existingSession.givenName || null);
          setFamilyName(existingSession.familyName || null);
          setPicture(existingSession.picture || null);
          setIsConnected(!!existingSession.userAddress);
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, []);

  // URL'den id_token'ı kontrol et (OAuth callback sonrası)
  useEffect(() => {
    const handleCallback = async () => {
      // Hash'ten id_token al
      if (typeof window !== "undefined" && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const idToken = params.get("id_token");
        
        if (idToken) {
          setIsLoading(true);
          setError(null);
          
          try {
            // JWT'yi işle
            const result = await processJwt(idToken);
            
            // ZK proof oluştur
            await createAndSaveZkProof();
            
            // Session'ı güncelle
            const updatedSession = getZkLoginSession();
            setSession(updatedSession);
            setAddress(result.address);
            setEmail(result.email || null);
            setName(result.name || null);
            setGivenName(result.givenName || null);
            setFamilyName(result.familyName || null);
            setPicture(result.picture || null);
            setIsConnected(true);
            
            // URL'yi temizle
            window.history.replaceState({}, "", window.location.pathname);
            
          } catch (err: any) {
            console.error("OAuth callback error:", err);
            setError(err.message);
          } finally {
            setIsLoading(false);
          }
        }
      }
      
      // Query param'dan hata kontrol
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      if (authError) {
        setError(decodeURIComponent(authError));
        window.history.replaceState({}, "", window.location.pathname);
      }
    };
    
    handleCallback();
  }, []);

  // Google ile giriş
  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const clientId = OAUTH_PROVIDERS.google.clientId;
      
      if (!clientId) {
        throw new Error("Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env.local file.");
      }
      
      // Ephemeral keypair oluştur
      const ephemeralData = await createEphemeralKeyPair();
      
      // Session'a kaydet
      saveZkLoginSession({
        ephemeralData: {
          keypair: ephemeralData.keypair,
          randomness: ephemeralData.randomness,
          nonce: ephemeralData.nonce,
          maxEpoch: ephemeralData.maxEpoch,
          expiresAt: ephemeralData.expiresAt,
        },
        provider: "google",
      });
      
      // Google OAuth URL'i oluştur - Implicit Flow (client_secret gerektirmez)
      const redirectUri = window.location.origin;
      
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "id_token",
        scope: OAUTH_PROVIDERS.google.scope,
        nonce: ephemeralData.nonce,
        prompt: "select_account",
      });
      
      // Google'a yönlendir
      window.location.href = `${OAUTH_PROVIDERS.google.authUrl}?${params.toString()}`;
      
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message);
      setIsLoading(false);
    }
  }, []);

  // Çıkış yap
  const logout = useCallback(() => {
    // Önce tüm session verilerini temizle
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("zklogin_session");
      sessionStorage.clear(); // Tüm session storage'ı temizle
    }
    
    // State'leri sıfırla
    setSession(null);
    setAddress(null);
    setEmail(null);
    setName(null);
    setGivenName(null);
    setFamilyName(null);
    setPicture(null);
    setIsConnected(false);
    setError(null);
    
    // Kısa gecikme ile ana sayfaya yönlendir
    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    }
  }, []);

  // İşlem imzala ve çalıştır
  const signAndExecuteTransaction = useCallback(async (transaction: Transaction) => {
    const currentSession = getZkLoginSession();
    
    if (!currentSession?.ephemeralData || !currentSession.zkProof || !currentSession.salt) {
      throw new Error("Not authenticated with zkLogin");
    }
    
    const suiClient = new SuiClient({ url: SUI_RPC_URL });
    
    // Transaction'ı build et
    const txBytes = await transaction.build({
      client: suiClient,
    });
    
    // Ephemeral key ile imzala
    const { signature: userSignature } = await currentSession.ephemeralData.keypair.signTransaction(txBytes);
    
    // zkLogin signature oluştur
    const zkLoginSignature = getZkLoginSignature({
      inputs: {
        ...currentSession.zkProof,
        addressSeed: currentSession.zkProof.addressSeed,
      },
      maxEpoch: currentSession.ephemeralData.maxEpoch,
      userSignature,
    });
    
    // İşlemi çalıştır
    // objectChanges olmadan oluşturulan paylaşılan nesnelerin ID'si okunamıyor
    const result = await suiClient.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: zkLoginSignature,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });
    
    return result;
  }, []);

  const value: ZkLoginContextType = {
    isConnected,
    isLoading,
    address,
    email,
    name,
    givenName,
    familyName,
    picture,
    session,
    error,
    loginWithGoogle,
    logout,
    signAndExecuteTransaction,
  };

  return (
    <ZkLoginContext.Provider value={value}>
      {children}
    </ZkLoginContext.Provider>
  );
}
