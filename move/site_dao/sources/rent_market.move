// Modül B: Rent Market (Kiralama Pazarı)
// Sui Kiosk entegrasyonu ile kiralama sistemi
module site_dao::rent_market {
    use std::string::String;
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use sui::transfer_policy::{Self, TransferPolicy};
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    
    use site_dao::apartment::{Self, Apartment, AdminCap};

    // ==================== Hatalar ====================
    const ENotKioskOwner: u64 = 0;
    const EApartmentNotListed: u64 = 1;
    const EInsufficientPayment: u64 = 2;
    const ERentalExpired: u64 = 3;
    const ENotTenantPassOwner: u64 = 4;
    const ETenantPassNotExpired: u64 = 5;
    const EApartmentAlreadyRented: u64 = 6;
    const EListingNotActive: u64 = 7;
    const EInvalidRequestStatus: u64 = 10;
    const ENotListingOwner: u64 = 11;

    // ==================== Talep Durumları ====================
    const REQUEST_PENDING: u8 = 0;
    const REQUEST_APPROVED: u8 = 1;
    const REQUEST_REJECTED: u8 = 2;
    const REQUEST_COMPLETED: u8 = 3;

    // ==================== Sabitler ====================
    const MONTH_IN_MS: u64 = 2_592_000_000; // 30 gün milisaniye cinsinden

    const EInvalidDuration: u64 = 8;
    const ERentAlreadyPaid: u64 = 9;

    // ==================== Struct'lar ====================
    
    /// Kiralama listesi - Shared Object olarak tutulur
    public struct RentalRegistry has key {
        id: UID,
        /// apartment_id -> RentalListing
        listings: Table<ID, RentalListing>,
        /// Aktif kiralamalar: apartment_id -> ActiveRental
        active_rentals: Table<ID, ActiveRental>
    }

    /// Aktif kiralama kaydı
    ///
    /// Bitiş tarihi burada da tutulur; böylece süresi dolmuş bir kiralamayı kayıttan
    /// düşürmek için TenantPass nesnesine ihtiyaç kalmaz. TenantPass soulbound olduğu
    /// için yalnızca kiracının cüzdanından geçirilebilir; kiracı kartı yakmazsa daire
    /// aksi halde sonsuza dek kirada görünürdü.
    public struct ActiveRental has store, drop {
        tenant_pass_id: ID,
        tenant: address,
        expiry_date: u64
    }

    /// Kiralama ilanı bilgileri
    ///
    /// Daire bilgileri (blok, no) ilan açılırken buraya kopyalanır. Böylece kiralama
    /// işlemi Apartment nesnesine ihtiyaç duymaz: Sui'de sahipli bir nesne yalnızca
    /// sahibinin imzaladığı işleme girdi olabilir, dolayısıyla kiracı ev sahibinin
    /// dairesini referans olarak geçiremezdi.
    public struct RentalListing has store, drop {
        apartment_id: ID,
        apartment_block: String,  // İlan anında kopyalanır
        apartment_flat: u64,      // İlan anında kopyalanır
        owner: address,
        kiosk_id: ID,
        monthly_rent: u64,        // Aylık kira (MIST)
        upfront_months: u64,      // Peşin ödenecek ay sayısı
        min_duration_months: u64, // Minimum kira süresi
        max_duration_months: u64, // Maksimum kira süresi
        is_active: bool
    }

    /// Kiralama talebi - Shared Object
    ///
    /// Talep ve onay zincir üzerinde tutulur; kiralama ancak ilan sahibi tarafından
    /// onaylanmış bir talep üzerinden tamamlanabilir.
    public struct RentalRequest has key {
        id: UID,
        apartment_id: ID,
        listing_owner: address,
        requester: address,
        duration_months: u64,
        status: u8,
        created_at: u64
    }

    /// Kiracı Kartı - SOULBOUND (key var, store YOK!)
    /// Bu obje transfer edilemez ve satılamaz
    public struct TenantPass has key {
        id: UID,
        apartment_id: ID,         // Kiralanan dairenin ID'si
        apartment_block: String,  // Blok bilgisi (kolay erişim için)
        apartment_flat: u64,      // Daire no (kolay erişim için)
        tenant: address,          // Kiracının adresi
        landlord: address,        // Ev sahibinin adresi (kira ödemesi buraya gider)
        start_date: u64,          // Kira başlangıç tarihi
        expiry_date: u64,         // Kira bitiş tarihi
        monthly_rent: u64,        // Aylık kira tutarı
        rent_paid_until: u64      // Kiranın ödendiği son tarih
    }

