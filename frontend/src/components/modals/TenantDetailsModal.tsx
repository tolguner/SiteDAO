import { X, User, Phone, Mail, Calendar, CreditCard, Shield, Clock } from "lucide-react";
import { useSiteStore, type TenantPass } from "@/lib/store";
import { useEffect, useState } from "react";

interface TenantDetailsModalProps {
    pass: TenantPass;
    onClose: () => void;
}

export function TenantDetailsModal({ pass, onClose }: TenantDetailsModalProps) {
    const getUserProfile = useSiteStore((state) => state.getUserProfile);
    const profile = getUserProfile(pass.holder);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    const rentPaidUntil = pass.rentPaidUntil && pass.rentPaidUntil > 0
        ? new Date(pass.rentPaidUntil).toLocaleDateString("tr-TR")
        : "-";

    const monthlyRentSui = pass.monthlyRent / 1_000_000_000;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background rounded-xl shadow-xl w-full max-w-md overflow-hidden border animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-purple-600" />
                        <h2 className="font-semibold text-lg">Kiracı Bilgileri</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* Profile Section */}
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xl font-bold flex-shrink-0 border-2 border-purple-200 dark:border-purple-800">
                            {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : <User />}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">
                                {profile?.displayName || "İsimsiz Kiracı"}
                            </h3>
                            <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded mt-1 inline-block">
                                {pass.holder.slice(0, 6)}...{pass.holder.slice(-4)}
                            </p>
                            {profile?.bio && (
                                <p className="text-sm text-muted-foreground mt-2 italic">
                                    &quot;{profile.bio}&quot;
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-3">
                            <Mail className="w-4 h-4 text-gray-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">E-posta</p>
                                <p className="text-sm font-medium">{profile?.email || "Belirtilmemiş"}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-3">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">Telefon</p>
                                <p className="text-sm font-medium">{profile?.phone || "Belirtilmemiş"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-500" />
                            Kiralama Detayları
                        </h4>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Başlangıç Tarihi</p>
                                <div className="flex items-center gap-1 font-medium">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(pass.startDate).toLocaleDateString("tr-TR")}
                                </div>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Bitiş Tarihi</p>
                                <div className="flex items-center gap-1 font-medium">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(pass.expiryDate).toLocaleDateString("tr-TR")}
                                </div>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Aylık Kira</p>
                                <div className="flex items-center gap-1 font-medium text-sui">
                                    <CreditCard className="w-3 h-3" />
                                    {monthlyRentSui.toFixed(2)} SUI
                                </div>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Kira Ödenme Tarihi</p>
                                <div className="flex items-center gap-1 font-medium">
                                    <Clock className="w-3 h-3" />
                                    {rentPaidUntil}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="p-4 bg-muted/30 border-t flex justify-end">
                    <button onClick={onClose} className="btn-secondary w-full sm:w-auto">
                        Kapat
                    </button>
                </div>

            </div>
        </div>
    );
}
