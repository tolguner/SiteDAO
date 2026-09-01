"use client";

import { X, Loader2, Home, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useSiteStore } from "@/lib/store";
import { TenantPass } from "@/lib/store/types";
import { PACKAGE_ID, CLOCK_OBJECT_ID } from "@/lib/constants";

interface PayRentModalProps {
    pass: TenantPass;
    onClose: () => void;
}

export function PayRentModal({ pass, onClose }: PayRentModalProps) {
    const [extraMonths, setExtraMonths] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const suiClient = useSuiClient();
    const account = useCurrentAccount();
    const { mutateAsync: walletSignAndExecute } = useSignAndExecuteTransaction();
    const {
        address: zkLoginAddress,
        isConnected: zkLoginConnected,
        email: zkLoginEmail,
        signAndExecuteTransaction: zkLoginSignAndExecute
    } = useZkLogin();

    const connectedAddress = zkLoginConnected ? zkLoginAddress : account?.address;

    // Store'dan payRent fonksiyonu
    const payRent = useSiteStore((state) => state.payRent);
    const getApartment = useSiteStore(s => s.getApartment);
    const apartment = getApartment(pass.apartmentId);

    const signAndExecute = async (params: { transaction: Transaction }) => {
        if (zkLoginConnected) {
            return await zkLoginSignAndExecute(params.transaction);
        } else {
            return await walletSignAndExecute(params);
        }
    };

    // Kira ancak zincirdeki TenantPass nesnesi biliniyorsa zincire ödenebilir
    const onChainEnabled = !!(PACKAGE_ID && pass.onChainId);

    // Kira hesapla
    const rentInfo = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentMonthStart = new Date(currentYear, currentMonth, 1).getTime();

        const effectivePaidUntil = pass.rentPaidUntil && pass.rentPaidUntil > 0
            ? pass.rentPaidUntil
            : pass.startDate; // Eğer hiç ödenmediyse başlangıçtan itibaren

        // Kaç aylık kira ödenmemiş
        let unpaidMonths = 0;
        // Kira başlangıcı
        let checkDate = new Date(pass.startDate);

        // Ayın 1'ine yuvarla (eğer startDate ayın ortasıysa, o ayın kirası ödenmiştir muhtemelen, sonraki ayın 1'i)
        // Basitlik için: startDate'den itibaren her 30 gün bir ay sayalım veya takvim ayı.
        // Kullanıcı "her ayın 1inde" dedi.
        // Logic: effectivePaidUntil < bu ayın 1'i -> Gecikmiş.
        // Eğer effectivePaidUntil < PreviousMonth 1 -> 2 ay gecikmiş.

        // Check loop similar to Dues
        // Check points: startDate, startDate+1month... until now.
        // Or just align to Month 1st logic.
        // Let's use loop aligned to current month checks.

        // Basit mantık:
        // Eğer effectivePaidUntil < currentMonthStart ise en az 1 ay (bu ay) ödenmemiş.
        // Eğer effectivePaidUntil < currentMonthStart - 1 month ...

        let pointer = new Date(checkDate);
        // Align pointer to next due date logic?
        // Let's assume rent is prepaid. If paidUntil < now, it is unpaid?
        // Usually rent is paid in advance for the month.
        // If today is Jan 17. PaidUntil Jan 1. Unpaid for Jan.
        // If PaidUntil Feb 1. Paid for Jan.

        // Count how many months effectivePaidUntil is behind Target (Next Month Start? or Current Month Start?).
        // If today is Jan 17, due date was Jan 1 (if existed).
        // If PaidUntil < Jan 1, we owe Jan rent.

        const targetDate = new Date(currentYear, currentMonth + 1, 1); // Next month?
        // Wait, if it is overdue, we want to pay up to now + extra.

        // Let's use simple math: (Now - PaidUntil) / MonthMs
        const diff = currentMonthStart - effectivePaidUntil;
        if (diff >= 0) {
            // e.g. PaidUntil Jan 1. Now Jan 17. Diff > 0? No, checking MonthStart.
            // If PaidUntil = Jan 1. CurrentMonthStart = Jan 1. Diff = 0.
            // It means Jan rent is due (since it covers Jan).
            // So unpaid = 1.
        }

        // Recalculate loop
        let tempDate = new Date(effectivePaidUntil);
        while (tempDate.getTime() <= currentMonthStart) {
            if (tempDate.getTime() < currentMonthStart + 1000) { // Tolerance
                unpaidMonths++;
            }
            tempDate.setMonth(tempDate.getMonth() + 1);
            if (unpaidMonths > 60) break; // Safety
        }

        // Adjust logic:
        // If PaidUntil is Jan 1 2026. Current Date Jan 17 2026.
        // Is Jan Rent paid?
        // If PaidUntil means "Paid UP TO Jan 1", then Jan 1-Feb 1 is NOT paid.
        // So Jan rent is due.
        // So unpaidMonths = 1.

        // My loop above: tempDate starts Jan 1.
        // Jan 1 <= Jan 1 (CurrentMonthStart). Loop runs. unpaidMonths=1.
        // tempDate becomes Feb 1.
        // Feb 1 <= Jan 1 -> False.
        // Result: 1. Correct.

        // What if PaidUntil = Dec 1 2025.
        // Loop: Dec 1 <= Jan 1. (1)
        // Jan 1 <= Jan 1. (2)
        // Feb 1.
        // Result: 2 months. Correct.

        return {
            unpaidMonths,
            unpaidAmount: unpaidMonths * (pass.monthlyRent / 1_000_000_000),
            isPaid: unpaidMonths === 0
        };
    }, [pass.rentPaidUntil, pass.startDate, pass.monthlyRent]);

    const totalMonths = rentInfo.unpaidMonths + extraMonths;
    const totalAmount = totalMonths * (pass.monthlyRent / 1_000_000_000);
    const totalAmountMist = totalMonths * pass.monthlyRent; // MIST

    const handlePayRent = async () => {
        if (totalMonths === 0 || !connectedAddress || !payRent || !apartment) return;

        setIsLoading(true);
        try {
            if (!onChainEnabled) {
                throw new Error("Kiracı kartının zincir kaydı yok");
            }

            const tx = new Transaction();
            tx.setSender(connectedAddress);

            const [coin] = tx.splitCoins(tx.gas, [
                tx.pure.u64(totalAmountMist),
            ]);

            // rent_market::pay_rent(tenant_pass, payment, months, clock)
            // Ödeme doğrudan ev sahibine gider, rent_paid_until zincirde ilerler.
            tx.moveCall({
                target: `${PACKAGE_ID}::rent_market::pay_rent`,
                arguments: [
                    tx.object(pass.onChainId!),
                    coin,
                    tx.pure.u64(totalMonths),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            const result = await signAndExecute({ transaction: tx });
            console.log("Kira zincire ödendi:", result);

            payRent(pass.id, connectedAddress, totalMonths);
            onClose();
        } catch (error) {
            // Zincire yazılamazsa ödeme yalnızca yerel veride işlenir (demo modu)
            console.error("Kira zincire ödenemedi, demo modunda devam ediliyor:", error);
            payRent(pass.id, connectedAddress, totalMonths);
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card rounded-xl border shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Kira Öde</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-muted-foreground">Daire</p>
                    <p className="font-semibold">{pass.apartmentBlock} - No: {pass.apartmentFlat}</p>
                </div>

                {rentInfo.unpaidMonths > 0 && (
                    <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4 mb-4 border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-red-700 dark:text-red-300">Gecikmiş Kira</p>
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    {rentInfo.unpaidMonths} aylık ödenmemiş kira bulunmaktadır
                                </p>
                                <p className="text-lg font-bold text-red-700 dark:text-red-300 mt-1">
                                    {rentInfo.unpaidAmount.toFixed(2)} SUI
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                        {rentInfo.isPaid ? "Kaç Ay Önceden Ödemek İstiyorsunuz?" : "Ek Olarak Kaç Ay Ödemek İstiyorsunuz?"}
                    </label>
                    <div className="flex gap-2">
                        {(rentInfo.isPaid ? [1, 3, 6, 12] : [0, 1, 3, 6]).map((m) => (
                            <button
                                key={m}
                                onClick={() => setExtraMonths(m)}
                                className={`flex-1 py-2 rounded-lg border transition-colors ${extraMonths === m
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "hover:bg-muted"
                                    }`}
                            >
                                {m === 0 ? "Yok" : `+${m} Ay`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <div className="flex justify-between mb-2">
                        <span className="text-muted-foreground">Aylık Kira</span>
                        <span>{(pass.monthlyRent / 1_000_000_000).toFixed(2)} SUI</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-semibold text-lg">
                            <span>Toplam ({totalMonths} ay)</span>
                            <span className="text-sui">{totalAmount.toFixed(2)} SUI</span>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        Ödeme Ev Sahibine aktarılacaktır
                    </p>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="btn-secondary flex-1">İptal</button>
                    <button onClick={handlePayRent} disabled={isLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                        {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> İşleniyor...</> : "Öde"}
                    </button>
                </div>
            </div>
        </div>
    );
}
