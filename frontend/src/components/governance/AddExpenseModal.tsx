import { useState } from "react";
import { X, DollarSign, Calendar, Tag, FileText, Upload, Loader2, FileCheck } from "lucide-react";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useSiteStore, RoutineExpense } from "@/lib/store";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import {
    PACKAGE_ID,
    TREASURY_ID,
    GOVERNANCE_ADMIN_CAP_ID,
    CLOCK_OBJECT_ID,
} from "@/lib/constants";

interface AddExpenseModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function AddExpenseModal({ onClose, onSuccess }: AddExpenseModalProps) {
    const addRoutineExpense = useSiteStore((state) => state.addRoutineExpense);
    const [loading, setLoading] = useState(false);

    const account = useCurrentAccount();
    const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();
    const {
        address: zkLoginAddress,
        isConnected: zkLoginConnected,
        signAndExecuteTransaction: zkLoginSignAndExecute,
    } = useZkLogin();

    const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;

    // Rutin gider hazineden ödendiği için AdminCap gerekir
    const onChainEnabled = !!(PACKAGE_ID && TREASURY_ID && GOVERNANCE_ADMIN_CAP_ID);

    const signAndExecute = async (params: { transaction: Transaction }) => {
        if (zkLoginConnected) {
            return await zkLoginSignAndExecute(params.transaction);
        }
        return await walletSignAndExecute(params);
    };
    const [formData, setFormData] = useState({
        title: "",
        amount: "",
        category: "maintenance" as RoutineExpense["category"],
        expenseDate: new Date().toISOString().split("T")[0],
        description: "",
        invoiceHash: "",
    });
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const uploadToIPFS = async () => {
        if (!file) return;

        setIsUploading(true);
        try {
            const body = new FormData();
            body.append("file", file);

            const response = await fetch("/api/upload-ipfs", { method: "POST", body });
            if (!response.ok) throw new Error("IPFS yükleme hatası");

            const data = await response.json();
            setFormData(prev => ({ ...prev, invoiceHash: data.ipfsHash }));
        } catch (error) {
            console.error("IPFS yükleme hatası:", error);
            // Pinata anahtarları yoksa demo hash ile devam et
            setFormData(prev => ({ ...prev, invoiceHash: `QmDemo${Date.now()}` }));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // SUI miktarını MIST'e çevir (1 SUI = 1_000_000_000 MIST)
        const amountInMist = Math.floor(parseFloat(formData.amount) * 1_000_000_000);

        try {
            if (onChainEnabled && connectedAddress) {
                const tx = new Transaction();
                tx.setSender(connectedAddress);

                // governance::record_routine_expense(admin_cap, treasury, title, category,
                //                                    amount, recipient, ipfs_hash, clock)
                // Oylama gerektirmeyen düzenli giderler doğrudan hazineden ödenir.
                tx.moveCall({
                    target: `${PACKAGE_ID}::governance::record_routine_expense`,
                    arguments: [
                        tx.object(GOVERNANCE_ADMIN_CAP_ID),
                        tx.object(TREASURY_ID),
                        tx.pure.string(formData.title),
                        tx.pure.string(formData.category),
                        tx.pure.u64(amountInMist),
                        tx.pure.address(connectedAddress),
                        tx.pure.string(formData.invoiceHash || ""),
                        tx.object(CLOCK_OBJECT_ID),
                    ],
                });

                const result = await signAndExecute({ transaction: tx });
                console.log("Rutin gider zincire yazıldı:", result);
            }
        } catch (error) {
            // Zincire yazılamazsa gider yalnızca yerel veride kaydedilir (demo modu)
            console.error("Rutin gider zincire yazılamadı, demo modunda devam ediliyor:", error);
        }

        try {
            addRoutineExpense({
                title: formData.title,
                amount: amountInMist,
                category: formData.category,
                expenseDate: new Date(formData.expenseDate).getTime(),
                description: formData.description,
                invoiceHash: formData.invoiceHash || undefined,
            });

            onSuccess();
        } catch (error) {
            console.error("Harcama eklenirken hata oluştu:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl border animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-semibold">Yeni Gider Ekle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Başlık */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Gider Başlığı</label>
                        <input
                            required
                            type="text"
                            placeholder="Örn: Asansör Bakımı"
                            className="w-full px-3 py-2 rounded-lg border bg-background"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    {/* Tutar */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Tutar (SUI)</label>
                        <div className="relative">
                            <input
                                required
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-full px-3 py-2 pl-9 rounded-lg border bg-background"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                            <DollarSign className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Kategori */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Kategori</label>
                        <div className="relative">
                            <select
                                className="w-full px-3 py-2 pl-9 rounded-lg border bg-background appearance-none"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                            >
                                <option value="maintenance">Bakım & Onarım</option>
                                <option value="utilities">Faturalar (Elektrik, Su vb.)</option>
                                <option value="security">Güvenlik</option>
                                <option value="cleaning">Temizlik</option>
                                <option value="other">Diğer</option>
                            </select>
                            <Tag className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Tarih */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Harcama Tarihi</label>
                        <div className="relative">
                            <input
                                required
                                type="date"
                                className="w-full px-3 py-2 pl-9 rounded-lg border bg-background"
                                value={formData.expenseDate}
                                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                            />
                            <Calendar className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Açıklama */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Açıklama (Opsiyonel)</label>
                        <div className="relative">
                            <textarea
                                rows={3}
                                placeholder="Detaylı açıklama..."
                                className="w-full px-3 py-2 pl-9 rounded-lg border bg-background resize-none"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                            <FileText className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        </div>
                    </div>


                    {/* Fatura Yükleme */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Fatura/Fiş (Opsiyonel)</label>
                        <div className="border border-dashed rounded-lg p-4 text-center">
                            {formData.invoiceHash ? (
                                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                        <FileCheck className="w-4 h-4" />
                                        <span>Fatura yüklendi</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, invoiceHash: "" }));
                                            setFile(null);
                                        }}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Kaldır
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-center gap-4">
                                        <label className="cursor-pointer btn-secondary text-sm py-1.5 px-3 flex items-center gap-2">
                                            <Upload className="w-4 h-4" />
                                            Dosya Seç
                                            <input
                                                type="file"
                                                onChange={handleFileChange}
                                                accept="image/*,.pdf"
                                                className="hidden"
                                            />
                                        </label>
                                        {file && <span className="text-sm text-muted-foreground truncate max-w-[150px]">{file.name}</span>}
                                    </div>

                                    {file && (
                                        <button
                                            type="button"
                                            onClick={uploadToIPFS}
                                            disabled={isUploading}
                                            className="w-full btn-primary text-sm py-1.5"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                                    Yükleniyor...
                                                </>
                                            ) : (
                                                "IPFS'e Yükle"
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border hover:bg-muted font-medium transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading ? "Ekleniyor..." : "Harcamayı Ekle"}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
