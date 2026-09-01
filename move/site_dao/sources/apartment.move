// Modül A: Apartment (Varlık Yönetimi)
// Daire NFT'lerini yöneten modül
module site_dao::apartment {
    use std::string::String;
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::package::{Self, Publisher};
    use sui::transfer_policy;

    // ==================== Hatalar ====================
    const EInsufficientPayment: u64 = 1;

    // ==================== Sabitler ====================
    const MONTHLY_DUES: u64 = 100_000_000; // 0.1 SUI (MIST cinsinden)
    const MONTH_IN_MS: u64 = 2_592_000_000; // 30 gün milisaniye cinsinden

    // ==================== Struct'lar ====================
    
    /// One-Time Witness - Publisher almak için gerekir.
    /// Tip adı modül adının büyük harflisi olmak zorundadır.
    public struct APARTMENT has drop {}

    /// Admin yetkisi - sadece deployer'da olur
    public struct AdminCap has key, store {
        id: UID
    }

    /// Daire NFT'si - Ev sahipliğini temsil eder
    public struct Apartment has key, store {
        id: UID,
        block: String,           // Örn: "A Blok"
        flat_number: u64,        // Daire numarası
        dues_paid_until: u64     // Aidatın ödendiği son tarih (timestamp)
    }

    // ==================== Events ====================
    
    public struct ApartmentMinted has copy, drop {
        apartment_id: ID,
        block: String,
        flat_number: u64,
        owner: address
    }

    public struct DuesPaid has copy, drop {
        apartment_id: ID,
        amount: u64,
        paid_until: u64
    }

    // ==================== Init ====================
    
    /// Modül yayınlandığında AdminCap ve Publisher oluştur, deployer'a gönder.
    ///
    /// Publisher, Apartment için TransferPolicy oluşturmakta kullanılır; Kiosk'ta
    /// kilitlenen bir daire ancak geçerli bir TransferPolicy ile dışarı çıkabilir.
    fun init(otw: APARTMENT, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        transfer::public_transfer(publisher, tx_context::sender(ctx));

        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    /// Apartment için TransferPolicy oluştur ve paylaş
    ///
    /// Kiosk'ta kilitli daireler yalnızca bu politika onaylanarak el değiştirebilir.
    /// Politika kuralsız (boş) oluşturulur; ileride komisyon veya kilit süresi gibi
    /// kurallar TransferPolicyCap ile eklenebilir.
    public entry fun create_transfer_policy(publisher: &Publisher, ctx: &mut TxContext) {
        let (policy, policy_cap) = transfer_policy::new<Apartment>(publisher, ctx);
        transfer::public_share_object(policy);
        transfer::public_transfer(policy_cap, tx_context::sender(ctx));
    }

    // ==================== Public Functions ====================
    
    /// Yeni daire mint et - Sadece AdminCap sahibi çağırabilir
    public entry fun mint_apartment(
        _admin: &AdminCap,
        block: String,
        flat_number: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let apartment = Apartment {
            id: object::new(ctx),
            block,
            flat_number,
            dues_paid_until: 0 // Başlangıçta aidat ödenmemiş
        };

        event::emit(ApartmentMinted {
            apartment_id: object::id(&apartment),
            block: apartment.block,
            flat_number: apartment.flat_number,
            owner: recipient
        });

        transfer::transfer(apartment, recipient);
    }

    /// Aidat ödemesini kaydet - tutarı doğrular ve dues_paid_until'i günceller.
    ///
    /// Zaman damgası çağırandan parametre olarak alınmaz, Clock'tan okunur;
    /// aksi halde çağıran istediği tarihi geçirip aidatı ileri tarihe atabilirdi.
    ///
    /// Coin'in hazineye yatırılması bu modülün sorumluluğunda değildir:
    /// apartment modülü governance'ı tanımaz (döngüsel bağımlılık olurdu).
    /// Ödemenin paylaşılan Treasury nesnesine yatırılması için
    /// governance::pay_dues kullanılmalıdır.
    public fun record_dues_payment(
        apartment: &mut Apartment,
        payment_amount: u64,
        months: u64,
        clock: &Clock
    ) {
        let required_amount = MONTHLY_DUES * months;
        assert!(payment_amount >= required_amount, EInsufficientPayment);

        let current_time = clock::timestamp_ms(clock);

        // Eğer aidat zaten ödenmişse, son tarihten devam et
        let start_time = if (apartment.dues_paid_until > current_time) {
            apartment.dues_paid_until
        } else {
            current_time
        };

        // Yeni bitiş tarihini hesapla
        apartment.dues_paid_until = start_time + (MONTH_IN_MS * months);

        event::emit(DuesPaid {
            apartment_id: object::id(apartment),
            amount: payment_amount,
            paid_until: apartment.dues_paid_until
        });
    }

    // ==================== View Functions ====================
    
    /// Daire bilgilerini getir
    public fun get_apartment_info(apartment: &Apartment): (String, u64, u64) {
        (apartment.block, apartment.flat_number, apartment.dues_paid_until)
    }

    /// Daire ID'sini getir
    public fun get_id(apartment: &Apartment): ID {
        object::id(apartment)
    }

    /// Daire UID referansını getir
    public fun get_uid(apartment: &Apartment): &UID {
        &apartment.id
    }

    /// Aidat ödenme tarihini getir
    public fun get_dues_paid_until(apartment: &Apartment): u64 {
        apartment.dues_paid_until
    }

    /// Blok bilgisini getir
    public fun get_block(apartment: &Apartment): String {
        apartment.block
    }

    /// Daire numarasını getir
    public fun get_flat_number(apartment: &Apartment): u64 {
        apartment.flat_number
    }

    // ==================== Test Only ====================
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(APARTMENT {}, ctx);
    }
}
