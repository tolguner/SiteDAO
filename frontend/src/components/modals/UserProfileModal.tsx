import { X, User, Phone, Mail, Shield, MapPin, BadgeCheck } from "lucide-react";
import { useSiteStore } from "@/lib/store";
import { useEffect } from "react";

interface UserProfileModalProps {
    address: string;
    type: "owner" | "tenant";
    onClose: () => void;
}

export function UserProfileModal({ address, type, onClose }: UserProfileModalProps) {
    const getUserProfile = useSiteStore((state) => state.getUserProfile);
    const profile = getUserProfile(address);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background rounded-xl shadow-xl w-full max-w-md overflow-hidden border animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className={`flex justify-between items-center p-4 border-b ${type === "owner" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-purple-50 dark:bg-purple-900/20"}`}>
                    <div className="flex items-center gap-2">
                        {type === "owner" ? (
                            <Shield className="w-5 h-5 text-blue-600" />
                        ) : (
                            <User className="w-5 h-5 text-purple-600" />
                        )}
                        <h2 className="font-semibold text-lg">
                            {type === "owner" ? "Ev Sahibi Bilgileri" : "Kiracı Bilgileri"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-black/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">

                    {/* Profile Section */}
                    <div className="flex items-start gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 border-2 
                            ${type === "owner"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"
                            }`}>
                            {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : <User />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold">
                                    {profile?.displayName || (type === "owner" ? "İsimsiz Ev Sahibi" : "İsimsiz Kiracı")}
                                </h3>
                                {type === "owner" && (
                                    <span title="Doğrulanmış Mülk Sahibi">
                                        <BadgeCheck className="w-4 h-4 text-blue-500" />
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded mt-1 inline-block">
                                {address.slice(0, 8)}...{address.slice(-6)}
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
                        <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <div>
                                <p className="text-xs text-muted-foreground">Cüzdan Adresi</p>
                                <p className="text-xs font-mono font-medium break-all">{address}</p>
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
