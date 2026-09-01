
import { ActivityLog } from "@/lib/store/types";
import { Building2, Download, Printer, Share2 } from "lucide-react";
import { useRef } from "react";
import Image from "next/image";

interface InvoiceModalProps {
    transaction: ActivityLog;
    onClose: () => void;
    open: boolean;
}

export function InvoiceModal({ transaction, onClose, open }: InvoiceModalProps) {
    const contentRef = useRef<HTMLDivElement>(null);

    if (!transaction) return null;

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getTransactionDetails = () => {
        switch (transaction.type) {
            case "rent_paid":
                return {
                    title: "Kira Ödemesi Faturası",
                    from: "KİRACI",
                    to: "SİTE YÖNETİMİ (SITEDAO)",
                    description: "Aylık Kira Bedeli",
                    amount: transaction.details.amount,
                    items: [
                        { desc: `${transaction.details.months} Aylık Kira Bedeli`, price: transaction.details.amount }
                    ]
                };
            case "dues_paid":
                return {
                    title: "Aidat Ödemesi Makbuzu",
                    from: "KAT MALİKİ / SAKİNİ",
                    to: "SİTE YÖNETİMİ (SITEDAO)",
                    description: "Aylık Aidat Bedeli",
                    amount: transaction.details.amount,
                    items: [
                        { desc: `${transaction.details.months} Aylık Aidat Ödemesi`, price: transaction.details.amount }
                    ]
                };
            case "apartment_sold":
                return {
                    title: "Gayrimenkul Satış Faturası",
                    from: "ALICI",
                    to: "SATICI",
                    description: "Daire Satış Bedeli",
                    amount: transaction.details.price,
                    items: [
                        { desc: "Taşınmaz Satış Bedeli (NFT Tapu Transferi)", price: transaction.details.price }
                    ]
                };
            default:
                return {
                    title: "İşlem Fişi",
                    from: "GÖNDEREN",
                    to: "ALICI",
                    description: "İşlem",
                    amount: 0,
                    items: []
                };
        }
    };

    const details = getTransactionDetails();
    const formattedAmount = (details.amount / 1_000_000_000).toLocaleString("tr-TR", { minimumFractionDigits: 2 });

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? "" : "hidden"}`}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white text-black rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Invoice Header Actions */}
                <div className="bg-gray-50 border-b px-6 py-3 flex justify-between items-center no-print">
                    <h3 className="font-semibold text-gray-700">Fatura Görüntüleme</h3>
                    <div className="flex gap-2">
                        <button className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="Yazdır" onClick={() => window.print()}>
                            <Printer className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="İndir">
                            <Download className="w-4 h-4 text-gray-600" />
                        </button>
                        <button onClick={onClose} className="ml-2 text-sm text-gray-500 hover:text-black font-medium">
                            Kapat
                        </button>
                    </div>
                </div>

                {/* Invoice Content */}
                <div className="p-10" ref={contentRef}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-white" />
                                </div>
                                <span className="font-bold text-xl tracking-tight">SiteDAO</span>
                            </div>
                            <p className="text-sm text-gray-500">Green Garden Evleri</p>
                            <p className="text-sm text-gray-500">Blokzincir Cad. No:1</p>
                            <p className="text-sm text-gray-500">Sui Network, Web3</p>
                        </div>
                        <div className="text-right">
                            <h1 className="text-3xl font-light text-gray-900 mb-2">FATURA</h1>
                            <p className="text-sm text-gray-500">No: #{transaction.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-sm text-gray-500">Tarih: {formatDate(transaction.timestamp)}</p>
                        </div>
                    </div>

                    {/* From / To */}
                    <div className="flex justify-between mb-12">
                        <div className="w-1/2 pr-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Gönderen</h4>
                            <p className="font-semibold text-gray-800">{details.from}</p>
                            <p className="text-sm text-gray-500 break-all font-mono mt-1">{transaction.actor}</p>
                        </div>
                        <div className="w-1/2 pl-4 border-l">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Alıcı</h4>
                            <p className="font-semibold text-gray-800">{details.to}</p>
                            <p className="text-sm text-gray-500 break-all font-mono mt-1">
                                {transaction.type === 'apartment_sold' ? transaction.details.seller : 'SiteDAO Treasury'}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full mb-8">
                        <thead>
                            <tr className="border-b-2 border-gray-100">
                                <th className="text-left py-3 text-sm font-semibold text-gray-600">Açıklama</th>
                                <th className="text-right py-3 text-sm font-semibold text-gray-600">Tutar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.items.map((item, i) => (
                                <tr key={i} className="border-b border-gray-50">
                                    <td className="py-4 text-gray-700">{item.desc}</td>
                                    <td className="py-4 text-right font-mono text-gray-700">
                                        {(item.price / 1_000_000_000).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} SUI
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Total */}
                    <div className="flex justify-end mb-12">
                        <div className="text-right">
                            <p className="text-sm text-gray-500 mb-1">Toplam Tutar</p>
                            <p className="text-3xl font-bold text-gray-900">{formattedAmount} SUI</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t pt-8 text-center text-xs text-gray-400">
                        <p className="mb-2">Bu belge SiteDAO akıllı sözleşmeleri ve Sui blokzinciri üzerinde gerçekleştirilen işlemin elektronik makbuzudur.</p>
                        <p className="font-mono">{transaction.id}</p>
                    </div>
                </div>

                {/* Decorative Bottom Bar */}
                <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 w-full" />
            </div>
        </div>
    );
}