    // ==================== Events ====================
    
    public struct ApartmentListedForRent has copy, drop {
        apartment_id: ID,
        owner: address,
        monthly_rent: u64
    }

    public struct ApartmentRented has copy, drop {
        apartment_id: ID,
        tenant: address,
        tenant_pass_id: ID,
        duration_months: u64,
        expiry_date: u64
    }

    public struct RentalListingCancelled has copy, drop {
        apartment_id: ID,
        owner: address
    }

    public struct TenantPassBurned has copy, drop {
        tenant_pass_id: ID,
        apartment_id: ID,
        tenant: address
    }

    public struct RentalRequested has copy, drop {
        request_id: ID,
        apartment_id: ID,
        requester: address,
        duration_months: u64
    }

    public struct RentalRequestResolved has copy, drop {
        request_id: ID,
        apartment_id: ID,
        requester: address,
        approved: bool
    }

    public struct ExpiredRentalReleased has copy, drop {
        apartment_id: ID,
        tenant_pass_id: ID,
        tenant: address,
        released_by: address
    }

    public struct RentPaid has copy, drop {
        tenant_pass_id: ID,
        apartment_id: ID,
        tenant: address,
        landlord: address,
        amount: u64,
        paid_until: u64
    }

    // ==================== Init ====================
    
    fun init(ctx: &mut TxContext) {
        let registry = RentalRegistry {
            id: object::new(ctx),
            listings: table::new(ctx),
            active_rentals: table::new(ctx)
        };
        transfer::share_object(registry);
    }

    // ==================== Public Functions ====================
    
    /// Daireyi kiralamak için listele
    ///
    /// Daire ilan süresince Kiosk'a KİLİTLENİR (place değil lock): kilitli bir nesne
    /// Kiosk'tan ancak TransferPolicy onaylanarak çıkabilir, dolayısıyla ev sahibi
    /// kiralama sürerken daireyi başka bir yere devredemez.
    public entry fun list_for_rent(
        registry: &mut RentalRegistry,
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        policy: &TransferPolicy<Apartment>,
        apartment: Apartment,
        monthly_rent: u64,
        upfront_months: u64,
        min_duration_months: u64,
        max_duration_months: u64,
        ctx: &mut TxContext
    ) {
        // Kiosk sahibi kontrolü
        assert!(kiosk::has_access(kiosk, kiosk_cap), ENotKioskOwner);
        
        let apartment_id = apartment::get_id(&apartment);
        
        // Zaten aktif kiralama var mı kontrol et
        assert!(!table::contains(&registry.active_rentals, apartment_id), EApartmentAlreadyRented);

        // Süre aralığı tutarlı olmalı
        assert!(min_duration_months > 0 && min_duration_months <= max_duration_months, EInvalidDuration);

        // Peşinat en az bir ay olmalı ve kira süresini aşmamalı
        assert!(upfront_months > 0 && upfront_months <= min_duration_months, EInvalidDuration);

        // Daire bilgileri ilana kopyalanır; kiralama sırasında Apartment nesnesi gerekmesin
        let (block, flat_number, _) = apartment::get_apartment_info(&apartment);

        let listing = RentalListing {
            apartment_id,
            apartment_block: block,
            apartment_flat: flat_number,
            owner: tx_context::sender(ctx),
            kiosk_id: object::id(kiosk),
            monthly_rent,
            upfront_months,
            min_duration_months,
            max_duration_months,
            is_active: true
        };

        // Eğer daha önce listelenmişse güncelle, yoksa ekle
        if (table::contains(&registry.listings, apartment_id)) {
            let existing = table::remove(&mut registry.listings, apartment_id);
            let _ = existing;
        };
        
        table::add(&mut registry.listings, apartment_id, listing);

        event::emit(ApartmentListedForRent {
            apartment_id,
            owner: tx_context::sender(ctx),
            monthly_rent
        });

        // Daireyi Kiosk'a kilitle - politika olmadan dışarı çıkamaz
        kiosk::lock(kiosk, kiosk_cap, policy, apartment);
    }

