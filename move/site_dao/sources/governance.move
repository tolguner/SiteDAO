// Modül C: Governance (DAO & Hazine)
// Teklifler, oylama ve hazine yönetimi
module site_dao::governance {
    use std::string::String;
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::vec_set::{Self, VecSet};
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    
    use site_dao::apartment::{Self, Apartment};
    use site_dao::rent_market::{Self, TenantPass, RentalRegistry};

    // ==================== Hatalar ====================
    const EProposalNotActive: u64 = 2;
    const EAlreadyVoted: u64 = 3;
    const ENoVotingRight: u64 = 4;
    const EVotingNotEnded: u64 = 5;
    const EInsufficientTreasuryBalance: u64 = 7;
    const EProposalAlreadyExecuted: u64 = 8;
    const ETenantPassExpired: u64 = 9;
    const EApartmentIsRented: u64 = 10;
    const EInvalidAmount: u64 = 11;

    // ==================== Sabitler ====================
    const VOTING_PERIOD: u64 = 259_200_000; // 3 gün (milisaniye)

    // ==================== Struct'lar ====================
    
    /// Hazine - SUI coinleri tutar (Shared Object)
    public struct Treasury has key {
        id: UID,
        balance: Balance<SUI>,
        total_received: u64,
        total_spent: u64,
        routine_expense_count: u64
    }

    /// Governance Admin yetkisi
    public struct GovernanceAdminCap has key, store {
        id: UID
    }

    /// Harcama Teklifi
    public struct Proposal has key, store {
        id: UID,
        proposal_id: u64,            // Sıralı numara
        creator: address,             // Teklifi oluşturan
        ipfs_hash: String,            // Fatura/belge IPFS hash'i
        description: String,          // Açıklama
        amount: u64,                  // Talep edilen tutar (MIST)
        recipient: address,           // Alıcı cüzdan adresi
        yes_votes: u64,               // Evet oyları
        no_votes: u64,                // Hayır oyları
        voters: VecSet<address>,      // Oy kullananların adresleri
        voted_apartments: VecSet<ID>, // Oy kullanan daireler
        created_at: u64,              // Oluşturulma zamanı
        voting_ends_at: u64,          // Oylama bitiş zamanı
        is_executed: bool,            // Yürütüldü mü?
        is_active: bool               // Aktif mi?
    }

    /// Teklif Kayıt Defteri - Tüm teklifleri takip eder
    public struct ProposalRegistry has key {
        id: UID,
        proposal_count: u64,
        active_proposals: Table<u64, ID>, // proposal_id -> Proposal object ID
    }

    // ==================== Events ====================
    
    public struct TreasuryDeposit has copy, drop {
        amount: u64,
        depositor: address,
        new_balance: u64
    }

    public struct ProposalCreated has copy, drop {
        proposal_id: u64,
        creator: address,
        amount: u64,
        recipient: address,
        ipfs_hash: String,
        voting_ends_at: u64
    }

    public struct VoteCast has copy, drop {
        proposal_id: u64,
        voter: address,
        apartment_id: ID,
        vote: bool, // true = evet, false = hayır
        is_tenant: bool
    }

    public struct ProposalExecuted has copy, drop {
        proposal_id: u64,
        amount: u64,
        recipient: address,
        yes_votes: u64,
        no_votes: u64
    }

    public struct ProposalRejected has copy, drop {
        proposal_id: u64,
        yes_votes: u64,
        no_votes: u64
    }

    public struct RoutineExpenseRecorded has copy, drop {
        expense_id: u64,
        title: String,
        category: String,
        amount: u64,
        recipient: address,
        ipfs_hash: String,
        recorded_at: u64
    }

    // ==================== Init ====================
    
