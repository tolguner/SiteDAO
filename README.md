# SiteDAO - Merkeziyetsiz Site Yönetim Platformu

Apartman ve site yönetimlerindeki şeffaflık sorununu ele alan, Sui blokzinciri üzerinde
çalışan bir merkeziyetsiz uygulama (dApp) prototipi. Daire sahipliği NFT ile, kiracılık
devredilemez bir kartla, ortak harcamalar da oylamaya açılan tekliflerle temsil edilir.

*Blok Zinciri ve Kripto Para Teknolojileri* dersi dönem projesi olarak geliştirilmiştir.
Proje tanıtım sunumu: [`docs/SiteDAO-sunum.pdf`](docs/SiteDAO-sunum.pdf)

**Ekip:** Tolga Olguner · Eda Zeynep Büyük · Gökberk Özkan · Caner Nişancı

## Durum

Dönem projesi olarak teslim edildi. Move sözleşmeleri yazıldı, 25 birim testinin tamamını
geçiyor ve Sui testnet'ine yayınlandı; arayüz tamamlandı ve derleniyor. Aşağıdaki tabloda
işaretlenen akışlar zincir üzerinde çalışır; geri kalanı tarayıcıdaki yerel demo verisi
üzerinden yürür.

### Testnet yayını

| | |
|---|---|
| Package | `0xb0a9bd38f40e67e0d9251cdb99524c5458c47ed05757c1820fabb0a337caa0d5` |
| Treasury (shared) | `0x11155bd4c94edea4130632f7cf16c9fb6132598c9086361845ec345d78a38e86` |
| RentalRegistry (shared) | `0xdb93412d31e90bb23bd21f250814045607351f8bb25dbaea5c52ac5589d4cba3` |
| ProposalRegistry (shared) | `0xba943f6377b007fd830ee1d3947d848faf7c8014a1d3afe240d348931a707ed6` |
| TransferPolicy&lt;Apartment&gt; (shared) | `0x370c7df4358c083e822efe8de9bb0b6307f07bc71924c0652ba5a9eef7d61188` |

Ayrıntılar `move/site_dao/Published.toml` içindedir. `AdminCap`, `GovernanceAdminCap`,
`Publisher` ve `UpgradeCap` deploy eden adrese gönderilir.

Akışlar testnet üzerinde uçtan uca çalıştırılarak doğrulanmıştır: daire mint, aidat
ödeme, Kiosk'a kilitleme, ilan iptaliyle kilit çözme, kiralama talebi, onay, kiralama
ve oylama. Bu doğrulama, yalnızca ölü kod temizliğiyle ayrılan bir önceki yayın
üzerinde yapılmıştır; yukarıdaki paket üzerinde daire mint işlemi tekrar doğrulanmış,
kalan akışlar test gazı yetersizliği nedeniyle yinelenmemiştir.

### Zincir mi, demo mu?

Arayüz, zincir üzerindeki durumun bir kopyasını tarayıcıda `zustand` + `localStorage`
üzerinde tutar (`frontend/src/lib/store`). Sözleşme adresleri `.env.local` içinde
tanımlıysa aşağıdaki akışlar önce zincire yazılmayı dener, ardından yerel kopyayı
günceller. Zincire yazma başarısız olursa veya adresler tanımsızsa işlem **demo moduna**
düşer ve yalnızca yerel veri güncellenir.

| Akış | Zincire yazılır | Notlar |
|---|---|---|
| Aidat ödeme | evet | `governance::pay_dues` — ödeme paylaşılan Treasury nesnesine girer |
| Teklif oluşturma | evet | `governance::create_proposal` — `NEXT_PUBLIC_GOVERNANCE_ADMIN_CAP_ID` gerekir |
| Oylama | evet | `governance::vote_as_tenant` / `vote_as_owner` — teklifin zincir kaydı varsa |
| Kiracı önceliği | evet | kiradaki daire için ev sahibinin oyu sözleşme tarafından reddedilir |
| Kiraya çıkarma | evet | `rent_market::list_for_rent` — daire Kiosk'a **kilitlenir** |
| Kiralama talebi | evet | `rent_market::request_rental` — talep paylaşılan nesne olarak açılır |
| Talep onayı / reddi | evet | `rent_market::approve_rental_request` / `reject_rental_request` |
| Kiralama tamamlama | evet | `rent_market::rent_apartment` — yalnızca onaylı talep ile, TenantPass basılır |
| Kira ödeme | evet | `rent_market::pay_rent` — ödeme ev sahibine gider, `rent_paid_until` ilerler |
| Satışa çıkarma | evet | `sale_market::list_for_sale` — daire emanete alınır |
| Daire satın alma | evet | `sale_market::buy_apartment` — ödeme ve tapu tek işlemde el değiştirir |
| Rutin giderler | evet | `governance::record_routine_expense` — hazineden ödenir, fatura IPFS'e yüklenir |
| İlan iptali | evet | `rent_market::cancel_listing` — kilitli daire ev sahibine geri döner |

