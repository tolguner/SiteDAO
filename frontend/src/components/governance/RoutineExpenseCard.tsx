import { RoutineExpense } from "@/lib/store";
import { Calendar, DollarSign, FileText, Trash2, ExternalLink, Receipt, Upload } from "lucide-react";
import { IPFS_GATEWAY } from "@/lib/constants";

interface RoutineExpenseCardProps {
    expense: RoutineExpense;
    isAdmin: boolean;
    onDelete: () => void;
    onUploadInvoice: () => void;
}

export function RoutineExpenseCard({ expense, isAdmin, onDelete, onUploadInvoice }: RoutineExpenseCardProps) {
    const expenseDate = new Date(expense.expenseDate).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case "maintenance": return "Bakım & Onarım";
            case "utilities": return "Faturalar";
            case "security": return "Güvenlik";
            case "cleaning": return "Temizlik";
            case "other": return "Diğer";
            default: return category;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case "maintenance": return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
            case "utilities": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
            case "security": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
            case "cleaning": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
            default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
        }
    };

    return (
        <div className="bg-card rounded-xl border p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(expense.category)}`}>
                            {getCategoryLabel(expense.category)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {expenseDate}
                        </span>
                    </div>
                    <h3 className="font-semibold text-lg">{expense.title}</h3>
                </div>

                {isAdmin && (
                    <button
                        onClick={onDelete}
                        className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                        title="Harcamayı Sil"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {expense.description && (
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <FileText className="w-3 h-3 inline mr-1" />
                    {expense.description}
                </p>
            )}

            {expense.invoiceHash ? (
                <a
                    href={`${IPFS_GATEWAY}/${expense.invoiceHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    title="Faturayı Görüntüle"
                >
                    <Receipt className="w-4 h-4" />
                    <span className="font-medium">Fatura/Fiş Görüntüle</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
            ) : isAdmin && (
                <button
                    onClick={onUploadInvoice}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/50 rounded-lg hover:bg-muted border border-dashed border-muted-foreground/30"
                >
                    <Upload className="w-4 h-4" />
                    <span>Fatura Yükle</span>
                </button>
            )}

            <div className="flex justify-between items-center mt-auto pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                    Tutar
                </div>
                <div className="text-xl font-bold font-mono">
                    {(expense.amount / 1_000_000_000).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} SUI
                </div>
            </div>
        </div>
    );
}
