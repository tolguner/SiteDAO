"use client";

import Link from "next/link";
import { Building2, Trees, Users, Shield, Phone, MapPin, Mail, ChevronDown, Waves, Car, Dumbbell, Coffee } from "lucide-react";
import { useZkLogin } from "@/components/providers/ZkLoginProvider";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useSiteStore } from "@/lib/store";
import { MONTHLY_DUES_SUI } from "@/lib/constants";

export default function Home() {
  const { isConnected: zkLoginConnected } = useZkLogin();
  const account = useCurrentAccount();
  const isConnected = zkLoginConnected || !!account?.address;

  // Özet rakamlar zincirden hidrate edilen store'dan okunur
  const apartments = useSiteStore((state) => state.apartments);
  const tenantPasses = useSiteStore((state) => state.tenantPasses);
  const treasury = useSiteStore((state) => state.treasury);

  return (
    <div className="-mt-8 -mx-4 -mb-8">
      {/* Hero Section - Tam Ekran Arka Plan */}
      <section
        className="relative w-full min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'scroll',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />

        {/* Hero İçerik */}
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4 pt-16">
          {/* Site Logosu */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl">
              <Trees className="w-14 h-14 text-white" />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-4 drop-shadow-lg">
            Green Garden
          </h1>
          <p className="text-4xl md:text-5xl font-bold mb-2 text-white">
            Evleri
          </p>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Doğayla iç içe, modern yaşam alanı.
            <br className="hidden md:block" />
            Blockchain teknolojisi ile şeffaf ve demokratik site yönetimi.
          </p>

          {/* SiteDAO Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm mb-8 border border-white/20">
            <Building2 className="w-4 h-4 text-sui" />
            <span>SiteDAO ile Yönetiliyor</span>
          </div>

          {/* CTA Butonları */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isConnected ? (
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Konutlarıma Git
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Giriş Yap
              </Link>
            )}
            <Link
              href="/governance"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-xl font-semibold text-lg transition-all border border-white/30"
            >
              Site Kararlarını Gör
            </Link>
          </div>

          {/* Aşağı Kaydır İkonu */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-8 h-8 text-white/60" />
          </div>
        </div>
      </section>

      {/* Site Bilgileri - Arka plan ile fixed görselin üstünü kapat */}
      <section className="relative py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Sitemiz Hakkında</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Green Garden Evleri, 2020 yılında kurulan, 3 blok ve 9 bağımsız bölümden oluşan modern bir yaşam alanıdır.
            </p>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            <StatCard value="3" label="Blok" icon={<Building2 className="w-6 h-6" />} />
            <StatCard value="9" label="Daire" icon={<Users className="w-6 h-6" />} />
            <StatCard value="2020" label="Kuruluş" icon={<Shield className="w-6 h-6" />} />
            <StatCard value="24/7" label="Güvenlik" icon={<Shield className="w-6 h-6" />} />
          </div>

          {/* Özellikler */}
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Waves className="w-10 h-10 text-blue-500" />}
              title="Yüzme Havuzu"
              description="Açık ve kapalı yüzme havuzları ile yaz-kış keyifli vakit geçirin."
            />
            <FeatureCard
              icon={<Dumbbell className="w-10 h-10 text-orange-500" />}
              title="Fitness Center"
              description="Modern ekipmanlarla donatılmış spor salonu 7/24 hizmetinizde."
            />
            <FeatureCard
              icon={<Car className="w-10 h-10 text-purple-500" />}
              title="Kapalı Otopark"
              description="Her daireye özel kapalı otopark alanı mevcuttur."
            />
            <FeatureCard
              icon={<Trees className="w-10 h-10 text-green-500" />}
              title="Yeşil Alanlar"
              description="Geniş bahçe ve çocuk oyun alanları ile doğayla iç içe yaşam."
            />
            <FeatureCard
              icon={<Coffee className="w-10 h-10 text-amber-600" />}
              title="Sosyal Tesisler"
              description="Kafeterya, toplantı salonu ve misafir odaları."
            />
            <FeatureCard
              icon={<Shield className="w-10 h-10 text-red-500" />}
              title="Güvenlik"
              description="7/24 güvenlik kameraları ve kapıcı hizmeti."
            />
          </div>
        </div>
      </section>

      {/* SiteDAO Bölümü */}
      <section className="py-16 bg-gradient-to-r from-sui/10 to-blue-500/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sui/20 text-sui rounded-full text-sm font-medium mb-4">
                <Building2 className="w-4 h-4" />
                Blockchain Yönetimi
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                SiteDAO ile Yönetiliyoruz
              </h2>
              <p className="text-muted-foreground mb-6">
                Green Garden Evleri, Sui blockchain üzerinde çalışan SiteDAO akıllı sözleşmeleri ile yönetilmektedir.
                Tüm aidat ödemeleri, harcama kararları ve yönetim süreçleri şeffaf ve demokratik bir şekilde gerçekleştirilir.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-500 text-sm">✓</span>
                  </div>
                  <span>Her daire için benzersiz NFT mülkiyet belgesi</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-500 text-sm">✓</span>
                  </div>
                  <span>Kiracılara Soulbound TenantPass kartı ile oy hakkı</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-500 text-sm">✓</span>
                  </div>
                  <span>Tüm harcamalar oy çokluğu ile onaylanır</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-500 text-sm">✓</span>
                  </div>
                  <span>Şeffaf hazine yönetimi ve anlık takip</span>
                </li>
              </ul>
              <Link
                href="/governance"
                className="btn-primary inline-flex items-center gap-2"
              >
                Teklifleri İncele
              </Link>
            </div>
            <div className="flex-1">
              <div className="bg-card rounded-2xl p-8 border shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-sui to-blue-600 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">SiteDAO</h3>
                    <p className="text-sm text-muted-foreground">Sui Blockchain</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-muted-foreground">Zincirdeki Daire</span>
                    <span className="font-bold">{apartments.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-muted-foreground">Aktif Kiralama</span>
                    <span className="font-bold">{tenantPasses.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b">
                    <span className="text-muted-foreground">Aylık Aidat</span>
                    <span className="font-bold text-sui">{MONTHLY_DUES_SUI} SUI</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-muted-foreground">Hazine</span>
                    <span className="font-bold text-green-500">
                      {(treasury.balance / 1_000_000_000).toFixed(2)} SUI
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* İletişim */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">İletişim</h2>
            <p className="text-muted-foreground">
              Sorularınız için bize ulaşabilirsiniz
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-6 bg-card rounded-xl border">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Adres</h3>
              <p className="text-sm text-muted-foreground">
                Green Garden Evleri<br />
                Ataşehir, İstanbul
              </p>
            </div>
            <div className="text-center p-6 bg-card rounded-xl border">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Telefon</h3>
              <p className="text-sm text-muted-foreground">
                +90 (216) 123 45 67<br />
                Kapıcı: +90 532 123 45 67
              </p>
            </div>
            <div className="text-center p-6 bg-card rounded-xl border">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">E-posta</h3>
              <p className="text-sm text-muted-foreground">
                yonetim@greengarden.com<br />
                destek@greengarden.com
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Trees className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold">Green Garden Evleri</span>
                <p className="text-xs text-muted-foreground">SiteDAO ile Yönetiliyor</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Konutlarım</Link>
              <Link href="/governance" className="hover:text-foreground transition-colors">Yönetişim</Link>
              <Link href="/rentals" className="hover:text-foreground transition-colors">Kiralık</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Green Garden Evleri. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card rounded-xl p-6 border card-hover">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center p-6 bg-card rounded-xl border">
      <div className="flex justify-center mb-3 text-green-500">
        {icon}
      </div>
      <div className="text-3xl font-bold text-foreground mb-1">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