    fun init(ctx: &mut TxContext) {
        // Hazine oluştur
        let treasury = Treasury {
            id: object::new(ctx),
            balance: balance::zero(),
            total_received: 0,
            total_spent: 0,
            routine_expense_count: 0
        };
        transfer::share_object(treasury);

        // Governance Admin Cap
        let admin_cap = GovernanceAdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));

        // Teklif kayıt defteri
        let registry = ProposalRegistry {
            id: object::new(ctx),
            proposal_count: 0,
            active_proposals: table::new(ctx)
        };
        transfer::share_object(registry);
    }

    // ==================== Treasury Functions ====================
    
    /// Hazineye SUI yatır (aidat ödemeleri buraya gelir)
    public entry fun deposit_to_treasury(
        treasury: &mut Treasury,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        balance::join(&mut treasury.balance, coin::into_balance(payment));
        treasury.total_received = treasury.total_received + amount;

        event::emit(TreasuryDeposit {
            amount,
            depositor: tx_context::sender(ctx),
            new_balance: balance::value(&treasury.balance)
        });
    }

    /// Aidat öde - tutarı doğrular, daireyi günceller ve ödemeyi hazineye yatırır
    ///
    /// apartment::record_dues_payment yalnızca tarihi işler; ödemenin paylaşılan
    /// Treasury nesnesine gerçekten girmesi ve total_received sayacının artması
    /// bu fonksiyonla sağlanır.
    public entry fun pay_dues(
        treasury: &mut Treasury,
        apartment: &mut Apartment,
        payment: Coin<SUI>,
        months: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);

        // Tutar doğrulaması ve aidat tarihinin güncellenmesi
        apartment::record_dues_payment(apartment, amount, months, clock);

        // Ödemeyi hazineye yatır
        balance::join(&mut treasury.balance, coin::into_balance(payment));
        treasury.total_received = treasury.total_received + amount;

        event::emit(TreasuryDeposit {
            amount,
            depositor: tx_context::sender(ctx),
            new_balance: balance::value(&treasury.balance)
        });
    }

    /// Rutin gider kaydet ve hazineden öde - sadece admin
    ///
    /// Temizlik, elektrik, asansör bakımı gibi düzenli ve öngörülebilir giderler için;
    /// oylama gerektirmez. Fatura IPFS hash'i ile birlikte kaydedilir, böylece harcama
    /// zincir üzerinde belgeye bağlı ve denetlenebilir olur.
    public entry fun record_routine_expense(
        _admin: &GovernanceAdminCap,
        treasury: &mut Treasury,
        title: String,
        category: String,
        amount: u64,
        recipient: address,
        ipfs_hash: String,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(amount > 0, EInvalidAmount);
        assert!(balance::value(&treasury.balance) >= amount, EInsufficientTreasuryBalance);

        let expense_id = treasury.routine_expense_count + 1;
        treasury.routine_expense_count = expense_id;

        // Ödemeyi hazineden çıkar ve alıcıya gönder
        let payment = coin::from_balance(
            balance::split(&mut treasury.balance, amount),
            _ctx
        );
        transfer::public_transfer(payment, recipient);

        treasury.total_spent = treasury.total_spent + amount;

        event::emit(RoutineExpenseRecorded {
            expense_id,
            title,
            category,
            amount,
            recipient,
            ipfs_hash,
            recorded_at: clock::timestamp_ms(clock)
        });
    }

    // ==================== Proposal Functions ====================
    
    /// Yeni harcama teklifi oluştur - Sadece admin
    public entry fun create_proposal(
        _admin: &GovernanceAdminCap,
        registry: &mut ProposalRegistry,
        ipfs_hash: String,
        description: String,
        amount: u64,
        recipient: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let proposal_id = registry.proposal_count + 1;
        registry.proposal_count = proposal_id;

        let proposal = Proposal {
            id: object::new(ctx),
            proposal_id,
            creator: tx_context::sender(ctx),
            ipfs_hash,
            description,
            amount,
            recipient,
            yes_votes: 0,
            no_votes: 0,
            voters: vec_set::empty(),
            voted_apartments: vec_set::empty(),
            created_at: current_time,
            voting_ends_at: current_time + VOTING_PERIOD,
            is_executed: false,
            is_active: true
        };

        let proposal_object_id = object::id(&proposal);
        
        event::emit(ProposalCreated {
            proposal_id,
            creator: tx_context::sender(ctx),
            amount,
            recipient,
            ipfs_hash: proposal.ipfs_hash,
            voting_ends_at: proposal.voting_ends_at
        });

        table::add(&mut registry.active_proposals, proposal_id, proposal_object_id);
        transfer::share_object(proposal);
    }

    /// Kiracı olarak oy kullan (TenantPass ile)
    /// ÖNCELIK KURALI: Kiracı varsa, oy hakkı kiracının
    public entry fun vote_as_tenant(
        proposal: &mut Proposal,
        tenant_pass: &TenantPass,
        vote: bool, // true = evet, false = hayır
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        // Teklif aktif mi?
        assert!(proposal.is_active, EProposalNotActive);
        
        // Oylama süresi dolmamış mı?
        assert!(current_time < proposal.voting_ends_at, EVotingNotEnded);
        
        // TenantPass geçerli mi?
        assert!(rent_market::is_tenant_pass_valid(tenant_pass, clock), ETenantPassExpired);
        
        // TenantPass sahibi mi?
        let voter = tx_context::sender(ctx);
        assert!(rent_market::get_tenant_pass_owner(tenant_pass) == voter, ENoVotingRight);
        
        let apartment_id = rent_market::get_tenant_pass_apartment_id(tenant_pass);
        
        // Bu daire zaten oy kullanmış mı?
        assert!(!vec_set::contains(&proposal.voted_apartments, &apartment_id), EAlreadyVoted);
        
        // Oy kaydet
        vec_set::insert(&mut proposal.voters, voter);
        vec_set::insert(&mut proposal.voted_apartments, apartment_id);
        
        if (vote) {
            proposal.yes_votes = proposal.yes_votes + 1;
        } else {
            proposal.no_votes = proposal.no_votes + 1;
        };

        event::emit(VoteCast {
            proposal_id: proposal.proposal_id,
            voter,
            apartment_id,
            vote,
            is_tenant: true
        });
    }

    /// Ev sahibi olarak oy kullan (Apartment ile)
    /// ÖNCELIK KURALI: Daire kiradaysa oy hakkı kiracınındır, ev sahibi oy kullanamaz.
    /// Kiralama durumu RentalRegistry'den okunur; bu yüzden registry parametre olarak alınır.
    public entry fun vote_as_owner(
        proposal: &mut Proposal,
        registry: &RentalRegistry,
        apartment: &Apartment,
        vote: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        vote_as_owner_internal(proposal, registry, apartment, vote, clock, ctx);
    }

    /// Kiosk'ta kilitli daire için ev sahibi oyu
    ///
    /// Daire kiraya çıkarıldığında Kiosk'a kilitlenir; bu durumda ev sahibi Apartment
    /// nesnesini doğrudan geçiremez. KioskOwnerCap ile ödünç alıp oy kullanır.
    public entry fun vote_as_owner_in_kiosk(
        proposal: &mut Proposal,
        registry: &RentalRegistry,
        kiosk: &Kiosk,
        kiosk_cap: &KioskOwnerCap,
        apartment_id_bytes: address,
        vote: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let apartment_id = object::id_from_address(apartment_id_bytes);
        let apartment = kiosk::borrow<Apartment>(kiosk, kiosk_cap, apartment_id);

        vote_as_owner_internal(proposal, registry, apartment, vote, clock, ctx);
    }

    /// Ev sahibi oyunun ortak mantığı
    fun vote_as_owner_internal(
        proposal: &mut Proposal,
        registry: &RentalRegistry,
        apartment: &Apartment,
        vote: bool,
        clock: &Clock,
        ctx: &TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);

        assert!(proposal.is_active, EProposalNotActive);
        assert!(current_time < proposal.voting_ends_at, EVotingNotEnded);

        let voter = tx_context::sender(ctx);
        let apartment_id = apartment::get_id(apartment);
        
        // Daire kiradaysa oy hakkı kiracıya geçmiştir
        assert!(!rent_market::is_apartment_rented(registry, apartment_id), EApartmentIsRented);
        
        // Bu daire zaten oy kullanmış mı? (kiracı olarak)
        assert!(!vec_set::contains(&proposal.voted_apartments, &apartment_id), EAlreadyVoted);
        
        // Oy kaydet
        vec_set::insert(&mut proposal.voters, voter);
        vec_set::insert(&mut proposal.voted_apartments, apartment_id);
        
        if (vote) {
            proposal.yes_votes = proposal.yes_votes + 1;
        } else {
            proposal.no_votes = proposal.no_votes + 1;
        };

        event::emit(VoteCast {
            proposal_id: proposal.proposal_id,
            voter,
            apartment_id,
            vote,
            is_tenant: false
        });
    }

    /// Teklifi yürüt - Oylama bittiyse ve çoğunluk evet ise
    public entry fun execute_proposal(
        proposal: &mut Proposal,
        treasury: &mut Treasury,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        // Oylama süresi dolmuş mu?
        assert!(current_time >= proposal.voting_ends_at, EVotingNotEnded);
        
        // Zaten yürütülmüş mü?
        assert!(!proposal.is_executed, EProposalAlreadyExecuted);
        
        // Teklif aktif mi?
        assert!(proposal.is_active, EProposalNotActive);
        
        // Evet oyları > Hayır oyları mı?
        if (proposal.yes_votes > proposal.no_votes) {
            // Hazinede yeterli bakiye var mı?
            assert!(balance::value(&treasury.balance) >= proposal.amount, EInsufficientTreasuryBalance);
            
            // Parayı transfer et
            let payment = coin::from_balance(
                balance::split(&mut treasury.balance, proposal.amount),
                ctx
            );
            transfer::public_transfer(payment, proposal.recipient);
            
            treasury.total_spent = treasury.total_spent + proposal.amount;
            proposal.is_executed = true;
            proposal.is_active = false;

            event::emit(ProposalExecuted {
                proposal_id: proposal.proposal_id,
                amount: proposal.amount,
                recipient: proposal.recipient,
                yes_votes: proposal.yes_votes,
                no_votes: proposal.no_votes
            });
        } else {
            // Teklif reddedildi
            proposal.is_active = false;
            
            event::emit(ProposalRejected {
                proposal_id: proposal.proposal_id,
                yes_votes: proposal.yes_votes,
                no_votes: proposal.no_votes
            });
        }
    }

    // ==================== View Functions ====================
    
    /// Hazine bakiyesini getir
    public fun get_treasury_balance(treasury: &Treasury): u64 {
        balance::value(&treasury.balance)
    }

    /// Hazine istatistiklerini getir
    public fun get_treasury_stats(treasury: &Treasury): (u64, u64, u64) {
        (
            balance::value(&treasury.balance),
            treasury.total_received,
            treasury.total_spent
        )
    }

    /// Teklif bilgilerini getir
    public fun get_proposal_info(proposal: &Proposal): (u64, String, u64, address, u64, u64, bool, bool) {
        (
            proposal.proposal_id,
            proposal.ipfs_hash,
            proposal.amount,
            proposal.recipient,
            proposal.yes_votes,
            proposal.no_votes,
            proposal.is_executed,
            proposal.is_active
        )
    }

    /// Teklif oylama durumunu getir
    public fun get_proposal_voting_status(proposal: &Proposal, clock: &Clock): (bool, u64, u64, u64) {
        let current_time = clock::timestamp_ms(clock);
        let is_voting_open = current_time < proposal.voting_ends_at && proposal.is_active;
        let time_remaining = if (current_time < proposal.voting_ends_at) {
            proposal.voting_ends_at - current_time
        } else {
            0
        };
        
        (is_voting_open, proposal.yes_votes, proposal.no_votes, time_remaining)
    }

    /// Kullanıcı oy kullanmış mı?
    public fun has_voted(proposal: &Proposal, voter: address): bool {
        vec_set::contains(&proposal.voters, &voter)
    }

    /// Daire oy kullanmış mı?
    public fun has_apartment_voted(proposal: &Proposal, apartment_id: ID): bool {
        vec_set::contains(&proposal.voted_apartments, &apartment_id)
    }

    /// Toplam teklif sayısı
    public fun get_proposal_count(registry: &ProposalRegistry): u64 {
        registry.proposal_count
    }

    /// Kaydedilen rutin gider sayısı
    public fun get_routine_expense_count(treasury: &Treasury): u64 {
        treasury.routine_expense_count
    }

    // ==================== Test Only ====================
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