Uygulama ilk açıldığında 3 blok / 9 daireden oluşan **kurgusal** bir demo sitesi
("Green Garden Evleri") ile gelir. Demo verisindeki tüm e-postalar, isimler ve cüzdan
adresleri uydurmadır; gerçek bir kişiyi veya cüzdanı temsil etmez. Demo verisindeki
kayıtların zincir karşılığı olmadığı için bunlar üzerinden yapılan işlemler demo modunda
kalır; zincire yazılan işlemler uygulama içinde oluşturulan yeni kayıtlarla yürür.

## Proje Yapısı

```
SiteDAO/
├── docs/                     # Proje tanıtım sunumu
├── move/site_dao/            # Sui Move akıllı sözleşmeleri
│   ├── sources/
│   │   ├── apartment.move        # Daire NFT'si, aidat kaydı
│   │   ├── rent_market.move      # Kiralama, Kiosk, TenantPass, kira ödeme
│   │   ├── sale_market.move      # Satılık ilan, emanet, satın alma
│   │   └── governance.move       # Hazine, teklif, oylama, rutin gider
│   └── tests/site_dao_tests.move
├── frontend/                 # Next.js 14 (App Router)
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Tanıtım sayfası
│       │   ├── dashboard/        # Daireler, TenantPass, aidat
│       │   ├── governance/       # Teklifler, oylama, rutin giderler
│       │   ├── rentals/          # Kiralık ilanlar
│       │   ├── sales/            # Satılık ilanlar
│       │   ├── admin/            # Yönetici paneli
│       │   ├── profile/          # Kullanıcı profili
│       │   ├── about/            # Hakkında
│       │   └── api/
│       │       ├── upload-ipfs/          # Pinata'ya fatura yükleme
│       │       └── auth/callback/google/ # zkLogin OAuth dönüşü
│       ├── components/
│       │   ├── modals/           # İşlem pencereleri
│       │   ├── governance/       # Gider bileşenleri
│       │   ├── providers/        # Sui ve zkLogin sağlayıcıları
│       │   └── layout/
│       └── lib/
│           ├── store/            # Yerel demo veri katmanı (zustand)
│           ├── zklogin/          # Google ile zkLogin akışı
│           └── constants.ts      # Ortam değişkenleri ve sabitler
└── scripts/deploy.ts         # Sözleşmeleri yayınlar, .env.local'i günceller
```

## Kurulum

### Ön gereksinimler

