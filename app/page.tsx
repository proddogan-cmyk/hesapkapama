import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-[-120px] top-24 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <Logo variant="full" />
          <div className="text-xs text-slate-400">v2</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Giriş Yap
          </Link>
          <Link
            href="/sign-up"
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Hesap Oluştur
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              Film setinde hesap kapatmak artık tek ekranda.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              hesapkapama.com v2; proje bazlı kasa takibi, avans giriş/çıkış yönetimi, fişten otomatik
              okuma (kamera veya foto), kategori özetleri ve Excel şablon çıktısı ile üretim sonunda
              hesabı hızlı ve temiz kapatmanı sağlar.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Ücretsiz Başla
              </Link>
              <div className="text-xs text-slate-400">
                Kayıt ol → Profilini tamamla → Proje aç → + / – ile işlemleri gir.
              </div>
            </div>

            <SignedIn>
              <div className="mt-5 text-sm text-emerald-200">
                Zaten giriş yaptın. Uygulamaya <Link className="underline" href="/app">buradan</Link> geçebilirsin.
              </div>
            </SignedIn>
            <SignedOut>
              <div className="mt-5 text-xs text-slate-400">
                Not: Kamera ile fiş tarama için localhost veya HTTPS gerekir.
              </div>
            </SignedOut>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur">
            <div className="text-sm font-semibold text-slate-100">Neler var?</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Proje bazlı kasa ve işlem listesi</li>
              <li>• Alt çubuk: Ana Sayfa / Özet / Ayarlar</li>
              <li>• + (giriş) / – (çıkış) hızlı aksiyonları her sayfada sabit</li>
              <li>• Avans kişi isimleri otomatik hatırlanır, yazım hatası tek kişide birleşir</li>
              <li>• Fiş fotoğrafına tıkla → görseli aç</li>
              <li>• Yanlış işlem → tek tıkla sil</li>
            </ul>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-400">
              Kurumsal kullanım için (ekip, çoklu cihaz, kalıcı veri) ileride Supabase/Firebase entegrasyonu eklenebilir.
            </div>
          </div>
        </div>
      </section>

      <footer className="relative mx-auto max-w-6xl px-6 pb-10 pt-10 text-xs text-slate-500">
        © {new Date().getFullYear()} hesapkapama.com — v2
      </footer>
    </main>
  );
}
