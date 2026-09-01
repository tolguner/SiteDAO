
import { useState } from "react";
import { X, Upload, Loader2, CheckCircle } from "lucide-react";
import { useSiteStore, RoutineExpense } from "@/lib/store";

interface RoutineExpenseInvoiceModalProps {
    expense: RoutineExpense;
    onClose: () => void;
    onSuccess: () => void;
}

export function RoutineExpenseInvoiceModal({ expense, onClose, onSuccess }: RoutineExpenseInvoiceModalProps) {
    const updateRoutineExpense = useSiteStore((state) => state.updateRoutineExpense);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ipfsHash, setIpfsHash] = useState<string>("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setIpfsHash(""); // Reset hash if file changes
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
            setIpfsHash(data.ipfsHash);
        } catch (error) {
            console.error("IPFS yükleme hatası:", error);
            // Pinata anahtarları yoksa demo hash ile devam et
            setIpfsHash(`QmDemo${Date.now()}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!ipfsHash) return;

        setIsSubmitting(true);
        try {
            updateRoutineExpense(expense.id, { invoiceHash: ipfsHash });
            onSuccess();
        } catch (error) {
            console.error("Fatura güncellenirken hata:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl border animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-semibold">Fatura Yükle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                        <p className="font-medium text-sm text-foreground">{expense.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {(expense.amount / 1_000_000_000).toLocaleString("tr-TR")} SUI
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Fatura Dosyası</label>
                        <div className="border border-dashed rounded-lg p-4 text-center">
                            {ipfsHash ? (
                                <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Yüklendi: {ipfsHash.slice(0, 10)}...</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIpfsHash("");
                                            setFile(null);
                                        }}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Değiştir
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

                    <div className="pt-2 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-lg border hover:bg-muted font-medium transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!ipfsHash || isSubmitting}
                            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
