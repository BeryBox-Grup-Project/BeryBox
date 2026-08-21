import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Camera, Gift, HandHeart, Handshake, MagnifyingGlass, Truck, User, UsersThree } from '@phosphor-icons/react';
import heroImage from '../assets/BeryBox.png';
import logo from '../assets/Favicon.png';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const NAV_LINKS = [
  { href: '#beranda', label: 'Beranda' },
  { href: '#organisasi', label: 'Organisasi' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#tentang', label: 'Tentang' },
];

const STEPS = [
  {
    n: '01',
    title: 'Unggah barang',
    body: 'Foto, deskripsi, dan lokasi. Tetangga atau panti di dekatmu bisa melihatnya.',
    Icon: Camera,
  },
  {
    n: '02',
    title: 'Pilih penerima',
    body: 'Baca alasan klaim, terima yang paling pas, atau tawarkan ke organisasi terverifikasi.',
    Icon: HandHeart,
  },
  {
    n: '03',
    title: 'Ambil atau kirim',
    body: 'Ambil sendiri atau pakai kurir. Setelah sampai, beri ulasan supaya komunitas tetap aman.',
    Icon: Truck,
  },
];

const PILLARS = [
  {
    title: 'Donasi',
    tone: 'text-primary',
    body: 'Beri kehidupan kedua pada barangmu. Mudah, cepat, dan langsung ke tangan yang membutuhkan.',
    Icon: Gift,
  },
  {
    title: 'Cari & Klaim',
    tone: 'text-secondary',
    body: 'Temukan harta karun tersembunyi di sekitarmu secara gratis. Dari buku hingga elektronik kecil.',
    Icon: MagnifyingGlass,
  },
  {
    title: 'Bantu Organisasi',
    tone: 'text-tertiary',
    body: 'Salurkan donasi langsung ke panti asuhan, sekolah, atau komunitas lokal di dekatmu.',
    Icon: Handshake,
  },
];

const AUDIENCES = [
  {
    title: 'Perorangan',
    body: 'Donasi, klaim, atau barter barang layak pakai dengan tetangga.',
    to: '/register',
    state: { role: 'user' },
    cta: 'Daftar sebagai anggota',
    Icon: User,
  },
  {
    title: 'Organisasi',
    body: 'Unggah kebutuhan panti atau komunitas, lalu terima donasi setelah verifikasi.',
    to: '/register',
    state: { role: 'organization' },
    cta: 'Daftar sebagai organisasi',
    Icon: UsersThree,
  },
];

const STORIES = [
  { name: 'Siti N.', text: 'Meja belajar bekas saya sekarang dipakai anak tetangga. Prosesnya cuma sehari.' },
  { name: 'Budi W.', text: 'Barter kamera analog dengan tanaman hias. Tidak ada uang berpindah, cuma niat baik.' },
  { name: 'Panti Kasih Bunda', text: 'Donasi pakaian hangat datang dari lima keluarga dalam satu minggu.' },
];

function PawMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="58" cy="58" rx="22" ry="28" transform="rotate(-18 58 58)" />
      <ellipse cx="100" cy="38" rx="24" ry="30" />
      <ellipse cx="142" cy="58" rx="22" ry="28" transform="rotate(18 142 58)" />
      <ellipse cx="168" cy="96" rx="18" ry="24" transform="rotate(38 168 96)" />
      <path d="M42 118c8-28 38-44 62-40 28 4 52 28 58 52 6 26-8 52-34 62-18 7-40 4-56-8-22-16-38-40-30-66z" />
    </svg>
  );
}

