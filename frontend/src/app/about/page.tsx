import Link from "next/link";
import { Building2, Vote, Wallet, Shield, Users, BarChart3 } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center py-16">
        <div className="max-w-4xl mx-auto">
          <div className="w-20 h-20 rounded-2xl gradient-sui flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-sui to-blue-600 bg-clip-text text-transparent">
            SiteDAO
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Apartman ve site yönetiminde yeni dönem. 
            <br />
            Blockchain teknolojisi ile şeffaf, güvenilir ve demokratik yönetim.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard" className="btn-primary text-lg px-8 py-3">
              Başla
            </Link>
            <Link href="/governance" className="btn-secondary text-lg px-8 py-3">
              Teklifleri Gör
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-8">
        <FeatureCard
          icon={<Building2 className="w-12 h-12 text-sui" />}
          title="Daire NFT'leri"
          description="Her daire benzersiz bir NFT olarak temsil edilir. Mülkiyet hakları blockchain üzerinde güvence altında."
        />
        <FeatureCard
          icon={<Users className="w-12 h-12 text-sui" />}
          title="Kiracı Sistemi"
          description="Sui Kiosk ile kiralama. Kiracılara Soulbound TenantPass kartı ile oy hakkı tanınır."
        />
        <FeatureCard
          icon={<Vote className="w-12 h-12 text-sui" />}
          title="Demokratik Oylama"
          description="Tüm harcamalar oy çokluğu ile onaylanır. Her dairenin 1 oy hakkı vardır."
        />
        <FeatureCard
          icon={<Wallet className="w-12 h-12 text-sui" />}
          title="Ortak Hazine"
          description="Aidatlar merkezi bir hazinede toplanır. Tüm hareketler blockchain'de kayıtlı."
        />
        <FeatureCard
          icon={<Shield className="w-12 h-12 text-sui" />}
          title="Şeffaflık"
          description="Tüm faturalar IPFS'te saklanır. Herkes her zaman kontrol edebilir."
        />
        <FeatureCard
          icon={<BarChart3 className="w-12 h-12 text-sui" />}
          title="Anlık Takip"
          description="Hazine bakiyesi, aktif teklifler ve oylama durumları gerçek zamanlı izlenir."
        />
      </section>

      {/* How It Works Section */}
      <section className="bg-muted/50 rounded-2xl p-8">
        <h2 className="text-3xl font-bold text-center mb-12">Nasıl Çalışır?</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <StepCard
            step={1}
            title="Cüzdan Bağla"
            description="Sui cüzdanınızı bağlayın veya Google ile zkLogin kullanın."
          />
          <StepCard
            step={2}
            title="Daire/Kiracı Kartı"
            description="Ev sahibiyseniz Apartment NFT, kiracıysanız TenantPass ile sisteme dahil olun."
          />
          <StepCard
            step={3}
            title="Aidat Öde"
            description="Aylık aidatlarınızı SUI ile ortak hazineye ödeyin."
          />
          <StepCard
            step={4}
            title="Oy Kullan"
            description="Harcama tekliflerini inceleyin ve oyunuzu kullanın."
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="text-center py-8">
        <div className="grid md:grid-cols-4 gap-8">
          <StatCard value="100+" label="Daire" />
          <StatCard value="50+" label="Aktif Kiracı" />
          <StatCard value="25" label="Onaylanan Teklif" />
          <StatCard value="1000 SUI" label="Hazine Bakiyesi" />
        </div>
      </section>

      {/* Back to Home */}
      <section className="text-center pb-8">
        <Link 
          href="/" 
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Ana Sayfaya Dön
        </Link>
      </section>
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

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-sui text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-sui mb-2">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
