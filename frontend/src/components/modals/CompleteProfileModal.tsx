"use client";

import { useState } from "react";
import { useSiteStore } from "@/lib/store";
import { User, Mail, Phone, Loader2, AlertCircle } from "lucide-react";
import { UserProfileData } from "@/lib/store/types";

interface CompleteProfileModalProps {
    address: string;
    initialData?: Partial<UserProfileData>;
    onSuccess: () => void;
}

export function CompleteProfileModal({ address, initialData, onSuccess }: CompleteProfileModalProps) {
    const updateUserProfile = useSiteStore((state) => state.updateUserProfile);

    const [formData, setFormData] = useState({
        displayName: initialData?.displayName || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.displayName || !formData.email || !formData.phone) {
            setError("Ad Soyad, E-posta ve Telefon alanları zorunludur.");
            return;
        }

        setLoading(true);
        try {
            updateUserProfile(address, {
                displayName: formData.displayName,
                email: formData.email,
                phone: formData.phone
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Profil güncellenirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card rounded-xl border shadow-2xl p-6 m-4 animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold">Profil Bilgilerinizi Tamamlayın</h2>
                    <p className="text-muted-foreground mt-2">
                        Devam etmek için lütfen iletişim bilgilerinizi girin. Bu bilgiler ev sahibi/kiracı iletişimi için gereklidir.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2 border border-red-200 dark:border-red-800">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Ad Soyad <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Adınız Soyadınız"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">E-posta <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="ornek@email.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">Telefon <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="0555 555 55 55"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary py-3 flex items-center justify-center gap-2 mt-6 font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet ve Devam Et"}
                    </button>
                </form>
            </div>
        </div>
    );
}
