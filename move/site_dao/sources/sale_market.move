// Modül D: Sale Market (Satış Pazarı)
// Daire NFT'lerinin komisyonsuz, emanet (escrow) üzerinden alınıp satılması
module site_dao::sale_market {
    use std::string::String;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};

    use site_dao::apartment::{Self, Apartment};
    use site_dao::rent_market::{Self, RentalRegistry};

    // ==================== Hatalar ====================
    const EInsufficientPayment: u64 = 0;
    const ENotSeller: u64 = 1;
    const EApartmentIsRented: u64 = 2;
    const EInvalidPrice: u64 = 3;

    // ==================== Struct'lar ====================

    /// Satılık ilan - Shared Object
    ///
    /// Daire ilan süresince bu nesnenin içinde emanette tutulur. Böylece alıcı,
    /// satıcının imzasına ihtiyaç duymadan tek işlemde ödemeyi yapıp daireyi alabilir.
    /// Sui'de sahipli nesneler yalnızca sahibinin işlemine girdi olabildiği için
    /// emanet olmadan atomik satış mümkün olmazdı.
    public struct SaleListing has key {
        id: UID,
        apartment: Apartment,     // Emanetteki daire
        seller: address,
        price: u64,               // MIST cinsinden
        apartment_block: String,  // Kolay erişim için kopyalanır
        apartment_flat: u64,
        created_at: u64
    }

    // ==================== Events ====================

    public struct ApartmentListedForSale has copy, drop {
        listing_id: ID,
        apartment_id: ID,
        seller: address,
        price: u64
    }

    public struct ApartmentSold has copy, drop {
        apartment_id: ID,
        seller: address,
        buyer: address,
        price: u64
    }

    public struct SaleListingCancelled has copy, drop {
        apartment_id: ID,
        seller: address
    }

    // ==================== Public Functions ====================

    /// Daireyi satışa çıkar - daire emanete alınır
    ///
    /// Kirada olan daire satışa çıkarılamaz; kiracının oturma hakkı devam ederken
    /// mülkiyetin el değiştirmesi TenantPass ile tutarsızlık yaratırdı.
    public entry fun list_for_sale(
        rental_registry: &RentalRegistry,
        apartment: Apartment,
        price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(price > 0, EInvalidPrice);

        let apartment_id = apartment::get_id(&apartment);
        assert!(!rent_market::is_apartment_rented(rental_registry, apartment_id), EApartmentIsRented);

        let (block, flat_number, _) = apartment::get_apartment_info(&apartment);
        let seller = ctx.sender();

        let listing = SaleListing {
            id: object::new(ctx),
            apartment,
            seller,
            price,
            apartment_block: block,
            apartment_flat: flat_number,
            created_at: clock::timestamp_ms(clock)
        };

        event::emit(ApartmentListedForSale {
            listing_id: object::id(&listing),
            apartment_id,
            seller,
            price
        });

        transfer::share_object(listing);
    }

    /// Daireyi satın al - ödeme satıcıya, daire alıcıya gider
    ///
    /// İlan nesnesi değer olarak alınır ve işlem sonunda yok edilir; satış atomiktir.
    public entry fun buy_apartment(
        listing: SaleListing,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let payment_amount = coin::value(&payment);

        let SaleListing {
            id,
            apartment,
            seller,
            price,
            apartment_block: _,
            apartment_flat: _,
            created_at: _
        } = listing;

        assert!(payment_amount >= price, EInsufficientPayment);

        let buyer = ctx.sender();

        event::emit(ApartmentSold {
            apartment_id: apartment::get_id(&apartment),
            seller,
            buyer,
            price
        });

        // Ödemeyi satıcıya, daireyi alıcıya aktar
        transfer::public_transfer(payment, seller);
        transfer::public_transfer(apartment, buyer);

        object::delete(id);
    }

    /// Satış ilanını iptal et - daire satıcıya geri döner
    public entry fun cancel_sale_listing(
        listing: SaleListing,
        ctx: &mut TxContext
    ) {
        let SaleListing {
            id,
            apartment,
            seller,
            price: _,
            apartment_block: _,
            apartment_flat: _,
            created_at: _
        } = listing;

        assert!(seller == ctx.sender(), ENotSeller);

        event::emit(SaleListingCancelled {
            apartment_id: apartment::get_id(&apartment),
            seller
        });

        transfer::public_transfer(apartment, seller);
        object::delete(id);
    }

    // ==================== View Functions ====================

    /// İlan bilgilerini getir: (daire ID, satıcı, fiyat, blok, daire no)
    public fun get_listing_info(listing: &SaleListing): (ID, address, u64, String, u64) {
        (
            apartment::get_id(&listing.apartment),
            listing.seller,
            listing.price,
            listing.apartment_block,
            listing.apartment_flat
        )
    }

    /// İlan fiyatı
    public fun get_price(listing: &SaleListing): u64 {
        listing.price
    }

    /// Satıcının adresi
    public fun get_seller(listing: &SaleListing): address {
        listing.seller
    }
}