function HeroScene() {
  const heroRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 0.88]);
  const imageRotate = useTransform(scrollYProgress, [0, 1], [0, -4]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -56]);

  return (
    <header
      ref={heroRef}
      id="beranda"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#e36a8a_0%,#b83b62_36%,#7a2340_66%,#6b1c32_100%)]"
    >
      <div className="relative flex min-h-screen w-full max-w-[1400px] flex-col items-center justify-center px-margin-mobile py-27 mt-20 md:px-margin-desktop">
        <motion.div
          animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
          transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center"
        >
          <motion.div
            style={reduceMotion ? undefined : { y: textY, willChange: 'transform' }}
            className="relative z-10 -mb-2 w-full max-w-5xl px-2 md:-mb-3"
          >
            <h1 className="flex flex-wrap justify-center gap-x-[0.3em] text-center font-display text-4xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgba(60,8,24,0.45)] md:text-6xl lg:text-7xl">
              {['Bagikan', 'yang', 'ada,', 'hadirkan', 'senyum', 'yang', 'ceria.'].map((word, index) => (
                <motion.span
                  key={`${word}-${index}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block"
                >
                  {word}
                </motion.span>
              ))}
            </h1>
          </motion.div>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-20 -mt-12 md:-mt-16 lg:-mt-20"
          >
            <motion.img
              src={heroImage}
              alt=""
              width={1344}
              height={768}
              decoding="async"
              fetchPriority="high"
              style={
                reduceMotion
                  ? undefined
                  : { y: imageY, scale: imageScale, rotate: imageRotate, willChange: 'transform' }
              }
              className="pointer-events-none h-auto max-h-[76vh] w-auto max-w-[min(1100px,96vw)] object-contain"
            />
          </motion.div>
        </motion.div>
      </div>
    </header>
  );
}

function FadeUp({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > window.innerHeight - 80);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const overHero = !scrolled;

  return (
    <div className="min-h-screen bg-[#6b1c32]">
      <nav
        className={`fixed inset-x-0 top-0 z-[30] transition-colors duration-300 ${
          overHero ? 'bg-transparent' : 'bg-surface/90 shadow-sm backdrop-blur-md'
        }`}
      >
        <div className="relative mx-auto flex max-w-[1280px] items-center justify-between px-margin-mobile py-5 md:px-margin-desktop">
          <a
            href="#beranda"
            className={`flex items-center gap-1 font-display text-2xl font-black tracking-tight ${
              overHero ? 'text-white' : 'text-primary'
            }`}
          >
            <img src={logo} alt="" className="h-9 w-auto object-contain" />
            BeryBox
          </a>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`font-label text-sm transition-colors ${
                  overHero ? 'text-white hover:text-white' : 'text-on-surface-variant hover:text-primary'
                } ${link.href === '#beranda' ? 'underline decoration-2 underline-offset-[10px]' : ''}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className={`font-label rounded-full px-4 py-2 text-sm ${
                overHero ? 'text-white hover:bg-white/10' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Login
            </Link>
            <Button
              as={Link}
              to="/register"
              className="border-0 bg-[#4a1528] px-5 text-white shadow-none hover:bg-[#5c1a30]"
            >
              Sign up
            </Button>
          </div>
        </div>
      </nav>

      <HeroScene />

      <div className="bg-background">
        <section id="cara-kerja" className="mx-auto max-w-[1280px] px-margin-mobile py-20 md:px-margin-desktop">
          <FadeUp>
            <p className="font-label text-center text-sm uppercase tracking-widest text-primary">Cara kerja</p>
            <h2 className="font-display mt-2 text-center text-3xl font-bold text-on-surface md:text-4xl">
              Tiga langkah, tanpa ribet
            </h2>
          </FadeUp>
          <div className="mt-12 grid gap-gutter md:grid-cols-3">
            {STEPS.map((step, index) => (
              <FadeUp key={step.n} delay={index * 0.08}>
                <motion.div whileHover={{ y: -4 }} className="h-full">
                  <Card className="flex h-full flex-col p-8">
                    <span className="font-display text-sm font-bold text-primary">{step.n}</span>
                    <step.Icon size={36} className="mt-6 text-primary" weight="duotone" />
                    <h3 className="font-headline mt-4 text-xl text-on-surface">{step.title}</h3>
                    <p className="mt-2 text-on-surface-variant">{step.body}</p>
                  </Card>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </section>

        <section id="organisasi" className="mx-auto max-w-[1280px] px-margin-mobile pb-20 md:px-margin-desktop">
          <FadeUp>
            <h2 className="font-display mb-12 text-center text-3xl font-bold text-on-surface md:text-4xl">
              Satu barang, banyak kemungkinan
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
            {PILLARS.map((pillar, index) => (
              <FadeUp key={pillar.title} delay={index * 0.06}>
                <motion.div whileHover={{ y: -4 }} className="h-full">
                  <Card className="flex h-full flex-col overflow-hidden">
                    <div className="flex h-40 items-center justify-center bg-surface-container text-primary">
                      <pillar.Icon size={56} weight="duotone" />
                    </div>
                    <div className="flex flex-1 flex-col p-stack-md">
                      <h3 className={`font-headline mb-2 text-xl ${pillar.tone}`}>{pillar.title}</h3>
                      <p className="text-on-surface-variant">{pillar.body}</p>
                    </div>
                  </Card>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-low">
          <div className="mx-auto max-w-[1280px] px-margin-mobile py-20 md:px-margin-desktop">
            <FadeUp>
              <h2 className="font-display text-center text-3xl font-bold text-on-surface md:text-4xl">Untuk siapa</h2>
              <p className="mx-auto mt-3 max-w-xl text-center text-on-surface-variant">
                Satu platform, dua jenis akun. Pilih yang sesuai, sisanya sama: berbagi barang layak pakai.
              </p>
            </FadeUp>
            <div className="mx-auto mt-12 grid max-w-4xl gap-gutter md:grid-cols-2">
              {AUDIENCES.map((row, index) => (
                <FadeUp key={row.title} delay={index * 0.08}>
                  <motion.div whileHover={{ y: -4 }} className="h-full">
                    <Card className="flex h-full flex-col p-8">
                      <row.Icon size={36} className="text-primary" weight="duotone" />
                      <h3 className="font-headline mt-4 text-xl text-on-surface">{row.title}</h3>
                      <p className="mt-2 flex-1 text-on-surface-variant">{row.body}</p>
                      <Button as={Link} to={row.to} state={row.state} className="mt-6" variant="secondary">
                        {row.cta}
                      </Button>
                    </Card>
                  </motion.div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        <section id="tentang" className="mx-auto max-w-[1280px] px-margin-mobile py-20 md:px-margin-desktop">
          <FadeUp>
            <h2 className="font-display text-3xl font-bold text-on-surface md:text-4xl">Tentang kami</h2>
            <p className="mt-4 max-w-2xl text-lg text-on-surface-variant">
              BeryBox adalah platform komunitas untuk mendonasikan dan menukar barang bekas yang masih layak pakai.
              Satu akun bisa memberi dan menerima. Bukan marketplace jual-beli — kredit hanya menyeimbangkan barter,
              bukan uang.
            </p>
          </FadeUp>
          <div className="mt-12 grid gap-gutter md:grid-cols-3">
            {STORIES.map((row, index) => (
              <FadeUp key={row.name} delay={index * 0.06}>
                <Card className="h-full p-8">
                  <p className="text-lg leading-relaxed text-on-surface">“{row.text}”</p>
                  <p className="font-label mt-6 text-sm text-primary">{row.name}</p>
                </Card>
              </FadeUp>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-primary-container py-24 text-on-primary-container">
          <PawMark className="pointer-events-none absolute -right-16 -bottom-20 h-[340px] w-[340px] text-white/15 md:h-[420px] md:w-[420px]" />
          <FadeUp className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center px-margin-mobile text-center md:px-margin-desktop">
            <p className="font-label text-sm text-white md:text-base">
              Barangmu mungkin berarti buat seseorang.
            </p>
            <Button as={Link} to="/register" size="lg" variant="white" className="mt-8">
              Mulai Sekarang
            </Button>
          </FadeUp>
        </section>

        <footer className="bg-surface-container-highest">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-margin-mobile py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-margin-desktop">
            <div>
              <p className="font-display text-xl font-extrabold text-primary">BeryBox</p>
              <p className="mt-3 text-sm text-on-surface-variant">
                © 2026 BeryBox. Dibuat dengan cinta untuk komunitas.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-on-surface-variant">
              <a href="#tentang" className="hover:text-primary">Tentang Kami</a>
              <a href="#cara-kerja" className="hover:text-primary">Pusat Bantuan</a>
            </div>
            <div className="flex flex-col gap-2 text-sm text-on-surface-variant">
              <a href="#tentang" className="hover:text-primary">Privasi</a>
              <a href="#tentang" className="hover:text-primary">Syarat & Ketentuan</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