- [Sui CLI](https://docs.sui.io/build/install) (v1.60+)
  - Not: Sui'nin genel testnet fullnode'u JSON-RPC'yi kaldırdı. Eski CLI sürümleriyle
    çalışmak için JSON-RPC sunan bir uç nokta tanımlayın, örn.
    `sui client new-env --alias testnet-alt --rpc https://sui-testnet-rpc.publicnode.com`
- Node.js 18+
- Sui testnet üzerinde bakiyeli bir cüzdan

### Sözleşmeler

```bash
cd move/site_dao
sui move build
sui move test
sui client publish --gas-budget 200000000
```

Deploy sonrası çıkan nesne ID'lerini elle girmek yerine yardımcı scripti kullanabilirsiniz;
script `frontend/.env.local` dosyasındaki sözleşme anahtarlarını günceller, elle girdiğiniz
diğer değerlere (Pinata, Google) dokunmaz:

```bash
cd scripts && npm install && npx ts-node deploy.ts
```

Deploy sonrası **bir kez** `TransferPolicy<Apartment>` oluşturulmalıdır; kiraya çıkarma
daireyi Kiosk'a kilitlediği için bu olmadan çalışmaz. Script gerekli komutu ekrana yazar:

```bash
sui client call --package <PACKAGE_ID> --module apartment --function create_transfer_policy --args <PUBLISHER_ID> --gas-budget 20000000
```

Oluşan `TransferPolicy` nesnesinin ID'sini `NEXT_PUBLIC_APARTMENT_POLICY_ID` olarak girin.

### Arayüz

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` içinde doldurulması gerekenler:

| Değişken | Ne işe yarar |
|---|---|
| `NEXT_PUBLIC_PACKAGE_ID` | Yayınlanan Move paketi |
| `NEXT_PUBLIC_TREASURY_ID` | Paylaşılan `Treasury` nesnesi |
| `NEXT_PUBLIC_RENTAL_REGISTRY_ID` | Paylaşılan `RentalRegistry` nesnesi |
| `NEXT_PUBLIC_PROPOSAL_REGISTRY_ID` | Paylaşılan `ProposalRegistry` nesnesi |
| `NEXT_PUBLIC_GOVERNANCE_ADMIN_CAP_ID` | Deploy edene gönderilen `GovernanceAdminCap` |
| `NEXT_PUBLIC_APARTMENT_POLICY_ID` | Paylaşılan `TransferPolicy<Apartment>` — Kiosk kilidi için zorunlu |
| `NEXT_PUBLIC_NETWORK` | `mainnet` / `testnet` / `devnet` / `localnet` |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Yönetici e-postaları, virgülle ayrılmış |
| `PINATA_API_KEY` / `PINATA_SECRET_KEY` | Fatura yükleme (boşsa demo hash üretilir) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | zkLogin için Google OAuth istemcisi |

Hiçbiri tanımlanmazsa uygulama açılır ve demo verisiyle gezilebilir; zincire yazan
işlemler sessizce demo moduna düşer.

## Temel Kavramlar

### Soulbound TenantPass

TenantPass, kiracının oy hakkını temsil eden bir NFT'dir. `store` yeteneği olmadığı için
transfer edilemez ve satılamaz; yalnızca süresi dolduğunda yakılabilir.

```move
public struct TenantPass has key {  // store YOK!
    id: UID,
    apartment_id: ID,
    expiry_date: u64,
    // ...
}
```

### Oylama önceliği

Her daire için tek oy hakkı vardır ve daire kiradaysa bu hak kiracınındır.

Sözleşme tarafında iki kontrol var: `vote_as_owner` dairenin `RentalRegistry` üzerinde
aktif kiralaması olup olmadığına bakar ve varsa ev sahibinin oyunu reddeder
(`EApartmentIsRented`); ayrıca `voted_apartments` kümesi sayesinde bir daire adına ikinci
kez oy kullanılamaz. Arayüz de aynı önceliği uygular: cüzdanda geçerli bir TenantPass
varsa kiracı adına, yoksa ev sahibi adına oy gönderir.

### Hazine

Aidatlar `governance::pay_dues` ile paylaşılan `Treasury` nesnesine yatırılır ve
`total_received` sayacını artırır. Aidatın hangi tarihe kadar ödendiği zincirdeki
`Clock`'tan okunur; istemciden gelen bir zaman damgasına güvenilmez. Harcamalar için
teklif açılır, oylama süresi dolduğunda evet oyu çoğunluktaysa `execute_proposal` ödemeyi
alıcıya aktarır.

## Kimlik Doğrulama

İki yol desteklenir:

- **Cüzdan** — `@mysten/dapp-kit` üzerinden Sui cüzdanı bağlanır.
- **zkLogin** — Google hesabıyla giriş yapılır, Mysten prover servisi üzerinden ZK kanıtı
  üretilir ve türetilen adresle işlem imzalanır.

zkLogin'de kullanılan salt, gösterim amaçlı basit bir yerel hash ile üretilir
(`frontend/src/lib/zklogin/proof.ts`). Gerçek bir kurulumda ayrı bir salt servisi
kullanılmalıdır.

## Tasarım Notları

**Sahipli nesne kısıtı.** Sui'de sahipli bir nesne yalnızca sahibinin imzaladığı işleme
girdi olabilir. Bu yüzden kiracı, ev sahibinin `Apartment` nesnesini referans olarak
geçiremez. Kiralama akışı bu kısıtı şöyle aşar: daire bilgileri (blok, daire no) ilan
açılırken `RentalListing`'e kopyalanır ve `rent_apartment` yalnızca paylaşılan
`RentalRegistry` ile çalışır.

**Satışta emanet.** Aynı kısıt satış için de geçerli olduğundan `list_for_sale` daireyi
paylaşılan bir `SaleListing` nesnesinin içine emanet alır. `buy_apartment` bu nesneyi
tüketir; ödeme satıcıya, daire alıcıya tek işlemde geçer. İlan iptal edilirse daire
satıcıya geri döner.

**Peşinat modeli.** Kiralamayı başlatmak için ilanda belirtilen peşinat tutarı yeterlidir;
kalan aylar `pay_rent` ile ödenir ve `rent_paid_until` zincirde ilerler.

**Kiosk kilidi.** Daire kiraya çıkarılırken Kiosk'a `place` ile değil `lock` ile konur:
kilitli bir nesne Kiosk'tan ancak `TransferPolicy<Apartment>` onaylanarak çıkabilir.
Böylece ev sahibi ilan açıkken veya kiralama sürerken daireyi başka bir yere devredemez.
İlan iptal edildiğinde `cancel_listing` daireyi standart yolla geri alır: 0 bedelle
listeler, satın alır ve politikayı onaylar. Politika kuralsız oluşturulur; ileride
komisyon veya kilit süresi gibi kurallar `TransferPolicyCap` ile eklenebilir.

**Kilitli daire için oy.** Daire Kiosk'ta kilitliyken ev sahibi `Apartment` nesnesini
doğrudan geçiremez; `governance::vote_as_owner_in_kiosk` `KioskOwnerCap` ile daireyi
ödünç alıp oy kullanmayı sağlar.

**Talep–onay akışı.** Kiralama tek adımda yapılmaz: kiracı adayı `request_rental` ile
paylaşılan bir `RentalRequest` açar, ilan sahibi `approve_rental_request` ile onaylar ve
kiralama ancak onaylı talep üzerinden tamamlanabilir. Talep tamamlandığında kapanır,
aynı talep ikinci kez kullanılamaz.

## Eksikler

- Arayüz zincirdeki durumu okumak yerine yerel bir kopya tutuyor; iki taraf ayrışabilir.
  Uygulama açıldığında gelen demo kayıtlarının zincir karşılığı yoktur.
- E-posta → cüzdan eşleştirmesi demo amaçlı sabit bir haritadan okunuyor; sahiplik
  zincirden okunmuyor.
- zkLogin salt'ı basit bir yerel hash ile üretiliyor, ayrı bir salt servisi yok.
- `TransferPolicy<Apartment>` kuralsız oluşturuluyor; komisyon, kilit süresi gibi kurallar
  tanımlı değil.
- Süresi dolan TenantPass kiracı tarafından elle yakılıyor; otomatik bir süreç yok.
- Struct düzenleri değiştiği için sözleşmeler upgrade edilemedi, yeni paket olarak
  yayınlandı; önceki paketin nesneleri (eski hazine ve kayıtlar) artık kullanılmıyor.
- Uygulamanın ilk açılışta gösterdiği demo kayıtları bu yayınla ilişkili değildir;
  zincire yazan işlemler uygulama içinde oluşturulan yeni kayıtlarla yürür.

## Teknolojiler

Sui Move (2024 edition) · Next.js 14 · TypeScript · Tailwind CSS · zustand ·
`@mysten/dapp-kit` · `@mysten/sui` · zkLogin · Pinata (IPFS)

## Testler

Move birim testleri:

```bash
cd move/site_dao
sui move test
```

25 test; aidatın hazineye girmesi, kiracı önceliği, kiracının daire nesnesi olmadan
kiralayabilmesi, talep onay akışı, dairenin Kiosk'a kilitlenmesi ve ilan iptalinde geri
dönmesi, peşinat ve kira ödemesi, daire satışı ve rutin gider senaryolarını kapsar.

## Lisans

MIT