    /// Onaylanmış talep üzerinden daireyi kirala ve TenantPass al
    ///
    /// Apartment nesnesi parametre olarak alınmaz: daire ev sahibine aittir ve
    /// Sui'de sahipli nesneler yalnızca sahiplerinin imzaladığı işleme girdi olabilir.
    /// Gerekli daire bilgileri ilan açılırken RentalListing'e kopyalanır.
    ///
    /// Kiralama yalnızca ilan sahibinin onayladığı bir talep ile tamamlanabilir.
    public entry fun rent_apartment(
        registry: &mut RentalRegistry,
        request: &mut RentalRequest,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Talep onaylanmış olmalı ve talebi yapan kişi tarafından kullanılmalı
        assert!(request.status == REQUEST_APPROVED, EInvalidRequestStatus);
        assert!(request.requester == tx_context::sender(ctx), ENotTenantPassOwner);

        let apartment_id = request.apartment_id;
        let duration_months = request.duration_months;

        // Listing kontrolü
        assert!(table::contains(&registry.listings, apartment_id), EApartmentNotListed);

        // Aktif kiralama kontrolü
        assert!(!table::contains(&registry.active_rentals, apartment_id), EApartmentAlreadyRented);

        let listing = table::borrow_mut(&mut registry.listings, apartment_id);

        // İlan hâlâ açık mı?
        assert!(listing.is_active, EListingNotActive);

        // Süre ilanda belirtilen aralıkta olmalı
        assert!(
            duration_months >= listing.min_duration_months
                && duration_months <= listing.max_duration_months,
            EInvalidDuration
        );

        // Ödeme kontrolü: kiralamayı başlatmak için peşinat yeterlidir,
        // kalan aylar pay_rent ile ödenir.
        let upfront_amount = listing.monthly_rent * listing.upfront_months;
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= upfront_amount, EInsufficientPayment);

        let current_time = clock::timestamp_ms(clock);
        let expiry_date = current_time + (duration_months * MONTH_IN_MS);
        let paid_until = current_time + (listing.upfront_months * MONTH_IN_MS);

        // Soulbound TenantPass oluştur
        let tenant_pass = TenantPass {
            id: object::new(ctx),
            apartment_id,
            apartment_block: listing.apartment_block,
            apartment_flat: listing.apartment_flat,
            tenant: tx_context::sender(ctx),
            landlord: listing.owner,
            start_date: current_time,
            expiry_date,
            monthly_rent: listing.monthly_rent,
            // Yalnızca peşin ödenen süre kadar kira ödenmiş sayılır
            rent_paid_until: paid_until
        };

        let tenant_pass_id = object::id(&tenant_pass);
        let landlord = listing.owner;

        // Listingi pasif yap
        listing.is_active = false;

        // Talebi kapat - aynı talep ikinci kez kullanılamaz
        request.status = REQUEST_COMPLETED;

        // Aktif kiralama kaydet
        table::add(
            &mut registry.active_rentals,
            apartment_id,
            ActiveRental {
                tenant_pass_id,
                tenant: tx_context::sender(ctx),
                expiry_date
            }
        );

        event::emit(ApartmentRented {
            apartment_id,
            tenant: tx_context::sender(ctx),
            tenant_pass_id,
            duration_months,
            expiry_date
        });

        // Ödemeyi ev sahibine transfer et
        transfer::public_transfer(payment, landlord);

