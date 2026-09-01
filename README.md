# SiteDAO - Merkeziyetsiz Site Yönetim Platformu

Apartman ve site yönetimlerindeki şeffaflık sorununu ele alan, Sui blokzinciri üzerinde
çalışan bir merkeziyetsiz uygulama (dApp) prototipi. Daire sahipliği NFT ile, kiracılık
devredilemez bir kartla, ortak harcamalar da oylamaya açılan tekliflerle temsil edilir.

*Blok Zinciri ve Kripto Para Teknolojileri* dersi dönem projesi olarak geliştirilmiştir.
Proje tanıtım sunumu: [`docs/SiteDAO-sunum.pdf`](docs/SiteDAO-sunum.pdf)

**Ekip:** Tolga Olguner · Eda Zeynep Büyük · Gökberk Özkan · Caner Nişancı

## Durum

Dönem projesi olarak teslim edildi. Move sözleşmeleri 28 birim testinin tamamını geçiyor
ve Sui testnet'ine yayınlandı; arayüz tamamlandı, tüm site durumunu zincirden okuyor ve
aşağıdaki tablodaki işlemleri zincire yazıyor.

### Testnet yayını

| | |
|---|---|
| Package | `0x76d372d2a517ac76961532fe5add22d10890fd3fa44bed8ddd524d8544fc7dfd` |
| Treasury (shared) | `0x51ffce4bb885d3e814a5b6094ac9731922badd73067d9405de3ac29c80adab53` |
| RentalRegistry (shared) | `0xf5978375012a61c127edaeebc275a46d417a690270257e29b13eec9b2cc5f656` |
| ProposalRegistry (shared) | `0xf4e522984d5b278c5507d960b32c964c432613c17c7a71863b710464547990bf` |
| TransferPolicy&lt;Apartment&gt; (shared) | `0x194472d99604f4eb00ff666dd600126bfe74929565aad17ad085734523f938f9` |

Ayrıntılar `move/site_dao/Published.toml` içindedir. `AdminCap`, `GovernanceAdminCap`,
`Publisher` ve `UpgradeCap` deploy eden adrese gönderilir.

Yukarıdaki paket üzerinde tüm akışlar testnet'te uçtan uca çalıştırılarak
doğrulanmıştır: daire mint, aidat ödeme, Kiosk'a kilitleme, kiralama talebi, onaysız
talebin reddi, onay, kiralama ve TenantPass basımı, kira ödeme, teklif oluşturma,
kiradaki daire için ev sahibi oyunun reddi, kiracı oyu, rutin gider ve daire satışı.
Arayüzün zincirden okuma katmanı da aynı canlı veriye karşı doğrulanmıştır.

Tek istisna `release_expired_rental`: doğrulaması kira süresinin gerçekten dolmasını
gerektirdiğinden yalnızca birim testleriyle kapsanmıştır.

### Zincir mi, demo mu?

Sözleşme adresleri `.env.local` içinde tanımlıysa uygulama **zincir modunda** çalışır:
site durumu (daireler, kiracı kartları, ilanlar, talepler, teklifler, rutin giderler ve
hazine) doğrudan zincirden okunur ve 15 saniyede bir tazelenir. Tarayıcıdaki `zustand`
store yalnızca bu okumanın önbelleğidir. Adresler tanımsızsa uygulama kurgusal demo
verisiyle açılır ve zincire yazan işlemler **demo moduna** düşer.

Zincir okuma katmanı `frontend/src/lib/chain/read.ts` içindedir; sahiplik, kiralama
durumu ve oy sayıları olay kayıtları ile paylaşılan nesnelerin dinamik alanlarından
üretilir.

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
| Süresi dolan kiralama | evet | `rent_market::release_expired_rental` — kaydı herkes düşürebilir |

Sözleşme adresleri tanımlı değilken uygulama, 3 blok / 9 daireden oluşan **kurgusal**
bir demo sitesiyle ("Green Garden Evleri") açılır. Demo verisindeki tüm e-postalar,
isimler ve cüzdan adresleri uydurmadır; gerçek bir kişiyi veya cüzdanı temsil etmez.
Zincir modunda bu veri kullanılmaz, yerini zincirden okunan gerçek durum alır.

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
│       │       ├── zklogin/salt/         # zkLogin salt servisi
│       │       └── auth/callback/google/ # zkLogin OAuth dönüşü
│       ├── components/
│       │   ├── modals/           # İşlem pencereleri
│       │   ├── governance/       # Gider bileşenleri
│       │   ├── providers/        # Sui ve zkLogin sağlayıcıları
│       │   └── layout/
│       └── lib/
│           ├── chain/            # Zincirden durum okuma katmanı
│           ├── store/            # Zincirden hidrate edilen durum önbelleği (zustand)
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

