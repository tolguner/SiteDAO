"use client";

import { useState, useEffect, useRef } from "react";
import { X, User, Mail, Phone, FileText, Camera, Loader2 } from "lucide-react";
import { useSiteStore, type UserProfileData } from "@/lib/store";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useCurrentAccount } from "@mysten/dapp-kit";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProfileEditModal({ isOpen, onClose, onSuccess }: ProfileEditModalProps) {
  const account = useCurrentAccount();
  const { 
    isConnected: zkLoginConnected, 
    address: zkLoginAddress, 
    name: zkLoginName,
    email: zkLoginEmail,
    picture: zkLoginPicture
  } = useZkLogin();

  const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;
  
  const getUserProfile = useSiteStore((state) => state.getUserProfile);
  const updateUserProfile = useSiteStore((state) => state.updateUserProfile);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal açıldığında mevcut profil bilgilerini yükle
  useEffect(() => {
    if (isOpen && connectedAddress) {
      const existingProfile = getUserProfile(connectedAddress);
      
      if (existingProfile) {
        setDisplayName(existingProfile.displayName || "");
        setEmail(existingProfile.email || "");
        setPhone(existingProfile.phone || "");
        setBio(existingProfile.bio || "");
        setAvatarUrl(existingProfile.avatarUrl || "");
        setAvatarPreview(existingProfile.avatarUrl || null);
      } else {
        // zkLogin'den gelen bilgiler varsa kullan
        setDisplayName(zkLoginName || "");
        setEmail(zkLoginEmail || "");
        setAvatarUrl(zkLoginPicture || "");
        setAvatarPreview(zkLoginPicture || null);
        setPhone("");
        setBio("");
      }
    }
  }, [isOpen, connectedAddress, getUserProfile, zkLoginName, zkLoginEmail, zkLoginPicture]);

  // Validasyon
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (displayName && displayName.length > 50) {
      newErrors.displayName = "Ad en fazla 50 karakter olabilir";
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Geçerli bir e-posta adresi girin";
    }
    
    if (phone && !/^[\d\s\-\+\(\)]{10,20}$/.test(phone)) {
      newErrors.phone = "Geçerli bir telefon numarası girin";
    }
    
    if (bio && bio.length > 300) {
      newErrors.bio = "Biyografi en fazla 300 karakter olabilir";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Avatar seçimi
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 2MB
      if (file.size > 2 * 1024 * 1024) {
        setErrors({ ...errors, avatar: "Dosya boyutu en fazla 2MB olabilir" });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAvatarPreview(base64);
        setAvatarUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Formu kaydet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connectedAddress) return;
    if (!validate()) return;

    setIsLoading(true);
    
    try {
      // Küçük bir gecikme ile kaydet (UX için)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateUserProfile(connectedAddress, {
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Profil güncellenirken hata:", error);
      setErrors({ submit: "Profil güncellenirken bir hata oluştu" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold">Profil Bilgilerini Düzenle</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative">
              {avatarPreview ? (
                <img 
                  src={avatarPreview} 
                  alt="Avatar" 
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            {errors.avatar && (
              <p className="text-red-500 text-sm mt-2">{errors.avatar}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Profil fotoğrafını değiştirmek için tıklayın (max 2MB)
            </p>
          </div>

          {/* Ad Soyad */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <User className="w-4 h-4 text-gray-400" />
              Ad Soyad
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Adınız ve soyadınız"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {errors.displayName && (
              <p className="text-red-500 text-sm mt-1">{errors.displayName}</p>
            )}
          </div>

          {/* E-posta */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Mail className="w-4 h-4 text-gray-400" />
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Telefon */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Phone className="w-4 h-4 text-gray-400" />
              Telefon
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+90 555 123 4567"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          {/* Biyografi */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Hakkımda
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Kendiniz hakkında kısa bir bilgi..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
            />
            <div className="flex justify-between mt-1">
              {errors.bio && (
                <p className="text-red-500 text-sm">{errors.bio}</p>
              )}
              <p className="text-xs text-muted-foreground ml-auto">
                {bio.length}/300
              </p>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-200 dark:border-gray-600 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Kaydet"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