        // TenantPass'ı kiracıya transfer et (Soulbound - bir kez transfer)
        transfer::transfer(tenant_pass, tx_context::sender(ctx));
    }

    /// Kira öde - ödeme doğrudan ev sahibine gider, rent_paid_until ilerler
    ///
    /// TenantPass soulbound olduğu için yalnızca kiracının cüzdanında bulunur;
    /// &mut TenantPass geçebilmek zaten kiracı olmayı gerektirir.
    public entry fun pay_rent(
        tenant_pass: &mut TenantPass,
        payment: Coin<SUI>,
        months: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(tenant_pass.tenant == tx_context::sender(ctx), ENotTenantPassOwner);

        let current_time = clock::timestamp_ms(clock);

        // Kira sözleşmesi bitmişse ödeme alınmaz
        assert!(current_time < tenant_pass.expiry_date, ERentalExpired);

        // Sözleşme bitişinin ötesine kira ödenemez
        assert!(tenant_pass.rent_paid_until < tenant_pass.expiry_date, ERentAlreadyPaid);

        let required = tenant_pass.monthly_rent * months;
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= required, EInsufficientPayment);

        let start_time = if (tenant_pass.rent_paid_until > current_time) {
            tenant_pass.rent_paid_until
        } else {
            current_time
        };

        tenant_pass.rent_paid_until = start_time + (months * MONTH_IN_MS);

        event::emit(RentPaid {
            tenant_pass_id: object::id(tenant_pass),
            apartment_id: tenant_pass.apartment_id,
            tenant: tenant_pass.tenant,
            landlord: tenant_pass.landlord,
            amount: payment_amount,
            paid_until: tenant_pass.rent_paid_until
        });

        transfer::public_transfer(payment, tenant_pass.landlord);
    }

    /// Süresi dolan TenantPass'ı yok et
    public entry fun burn_expired_tenant_pass(
        registry: &mut RentalRegistry,
        tenant_pass: TenantPass,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        // Süre kontrolü
        assert!(current_time >= tenant_pass.expiry_date, ETenantPassNotExpired);
        
        // Not: TenantPass soulbound ve değer olarak alınıyor; onu ancak sahibi
        // geçirebilir, bu yüzden ayrıca bir sahiplik kontrolüne gerek yoktur.

        let apartment_id = tenant_pass.apartment_id;
        let tenant_pass_id = object::id(&tenant_pass);
        let tenant = tenant_pass.tenant;

        // Aktif kiralamadan kaldır
        if (table::contains(&registry.active_rentals, apartment_id)) {
            table::remove(&mut registry.active_rentals, apartment_id);
        };

        // Listingi tekrar aktif yap
        if (table::contains(&registry.listings, apartment_id)) {
            let listing = table::borrow_mut(&mut registry.listings, apartment_id);
            listing.is_active = true;
        };

        event::emit(TenantPassBurned {
            tenant_pass_id,
            apartment_id,
            tenant
        });

        // TenantPass'ı yok et
        let TenantPass { 
            id, 
            apartment_id: _, 
            apartment_block: _,
            apartment_flat: _,
            tenant: _, 
            landlord: _,
            start_date: _, 
            expiry_date: _,
            monthly_rent: _,
            rent_paid_until: _
        } = tenant_pass;
        object::delete(id);
    }

    /// Süresi dolmuş kiralamayı kayıttan düşür - herkes çağırabilir
    ///
    /// TenantPass soulbound olduğu için yalnızca kiracı yakabilir. Kiracı bunu yapmazsa
    /// daire sonsuza dek kirada görünür; ev sahibi ilanı iptal edemez, yeniden kiralayamaz
    /// ve daire Kiosk'ta kilitli kalır. Bu fonksiyon süre dolduktan sonra kaydı temizler.
    ///
    /// Kiracının elindeki kart yakılmaz ama süresi geçtiği için oy kullanmakta da
    /// kullanılamaz (bkz. is_tenant_pass_valid).
    public entry fun release_expired_rental(
        registry: &mut RentalRegistry,
        apartment_id_bytes: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let apartment_id = object::id_from_address(apartment_id_bytes);

        assert!(table::contains(&registry.active_rentals, apartment_id), EApartmentNotListed);

        let rental = table::borrow(&registry.active_rentals, apartment_id);
        assert!(clock::timestamp_ms(clock) >= rental.expiry_date, ETenantPassNotExpired);

        let ActiveRental { tenant_pass_id, tenant, expiry_date: _ } =
            table::remove(&mut registry.active_rentals, apartment_id);

        // İlanı tekrar aktif yap
        if (table::contains(&registry.listings, apartment_id)) {
            let listing = table::borrow_mut(&mut registry.listings, apartment_id);
            listing.is_active = true;
        };

        event::emit(ExpiredRentalReleased {
            apartment_id,
            tenant_pass_id,
            tenant,
            released_by: tx_context::sender(ctx)
        });
    }

    /// Kiralama ilanını iptal et ve kilitli daireyi ev sahibine geri ver
    ///
    /// Kilitli bir nesne Kiosk'tan doğrudan alınamaz; standart yol nesneyi 0 bedelle
    /// listeleyip satın almak ve TransferPolicy'yi onaylamaktır. Politika kuralsız
    /// olduğu için onay ek bir koşul aramaz.
    public entry fun cancel_listing(
        registry: &mut RentalRegistry,
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        policy: &TransferPolicy<Apartment>,
        apartment_id_bytes: address,
        ctx: &mut TxContext
    ) {
        let apartment_id = object::id_from_address(apartment_id_bytes);

        assert!(table::contains(&registry.listings, apartment_id), EApartmentNotListed);

        let listing = table::borrow(&registry.listings, apartment_id);
        assert!(listing.owner == tx_context::sender(ctx), ENotKioskOwner);

        // Aktif kiralama varsa iptal edilemez
        assert!(!table::contains(&registry.active_rentals, apartment_id), EApartmentAlreadyRented);

        table::remove(&mut registry.listings, apartment_id);

        // Kilitli daireyi Kiosk'tan çıkar
        kiosk::list<Apartment>(kiosk, kiosk_cap, apartment_id, 0);
        let (apartment, request) = kiosk::purchase<Apartment>(
            kiosk,
            apartment_id,
            coin::zero<SUI>(ctx)
        );
        transfer_policy::confirm_request(policy, request);

        event::emit(RentalListingCancelled {
            apartment_id,
            owner: tx_context::sender(ctx)
        });

        transfer::public_transfer(apartment, tx_context::sender(ctx));
    }

    // ==================== Kiralama Talepleri ====================

    /// Kiralama talebi oluştur - kiracı adayı ilana başvurur
    public entry fun request_rental(
        registry: &RentalRegistry,
        apartment_id_bytes: address,
        duration_months: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let apartment_id = object::id_from_address(apartment_id_bytes);

        assert!(table::contains(&registry.listings, apartment_id), EApartmentNotListed);
        assert!(!table::contains(&registry.active_rentals, apartment_id), EApartmentAlreadyRented);

        let listing = table::borrow(&registry.listings, apartment_id);
        assert!(listing.is_active, EListingNotActive);
        assert!(
            duration_months >= listing.min_duration_months
                && duration_months <= listing.max_duration_months,
            EInvalidDuration
        );

        let requester = tx_context::sender(ctx);

        let request = RentalRequest {
            id: object::new(ctx),
            apartment_id,
            listing_owner: listing.owner,
            requester,
            duration_months,
            status: REQUEST_PENDING,
            created_at: clock::timestamp_ms(clock)
        };

        event::emit(RentalRequested {
            request_id: object::id(&request),
            apartment_id,
            requester,
            duration_months
        });

        transfer::share_object(request);
    }

    /// Talebi onayla - yalnızca ilan sahibi
    public entry fun approve_rental_request(
        request: &mut RentalRequest,
        ctx: &mut TxContext
    ) {
        assert!(request.listing_owner == tx_context::sender(ctx), ENotListingOwner);
        assert!(request.status == REQUEST_PENDING, EInvalidRequestStatus);

        request.status = REQUEST_APPROVED;

        event::emit(RentalRequestResolved {
            request_id: object::id(request),
            apartment_id: request.apartment_id,
            requester: request.requester,
            approved: true
        });
    }

    /// Talebi reddet - yalnızca ilan sahibi
    public entry fun reject_rental_request(
        request: &mut RentalRequest,
        ctx: &mut TxContext
    ) {
        assert!(request.listing_owner == tx_context::sender(ctx), ENotListingOwner);
        assert!(request.status == REQUEST_PENDING, EInvalidRequestStatus);

        request.status = REQUEST_REJECTED;

        event::emit(RentalRequestResolved {
            request_id: object::id(request),
            apartment_id: request.apartment_id,
            requester: request.requester,
            approved: false
        });
    }

    /// Admin için TenantPass oluştur (test amaçlı)
    /// apartment bilgileri parametre olarak geçirilir, böylece apartment sahibi olmadan çağrılabilir
    public entry fun admin_create_tenant_pass(
        _admin_cap: &AdminCap,
        registry: &mut RentalRegistry,
        apartment_id_bytes: address,
        apartment_block: String,
        apartment_flat: u64,
        tenant: address,
        landlord: address,
        duration_months: u64,
        monthly_rent: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let apartment_id = object::id_from_address(apartment_id_bytes);
        let current_time = clock::timestamp_ms(clock);
        let expiry_date = current_time + (duration_months * MONTH_IN_MS);

        let tenant_pass = TenantPass {
            id: object::new(ctx),
            apartment_id,
            apartment_block,
            apartment_flat,
            tenant,
            landlord,
            start_date: current_time,
            expiry_date,
            monthly_rent,
            rent_paid_until: expiry_date
        };

        let tenant_pass_id = object::id(&tenant_pass);

        // Aktif kiralama kaydet (eğer yoksa)
        if (!table::contains(&registry.active_rentals, apartment_id)) {
            table::add(
                &mut registry.active_rentals,
                apartment_id,
                ActiveRental { tenant_pass_id, tenant, expiry_date }
            );
        };

        event::emit(ApartmentRented {
            apartment_id,
            tenant,
            tenant_pass_id,
            duration_months,
            expiry_date
        });

        // TenantPass'ı kiracıya transfer et
        transfer::transfer(tenant_pass, tenant);
    }

    // ==================== View Functions ====================
    
    /// TenantPass bilgilerini getir
    public fun get_tenant_pass_info(pass: &TenantPass): (ID, address, u64, u64) {
        (pass.apartment_id, pass.tenant, pass.start_date, pass.expiry_date)
    }

    /// TenantPass'ın geçerli olup olmadığını kontrol et
    public fun is_tenant_pass_valid(pass: &TenantPass, clock: &Clock): bool {
        clock::timestamp_ms(clock) < pass.expiry_date
    }

    /// TenantPass apartment ID'sini getir
    public fun get_tenant_pass_apartment_id(pass: &TenantPass): ID {
        pass.apartment_id
    }

    /// TenantPass sahibini getir
    public fun get_tenant_pass_owner(pass: &TenantPass): address {
        pass.tenant
    }

    /// TenantPass bitiş tarihini getir
    /// Kiranın ödendiği son tarih
    public fun get_rent_paid_until(pass: &TenantPass): u64 {
        pass.rent_paid_until
    }

    /// Ev sahibinin adresi
    public fun get_tenant_pass_landlord(pass: &TenantPass): address {
        pass.landlord
    }

    public fun get_tenant_pass_expiry(pass: &TenantPass): u64 {
        pass.expiry_date
    }

    /// Talep durumu: 0 beklemede, 1 onaylandı, 2 reddedildi, 3 tamamlandı
    public fun get_request_status(request: &RentalRequest): u8 {
        request.status
    }

    /// Talebi yapan adres
    public fun get_request_requester(request: &RentalRequest): address {
        request.requester
    }

    /// Talebin ait olduğu daire
    public fun get_request_apartment_id(request: &RentalRequest): ID {
        request.apartment_id
    }

    /// Aktif kiralamanın bitiş tarihi
    public fun get_active_rental_expiry(registry: &RentalRegistry, apartment_id: ID): u64 {
        table::borrow(&registry.active_rentals, apartment_id).expiry_date
    }

    /// İlanın peşinat ay sayısı
    public fun get_listing_upfront_months(registry: &RentalRegistry, apartment_id: ID): u64 {
        table::borrow(&registry.listings, apartment_id).upfront_months
    }

    /// Kiralama listesi bilgilerini getir
    public fun get_listing_info(registry: &RentalRegistry, apartment_id: ID): (address, u64, bool) {
        let listing = table::borrow(&registry.listings, apartment_id);
        (listing.owner, listing.monthly_rent, listing.is_active)
    }

    /// Daire aktif olarak kiralanmış mı?
    public fun is_apartment_rented(registry: &RentalRegistry, apartment_id: ID): bool {
        table::contains(&registry.active_rentals, apartment_id)
    }

    // ==================== Test Only ====================
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