Uygulama **http://localhost:3010** adresinde açılır. zkLogin kullanacaksanız Google
Cloud Console'da yetkili yönlendirme adresi olarak
`http://localhost:3010/api/auth/callback/google` kayıtlı olmalıdır; aksi halde Google
`redirect_uri_mismatch` döndürür.

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
| `NEXT_PUBLIC_SUI_RPC_URL` | RPC uç noktası — genel fullnode'lar tarayıcıdan CORS'a izin vermiyor |
| `ZKLOGIN_SALT_SECRET` | Salt servisi sırrı (sunucu tarafı, asla istemciye gitmez) |
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

### Salt servisi

zkLogin'de salt, kullanıcının Google kimliği ile Sui adresi arasındaki bağı gizler:
aynı hesap hep aynı adresi almalı, ama salt'ı bilmeyen biri e-postadan adrese
gidememelidir. Bu yüzden salt istemcide hesaplanmaz.

`/api/zklogin/salt` uç noktası ([route.ts](frontend/src/app/api/zklogin/salt/route.ts))
önce JWT'yi Google'ın JWKS'ine karşı doğrular — aksi halde herkes istediği `sub` için
salt isteyip başkasının adresini türetebilirdi — sonra
`HMAC-SHA256(ZKLOGIN_SALT_SECRET, iss|aud|sub)` değerinin ilk 128 bitini döndürür.
Deterministiktir, sunucu sırrı olmadan hesaplanamaz ve zkLogin'in beklediği aralıktadır.

`ZKLOGIN_SALT_SECRET` değişirse tüm kullanıcıların adresi değişir.

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

**Zincirden okuma.** Uygulama zincir modunda hiçbir veriyi kendi uydurmaz: daireler
`ApartmentMinted` olaylarından bulunup güncel sahipleriyle okunur, kiralama ilanları ve
aktif kiralamalar `RentalRegistry`'nin tablolarından, teklifler `ProposalRegistry`
üzerinden, satılık ilanlar ve rutin giderler ise olay kayıtlarından üretilir. Kiraya
çıkarılan daire Kiosk'ta kilitli olduğu için adres sahibi görünmez; bu durumda sahip
bilgisi ilandan okunur.

**Süresi dolan kiralamanın düşürülmesi.** `TenantPass` soulbound olduğu için yalnızca
kiracı yakabilir. Kiracı bunu yapmazsa daire kayıtta sonsuza dek kirada görünür; ev
sahibi ilanı iptal edemez, yeniden kiralayamaz ve daire Kiosk'ta kilitli kalırdı. Bu
yüzden bitiş tarihi `ActiveRental` kaydında da tutulur ve `release_expired_rental` süre
dolduktan sonra **herkes tarafından** çağrılabilir. Kart yakılmaz ama süresi geçtiği için
oy kullanmakta da kullanılamaz.

**Talep–onay akışı.** Kiralama tek adımda yapılmaz: kiracı adayı `request_rental` ile
paylaşılan bir `RentalRequest` açar, ilan sahibi `approve_rental_request` ile onaylar ve
kiralama ancak onaylı talep üzerinden tamamlanabilir. Talep tamamlandığında kapanır,
aynı talep ikinci kez kullanılamaz.

## Bilinçli Sınırlar

Aşağıdakiler eksik değil, kapsam kararıdır:

- **`TransferPolicy<Apartment>` kuralsız oluşturulur.** Komisyon veya kilit süresi gibi
  kurallar tanımlı değildir; site yönetimi bağlamında bir telif payı gerekmez. İhtiyaç
  halinde `TransferPolicyCap` ile sonradan eklenebilir.
- **Süresi dolan TenantPass'ı yalnızca kiracı yakabilir.** Kart soulbound olduğu ve
  fonksiyona değer olarak geçildiği için Sui'de onu başkasının geçirmesi mümkün değildir.
  Kiracı kartı yakmasa bile daire kilitli kalmaz: `release_expired_rental` süre dolduktan
  sonra kaydı düşürür ve ev sahibi daireyi geri alabilir (bkz. Tasarım Notları).
- **Kiracı adayının iletişim bilgileri zincirde tutulmaz.** Ad, e-posta ve telefon
  kişisel veridir ve herkese açık bir deftere yazılmaz; zincirde yalnızca talep sahibinin
  adresi, süre ve onay durumu bulunur.

## Teknolojiler

Sui Move (2024 edition) · Next.js 14 · TypeScript · Tailwind CSS · zustand ·
`@mysten/dapp-kit` · `@mysten/sui` · zkLogin · Pinata (IPFS)

## Testler

Move birim testleri:

```bash
cd move/site_dao
sui move test
```

28 test; aidatın hazineye girmesi, kiracı önceliği, kiracının daire nesnesi olmadan
kiralayabilmesi, talep onay akışı, dairenin Kiosk'a kilitlenmesi ve ilan iptalinde geri
dönmesi, peşinat ve kira ödemesi, daire satışı, rutin gider ve süresi dolan kiralamanın
herkesçe düşürülebilmesi senaryolarını kapsar.

## Lisans

MIT
