// SiteDAO Test Modülü
#[test_only]
module site_dao::site_dao_tests {
    use std::string;
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock;
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use sui::package::Publisher;
    use sui::transfer_policy::TransferPolicy;

    use site_dao::apartment::{Self, Apartment, AdminCap};
    use site_dao::rent_market::{Self, RentalRegistry, TenantPass, RentalRequest};
    use site_dao::governance::{Self, Treasury, GovernanceAdminCap, Proposal, ProposalRegistry};
    use site_dao::sale_market::{Self, SaleListing};

    // Test adresleri
    const ADMIN: address = @0xAD;
    const OWNER1: address = @0x1;
    const TENANT1: address = @0x2;
    const BUYER1: address = @0x3;

    // ==================== Helper Functions ====================

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN);
        {
            apartment::init_for_testing(ts::ctx(&mut scenario));
            rent_market::init_for_testing(ts::ctx(&mut scenario));
            governance::init_for_testing(ts::ctx(&mut scenario));
        };

        // Kiosk kilidi icin Apartment TransferPolicy'si gerekiyor
        ts::next_tx(&mut scenario, ADMIN);
        {
            let publisher = ts::take_from_sender<Publisher>(&scenario);
            apartment::create_transfer_policy(&publisher, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, publisher);
        };

        scenario
    }

    /// ADMIN olarak OWNER1 adına bir daire mint eder
    fun mint_apartment_for_owner1(scenario: &mut Scenario) {
        ts::next_tx(scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(scenario);
            apartment::mint_apartment(
                &admin_cap,
                string::utf8(b"A Blok"),
                101,
                OWNER1,
                ts::ctx(scenario)
            );
            ts::return_to_sender(scenario, admin_cap);
        };
    }

    /// ADMIN olarak bir harcama teklifi oluşturur
    fun create_test_proposal(scenario: &mut Scenario) {
        ts::next_tx(scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(scenario));
            let gov_cap = ts::take_from_sender<GovernanceAdminCap>(scenario);
            let mut registry = ts::take_shared<ProposalRegistry>(scenario);

            governance::create_proposal(
                &gov_cap,
                &mut registry,
                string::utf8(b""),
                string::utf8(b"Asansor bakimi"),
                500_000_000,
                ADMIN,
                &clock,
                ts::ctx(scenario)
            );

            ts::return_to_sender(scenario, gov_cap);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };
    }

    /// OWNER1 elindeki dairenin object ID adresini döndürür
    fun owner1_apartment_address(scenario: &mut Scenario): address {
        ts::next_tx(scenario, OWNER1);
        let apt = ts::take_from_sender<Apartment>(scenario);
        let id_addr = object::id_address(&apt);
        ts::return_to_sender(scenario, apt);
        id_addr
    }

    // ==================== Apartment Tests ====================

    #[test]
    fun test_mint_apartment() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);

        // Owner1 daireyi alır
        ts::next_tx(&mut scenario, OWNER1);
        {
            let apartment = ts::take_from_sender<Apartment>(&scenario);
            let (block, flat, dues) = apartment::get_apartment_info(&apartment);
            assert!(block == string::utf8(b"A Blok"), 0);
            assert!(flat == 101, 1);
            assert!(dues == 0, 2);
            ts::return_to_sender(&scenario, apartment);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_treasury_deposit() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, OWNER1);
        {
            let mut treasury = ts::take_shared<Treasury>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));

            governance::deposit_to_treasury(&mut treasury, payment, ts::ctx(&mut scenario));

            assert!(governance::get_treasury_balance(&treasury) == 1_000_000_000, 0);
            ts::return_shared(treasury);
        };

        ts::end(scenario);
    }

    // ==================== Aidat Testleri ====================

    /// Aidat ödemesi paylaşılan hazineye gerçekten girmeli ve total_received artmalı.
    /// Eskiden pay_dues ödemeyi bir adrese gönderiyordu, hazine sayacı hiç artmıyordu.
    #[test]
    fun test_pay_dues_hazineye_girer() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000);

            let mut treasury = ts::take_shared<Treasury>(&scenario);
            let mut apt = ts::take_from_sender<Apartment>(&scenario);

            // 3 aylik aidat: 3 * 0.1 SUI
            let payment = coin::mint_for_testing<SUI>(300_000_000, ts::ctx(&mut scenario));
            governance::pay_dues(&mut treasury, &mut apt, payment, 3, &clock, ts::ctx(&mut scenario));

            let (balance, received, spent) = governance::get_treasury_stats(&treasury);
            assert!(balance == 300_000_000, 0);
            assert!(received == 300_000_000, 1);
            assert!(spent == 0, 2);

            // Aidat tarihi cagirandan degil Clock'tan okunmali: 1_000 + 3 * 30 gun
            assert!(apartment::get_dues_paid_until(&apt) == 1_000 + 3 * 2_592_000_000, 3);

            ts::return_to_sender(&scenario, apt);
            ts::return_shared(treasury);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Eksik tutarla aidat ödenememeli
    #[test]
    #[expected_failure(abort_code = apartment::EInsufficientPayment)]
    fun test_eksik_aidat_reddedilir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut treasury = ts::take_shared<Treasury>(&scenario);
            let mut apt = ts::take_from_sender<Apartment>(&scenario);

            // 3 ay isteniyor ama 1 aylik tutar gonderiliyor
            let payment = coin::mint_for_testing<SUI>(100_000_000, ts::ctx(&mut scenario));
            governance::pay_dues(&mut treasury, &mut apt, payment, 3, &clock, ts::ctx(&mut scenario));

            ts::return_to_sender(&scenario, apt);
            ts::return_shared(treasury);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Oylama Önceliği Testleri ====================

    /// Daire kirada değilken ev sahibi oy kullanabilmeli
    #[test]
    fun test_ev_sahibi_kirada_degilken_oy_kullanir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        create_test_proposal(&mut scenario);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut proposal = ts::take_shared<Proposal>(&scenario);
            let apt = ts::take_from_sender<Apartment>(&scenario);

            governance::vote_as_owner(&mut proposal, &registry, &apt, true, &clock, ts::ctx(&mut scenario));

            let (_id, _hash, _amount, _recipient, yes, no, _executed, _active) =
                governance::get_proposal_info(&proposal);
            assert!(yes == 1, 0);
            assert!(no == 0, 1);

            ts::return_to_sender(&scenario, apt);
            ts::return_shared(proposal);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Daire kiradayken ev sahibi oy kullanamamalı; oy hakkı kiracıya geçer.
    /// Eskiden vote_as_owner kiralama durumunu hiç kontrol etmiyordu.
    #[test]
    #[expected_failure(abort_code = governance::EApartmentIsRented)]
    fun test_kiradaki_daire_icin_ev_sahibi_oy_kullanamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        create_test_proposal(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);

        // Admin daireyi kiraya verilmiş olarak kaydeder
        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            rent_market::admin_create_tenant_pass(
                &admin_cap,
                &mut registry,
                apartment_id,
                string::utf8(b"A Blok"),
                101,
                TENANT1,
                OWNER1,
                12,
                1_000_000_000,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, OWNER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut proposal = ts::take_shared<Proposal>(&scenario);
            let apt = ts::take_from_sender<Apartment>(&scenario);

            governance::vote_as_owner(&mut proposal, &registry, &apt, true, &clock, ts::ctx(&mut scenario));

            ts::return_to_sender(&scenario, apt);
            ts::return_shared(proposal);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Kiracı geçerli TenantPass ile oy kullanabilmeli
    #[test]
    fun test_kiraci_tenantpass_ile_oy_kullanir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        create_test_proposal(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            rent_market::admin_create_tenant_pass(
                &admin_cap,
                &mut registry,
                apartment_id,
                string::utf8(b"A Blok"),
                101,
                TENANT1,
                OWNER1,
                12,
                1_000_000_000,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut proposal = ts::take_shared<Proposal>(&scenario);
            let pass = ts::take_from_sender<TenantPass>(&scenario);

            governance::vote_as_tenant(&mut proposal, &pass, false, &clock, ts::ctx(&mut scenario));

            let (_id, _hash, _amount, _recipient, yes, no, _executed, _active) =
                governance::get_proposal_info(&proposal);
            assert!(yes == 0, 0);
            assert!(no == 1, 1);

            ts::return_to_sender(&scenario, pass);
            ts::return_shared(proposal);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Kiralama Testleri ====================

    /// OWNER1 dairesini kiraya çıkarır. Daire Kiosk'a kilitlenir.
    fun list_owner1_apartment_for_rent(scenario: &mut Scenario, monthly_rent: u64) {
        ts::next_tx(scenario, OWNER1);
        {
            let mut registry = ts::take_shared<RentalRegistry>(scenario);
            let policy = ts::take_shared<TransferPolicy<Apartment>>(scenario);
            let apt = ts::take_from_sender<Apartment>(scenario);
            let (mut kiosk_obj, kiosk_cap) = kiosk::new(ts::ctx(scenario));

            rent_market::list_for_rent(
                &mut registry,
                &mut kiosk_obj,
                &kiosk_cap,
                &policy,
                apt,
                monthly_rent,
                1,
                1,
                12,
                ts::ctx(scenario)
            );

            ts::return_shared(registry);
            ts::return_shared(policy);
            transfer::public_share_object(kiosk_obj);
            transfer::public_transfer(kiosk_cap, OWNER1);
        };
    }

    /// TENANT1 kiralama talebi olusturur, OWNER1 onaylar
    fun request_and_approve(scenario: &mut Scenario, apartment_id: address, months: u64) {
        ts::next_tx(scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(scenario));
            let registry = ts::take_shared<RentalRegistry>(scenario);

            rent_market::request_rental(&registry, apartment_id, months, &clock, ts::ctx(scenario));

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(scenario, OWNER1);
        {
            let mut request = ts::take_shared<RentalRequest>(scenario);
            rent_market::approve_rental_request(&mut request, ts::ctx(scenario));
            ts::return_shared(request);
        };
    }

    /// Kiracı, ev sahibinin Apartment nesnesine erişmeden daireyi kiralayabilmeli.
    /// Eskiden rent_apartment bir &Apartment istiyordu; Sui'de sahipli nesne yalnızca
    /// sahibinin işlemine girdi olabildiği için kiracı bu fonksiyonu hiç çağıramıyordu.
    #[test]
    fun test_kiraci_apartment_nesnesi_olmadan_kiralar() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 5_000);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            // Pesinat 1 ay; kiralama 6 ay surecek
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            rent_market::rent_apartment(
                &mut registry,
                &mut request,
                payment,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_shared(request);

            assert!(
                rent_market::is_apartment_rented(&registry, object::id_from_address(apartment_id)),
                0
            );

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // Kiraci soulbound TenantPass almis olmali
        ts::next_tx(&mut scenario, TENANT1);
        {
            let pass = ts::take_from_sender<TenantPass>(&scenario);
            assert!(rent_market::get_tenant_pass_owner(&pass) == TENANT1, 1);
            assert!(rent_market::get_tenant_pass_landlord(&pass) == OWNER1, 2);
            assert!(rent_market::get_tenant_pass_expiry(&pass) == 5_000 + 6 * 2_592_000_000, 3);
            // Yalnizca pesinat kadar kira odenmis sayilmali
            assert!(rent_market::get_rent_paid_until(&pass) == 5_000 + 1 * 2_592_000_000, 4);
            ts::return_to_sender(&scenario, pass);
        };

        ts::end(scenario);
    }

    /// İlanda belirtilen süre aralığı dışında talep oluşturulamamalı
    #[test]
    #[expected_failure(abort_code = rent_market::EInvalidDuration)]
    fun test_ilan_araligi_disinda_kiralanamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);

            // Ilan en fazla 12 ay, 24 ay isteniyor
            rent_market::request_rental(&registry, apartment_id, 24, &clock, ts::ctx(&mut scenario));

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Kirada olan daire için yeni kiralama talebi açılamamalı
    #[test]
    #[expected_failure(abort_code = rent_market::EApartmentAlreadyRented)]
    fun test_kirali_daire_tekrar_kiralanamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));

            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));

            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // Ikinci kiraci ayni daire icin talep acmaya calisir
        ts::next_tx(&mut scenario, BUYER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);

            rent_market::request_rental(&registry, apartment_id, 6, &clock, ts::ctx(&mut scenario));

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Kira Ödeme Testleri ====================

    /// Kira ödemesi rent_paid_until tarihini ilerletmeli
    #[test]
    fun test_kira_odemesi_tarihi_ilerletir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        // Kiraci 6 aylik kiralar, pesinat 1 ay
        ts::next_tx(&mut scenario, TENANT1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));
            ts::return_shared(request);

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // 2 ay daha kira oder
        ts::next_tx(&mut scenario, TENANT1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000);
            let mut pass = ts::take_from_sender<TenantPass>(&scenario);

            let before = rent_market::get_rent_paid_until(&pass);
            assert!(before == 1_000 + 1 * 2_592_000_000, 0);

            let payment = coin::mint_for_testing<SUI>(2_000_000_000, ts::ctx(&mut scenario));
            rent_market::pay_rent(&mut pass, payment, 2, &clock, ts::ctx(&mut scenario));

            // Odenen tarih 2 ay ilerlemeli
            assert!(rent_market::get_rent_paid_until(&pass) == before + 2 * 2_592_000_000, 1);

            ts::return_to_sender(&scenario, pass);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Eksik tutarla kira ödenememeli
    #[test]
    #[expected_failure(abort_code = rent_market::EInsufficientPayment)]
    fun test_eksik_kira_odenemez() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));
            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut pass = ts::take_from_sender<TenantPass>(&scenario);

            // 2 ay isteniyor ama 1 aylik tutar gonderiliyor
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            rent_market::pay_rent(&mut pass, payment, 2, &clock, ts::ctx(&mut scenario));

            ts::return_to_sender(&scenario, pass);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Kirası sonuna kadar ödenmiş sözleşmeye tekrar kira ödenememeli
    #[test]
    #[expected_failure(abort_code = rent_market::ERentAlreadyPaid)]
    fun test_fazladan_kira_odenemez() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000);
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            rent_market::admin_create_tenant_pass(
                &admin_cap,
                &mut registry,
                apartment_id,
                string::utf8(b"A Blok"),
                101,
                TENANT1,
                OWNER1,
                12,
                1_000_000_000,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, TENANT1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 2_000);
            let mut pass = ts::take_from_sender<TenantPass>(&scenario);

            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            rent_market::pay_rent(&mut pass, payment, 1, &clock, ts::ctx(&mut scenario));

            ts::return_to_sender(&scenario, pass);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Satış Testleri ====================

    /// Daire satışa çıkarılıp alıcı tarafından tek işlemde satın alınabilmeli
    #[test]
    fun test_daire_satilir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            let apt = ts::take_from_sender<Apartment>(&scenario);

            sale_market::list_for_sale(&registry, apt, 50_000_000_000, &clock, ts::ctx(&mut scenario));

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, BUYER1);
        {
            let listing = ts::take_shared<SaleListing>(&scenario);
            assert!(sale_market::get_price(&listing) == 50_000_000_000, 0);
            assert!(sale_market::get_seller(&listing) == OWNER1, 1);

            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            sale_market::buy_apartment(listing, payment, ts::ctx(&mut scenario));
        };

        // Daire artik alicinin
        ts::next_tx(&mut scenario, BUYER1);
        {
            let apt = ts::take_from_sender<Apartment>(&scenario);
            assert!(object::id_address(&apt) == apartment_id, 2);
            ts::return_to_sender(&scenario, apt);
        };

        ts::end(scenario);
    }

    /// Eksik ödemeyle daire satın alınamamalı
    #[test]
    #[expected_failure(abort_code = sale_market::EInsufficientPayment)]
    fun test_eksik_odemeyle_daire_alinamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            let apt = ts::take_from_sender<Apartment>(&scenario);
            sale_market::list_for_sale(&registry, apt, 50_000_000_000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, BUYER1);
        {
            let listing = ts::take_shared<SaleListing>(&scenario);
            let payment = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));
            sale_market::buy_apartment(listing, payment, ts::ctx(&mut scenario));
        };

        ts::end(scenario);
    }

    /// Kirada olan daire satışa çıkarılamamalı
    ///
    /// Kiraya çıkarılan daire zaten Kiosk'ta kilitli olduğu için sahibinin elinde
    /// bulunmaz; bu test sale_market'in RentalRegistry kontrolünü, kilit dışında
    /// oluşturulmuş bir kiralama kaydı üzerinden doğrular.
    #[test]
    #[expected_failure(abort_code = sale_market::EApartmentIsRented)]
    fun test_kiradaki_daire_satisa_cikarilamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            rent_market::admin_create_tenant_pass(
                &admin_cap,
                &mut registry,
                apartment_id,
                string::utf8(b"A Blok"),
                101,
                TENANT1,
                OWNER1,
                12,
                1_000_000_000,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, OWNER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            let apt = ts::take_from_sender<Apartment>(&scenario);

            sale_market::list_for_sale(&registry, apt, 50_000_000_000, &clock, ts::ctx(&mut scenario));

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Rutin Gider Testleri ====================

    /// Rutin gider hazineden düşmeli ve total_spent artmalı
    #[test]
    fun test_rutin_gider_hazineden_dusulur() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, OWNER1);
        {
            let mut treasury = ts::take_shared<Treasury>(&scenario);
            let payment = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));
            governance::deposit_to_treasury(&mut treasury, payment, ts::ctx(&mut scenario));
            ts::return_shared(treasury);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let gov_cap = ts::take_from_sender<GovernanceAdminCap>(&scenario);
            let mut treasury = ts::take_shared<Treasury>(&scenario);

            governance::record_routine_expense(
                &gov_cap,
                &mut treasury,
                string::utf8(b"Asansor bakimi"),
                string::utf8(b"maintenance"),
                2_000_000_000,
                BUYER1,
                string::utf8(b"QmFatura123"),
                &clock,
                ts::ctx(&mut scenario)
            );

            let (balance, received, spent) = governance::get_treasury_stats(&treasury);
            assert!(balance == 8_000_000_000, 0);
            assert!(received == 10_000_000_000, 1);
            assert!(spent == 2_000_000_000, 2);
            assert!(governance::get_routine_expense_count(&treasury) == 1, 3);

            ts::return_to_sender(&scenario, gov_cap);
            ts::return_shared(treasury);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Hazine bakiyesi yetmezse rutin gider kaydedilememeli
    #[test]
    #[expected_failure(abort_code = governance::EInsufficientTreasuryBalance)]
    fun test_yetersiz_hazineyle_gider_kaydedilemez() {
        let mut scenario = setup_test();

        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let gov_cap = ts::take_from_sender<GovernanceAdminCap>(&scenario);
            let mut treasury = ts::take_shared<Treasury>(&scenario);

            governance::record_routine_expense(
                &gov_cap,
                &mut treasury,
                string::utf8(b"Temizlik"),
                string::utf8(b"cleaning"),
                1_000_000_000,
                BUYER1,
                string::utf8(b""),
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, gov_cap);
            ts::return_shared(treasury);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Kiralama Talebi Testleri ====================

    /// Onaylanmamış talep ile kiralama tamamlanamamalı
    #[test]
    #[expected_failure(abort_code = rent_market::EInvalidRequestStatus)]
    fun test_onaysiz_talep_ile_kiralanamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);

        // Talep olusturulur ama ONAYLANMAZ
        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            rent_market::request_rental(&registry, apartment_id, 6, &clock, ts::ctx(&mut scenario));
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));

            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));

            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// İlan sahibi olmayan biri talebi onaylayamamalı
    #[test]
    #[expected_failure(abort_code = rent_market::ENotListingOwner)]
    fun test_ilan_sahibi_olmayan_talebi_onaylayamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            rent_market::request_rental(&registry, apartment_id, 6, &clock, ts::ctx(&mut scenario));
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // BUYER1 ilan sahibi degil
        ts::next_tx(&mut scenario, BUYER1);
        {
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            rent_market::approve_rental_request(&mut request, ts::ctx(&mut scenario));
            ts::return_shared(request);
        };

        ts::end(scenario);
    }

    /// Reddedilen talep ile kiralama tamamlanamamalı
    #[test]
    #[expected_failure(abort_code = rent_market::EInvalidRequestStatus)]
    fun test_reddedilen_talep_ile_kiralanamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            rent_market::request_rental(&registry, apartment_id, 6, &clock, ts::ctx(&mut scenario));
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, OWNER1);
        {
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            rent_market::reject_rental_request(&mut request, ts::ctx(&mut scenario));
            assert!(rent_market::get_request_status(&request) == 2, 0);
            ts::return_shared(request);
        };

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));

            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));

            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Aynı onaylı talep ikinci kez kullanılamamalı
    #[test]
    #[expected_failure(abort_code = rent_market::EInvalidRequestStatus)]
    fun test_ayni_talep_iki_kez_kullanilamaz() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));
            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // Tamamlanmis talep tekrar kullanilmaya calisilir
        ts::next_tx(&mut scenario, TENANT1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));
            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Kiosk Testleri ====================

    /// Kiraya çıkarılan daire gerçekten Kiosk'a kilitlenmeli
    #[test]
    fun test_daire_kiosk_a_kilitlenir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let kiosk_obj = ts::take_shared<Kiosk>(&scenario);
            let item_id = object::id_from_address(apartment_id);

            // Daire Kiosk'ta ve kilitli olmali
            assert!(kiosk::has_item(&kiosk_obj, item_id), 0);
            assert!(kiosk::is_locked(&kiosk_obj, item_id), 1);

            ts::return_shared(kiosk_obj);
        };

        ts::end(scenario);
    }

    /// İlan iptal edilince kilitli daire ev sahibine geri dönmeli
    #[test]
    fun test_ilan_iptalinde_daire_geri_doner() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let policy = ts::take_shared<TransferPolicy<Apartment>>(&scenario);
            let mut kiosk_obj = ts::take_shared<Kiosk>(&scenario);
            let kiosk_cap = ts::take_from_sender<KioskOwnerCap>(&scenario);

            rent_market::cancel_listing(
                &mut registry,
                &mut kiosk_obj,
                &kiosk_cap,
                &policy,
                apartment_id,
                ts::ctx(&mut scenario)
            );

            // Daire artik Kiosk'ta olmamali
            assert!(!kiosk::has_item(&kiosk_obj, object::id_from_address(apartment_id)), 0);

            ts::return_to_sender(&scenario, kiosk_cap);
            ts::return_shared(kiosk_obj);
            ts::return_shared(policy);
            ts::return_shared(registry);
        };

        // Daire ev sahibinin cuzdanina donmus olmali
        ts::next_tx(&mut scenario, OWNER1);
        {
            let apt = ts::take_from_sender<Apartment>(&scenario);
            assert!(object::id_address(&apt) == apartment_id, 1);
            ts::return_to_sender(&scenario, apt);
        };

        ts::end(scenario);
    }

    /// Kiosk'ta kilitli daire için ev sahibi oy kullanabilmeli
    #[test]
    fun test_kioskta_kilitli_daire_icin_oy_kullanilir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        create_test_proposal(&mut scenario);

        ts::next_tx(&mut scenario, OWNER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut proposal = ts::take_shared<Proposal>(&scenario);
            let kiosk_obj = ts::take_shared<Kiosk>(&scenario);
            let kiosk_cap = ts::take_from_sender<KioskOwnerCap>(&scenario);

            governance::vote_as_owner_in_kiosk(
                &mut proposal,
                &registry,
                &kiosk_obj,
                &kiosk_cap,
                apartment_id,
                true,
                &clock,
                ts::ctx(&mut scenario)
            );

            let (_id, _hash, _amount, _recipient, yes, no, _executed, _active) =
                governance::get_proposal_info(&proposal);
            assert!(yes == 1, 0);
            assert!(no == 0, 1);

            ts::return_to_sender(&scenario, kiosk_cap);
            ts::return_shared(kiosk_obj);
            ts::return_shared(proposal);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    // ==================== Süresi Dolan Kiralama Testleri ====================

    /// Süresi dolmuş kiralamayı kiracı olmayan biri de kayıttan düşürebilmeli
    ///
    /// TenantPass soulbound olduğu için yalnızca kiracı yakabilir; kiracı bunu yapmazsa
    /// daire sonsuza dek kirada görünürdü.
    #[test]
    fun test_suresi_dolan_kiralama_herkesce_dusurulur() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));
            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // BUYER1 ne kiraci ne ev sahibi; yine de suresi dolmus kaydi temizleyebilmeli
        ts::next_tx(&mut scenario, BUYER1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            // 6 ay + 1 ms sonrasi
            clock::set_for_testing(&mut clock, 1_000 + 6 * 2_592_000_000 + 1);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            let id = object::id_from_address(apartment_id);
            assert!(rent_market::is_apartment_rented(&registry, id), 0);

            rent_market::release_expired_rental(
                &mut registry,
                apartment_id,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Daire artik kirada gorunmemeli, ilan yeniden aktif olmali
            assert!(!rent_market::is_apartment_rented(&registry, id), 1);
            let (_owner, _rent, is_active) = rent_market::get_listing_info(&registry, id);
            assert!(is_active, 2);

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Süresi dolmamış kiralama kayıttan düşürülememeli
    #[test]
    #[expected_failure(abort_code = rent_market::ETenantPassNotExpired)]
    fun test_suresi_dolmayan_kiralama_dusurulemez() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));
            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // Kira daha bitmedi
        ts::next_tx(&mut scenario, BUYER1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000 + 2_592_000_000);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);

            rent_market::release_expired_rental(
                &mut registry,
                apartment_id,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    /// Kiralama düşürüldükten sonra ev sahibi ilanı iptal edip daireyi geri alabilmeli
    ///
    /// Düzeltmeden önce daire Kiosk'ta kilitli kalıyordu: cancel_listing aktif kiralama
    /// yüzünden reddediliyor, kiracı da kartı yakmadığı için kayıt hiç temizlenmiyordu.
    #[test]
    fun test_dusurulen_kiralamadan_sonra_daire_geri_alinir() {
        let mut scenario = setup_test();

        mint_apartment_for_owner1(&mut scenario);
        let apartment_id = owner1_apartment_address(&mut scenario);
        list_owner1_apartment_for_rent(&mut scenario, 1_000_000_000);
        request_and_approve(&mut scenario, apartment_id, 6);

        ts::next_tx(&mut scenario, TENANT1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let mut request = ts::take_shared<RentalRequest>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            rent_market::rent_apartment(&mut registry, &mut request, payment, &clock, ts::ctx(&mut scenario));
            ts::return_shared(request);
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // Kiraci ortadan kayboldu, kartini yakmadi; ev sahibi kaydi kendisi dusuruyor
        ts::next_tx(&mut scenario, OWNER1);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000 + 6 * 2_592_000_000 + 1);
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            rent_market::release_expired_rental(&mut registry, apartment_id, &clock, ts::ctx(&mut scenario));
            ts::return_shared(registry);
            clock::destroy_for_testing(clock);
        };

        // Artik ilan iptal edilip daire Kiosk'tan geri alinabilir
        ts::next_tx(&mut scenario, OWNER1);
        {
            let mut registry = ts::take_shared<RentalRegistry>(&scenario);
            let policy = ts::take_shared<TransferPolicy<Apartment>>(&scenario);
            let mut kiosk_obj = ts::take_shared<Kiosk>(&scenario);
            let kiosk_cap = ts::take_from_sender<KioskOwnerCap>(&scenario);

            rent_market::cancel_listing(
                &mut registry,
                &mut kiosk_obj,
                &kiosk_cap,
                &policy,
                apartment_id,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, kiosk_cap);
            ts::return_shared(kiosk_obj);
            ts::return_shared(policy);
            ts::return_shared(registry);
        };

        ts::next_tx(&mut scenario, OWNER1);
        {
            let apt = ts::take_from_sender<Apartment>(&scenario);
            assert!(object::id_address(&apt) == apartment_id, 0);
            ts::return_to_sender(&scenario, apt);
        };

        ts::end(scenario);
    }
}
