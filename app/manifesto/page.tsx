import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { siteUrl } from "@/lib/seo";
import { getRequestLocale } from "@/lib/request-locale";
import LocalizedContent from "@/components/localized-content";

export async function generateMetadata(): Promise<Metadata> {
  const english = await getRequestLocale() === "en";
  const title = english ? "MU-KOMIK AI Manifesto" : "Manifesto AI MU-KOMIK";
  const description = english
    ? "AI for storytelling. Humans for creating meaning. The MU-KOMIK manifesto on creativity, technology, and the future of comics."
    : "AI untuk bercerita. Manusia untuk menciptakan makna. Manifesto MU-KOMIK tentang kreativitas, teknologi, dan masa depan komik.";
  const canonical = new URL("/manifesto", siteUrl).toString();
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical } };
}

const principles = [
  {
    title: "Kreativitas tetap milik manusia",
    paragraphs: [
      <>Ide, sudut pandang, karakter, emosi, humor, dan pesan sebuah cerita berasal dari kreator.</>,
      <>AI adalah alat.</>,
      <>Kreator tetap menjadi pengarah, pengambil keputusan, dan pemilik visi kreatif.</>,
    ],
  },
  {
    title: "AI mempercepat, bukan menggantikan",
    paragraphs: [
      <>Kami menggunakan AI untuk membantu proses yang melelahkan dan memakan waktu:</>,
      <strong key="workflow">ide → naskah → storyboard → visual → produksi → publikasi</strong>,
      <>Dengan AI, kreator dapat bereksperimen lebih cepat, mencoba lebih banyak kemungkinan, dan memiliki lebih banyak waktu untuk fokus pada hal yang paling penting: <strong>bercerita.</strong></>,
    ],
  },
  {
    title: "Cerita harus tetap manusiawi",
    paragraphs: [
      <>Teknologi boleh semakin canggih. Tetapi cerita tidak boleh kehilangan jiwa.</>,
      <>Kami percaya komik yang baik bukan hanya tentang gambar yang indah. Ia tentang karakter yang terasa hidup. Tentang dialog yang terasa dekat. Tentang humor yang mengena. Tentang cerita yang membuat pembaca berkata:</>,
      <strong key="quote">“Ini gue banget.”</strong>,
    ],
  },
  {
    title: "AI bukan alasan untuk meniru",
    paragraphs: [
      <>Kami mendorong kreator untuk membangun identitas visual dan cerita mereka sendiri.</>,
      <>AI seharusnya membuka ruang eksplorasi, bukan menjadi jalan pintas untuk menyalin karya orang lain.</>,
      <strong key="originality">Terinspirasi boleh. Meniru bukan tujuan. Menjadi orisinal adalah perjalanan.</strong>,
    ],
  },
  {
    title: "Transparansi adalah bagian dari karya",
    paragraphs: [
      <>Kami percaya pembaca berhak mengetahui bagaimana sebuah karya dibuat. Penggunaan AI tidak perlu disembunyikan.</>,
      <>AI adalah bagian dari proses kreatif modern, sebagaimana kamera, komputer, software gambar, dan alat produksi lainnya.</>,
      <>Yang penting adalah: <strong>siapa yang memiliki visi, siapa yang bertanggung jawab, dan apa yang ingin disampaikan.</strong></>,
    ],
  },
  {
    title: "Kreator tetap memegang kendali",
    paragraphs: [
      <>AI boleh memberikan pilihan. AI boleh memberikan saran. AI boleh membantu membuat sesuatu.</>,
      <>Tetapi keputusan terakhir tetap berada di tangan kreator.</>,
      <strong key="control">Kreator menentukan cerita. Kreator menentukan karakter. Kreator menentukan arah. Kreator menentukan kapan sebuah karya selesai.</strong>,
    ],
  },
  {
    title: "Teknologi harus membuka kesempatan",
    paragraphs: [
      <>Kami ingin teknologi membuat dunia komik menjadi lebih terbuka.</>,
      <>Seseorang yang tidak memiliki studio besar tetap bisa membuat serial. Seseorang yang bekerja sendirian tetap bisa membangun dunia. Seseorang dengan ide sederhana tetap memiliki kesempatan untuk menemukan pembacanya.</>,
      <strong key="opportunity">Bukan hanya mereka yang memiliki modal besar. Tetapi siapa pun yang memiliki cerita.</strong>,
    ],
  },
];

export default function ManifestoPage() {
  return (
    <main className="manifesto-page">
      <nav className="manifesto-nav">
        <BrandLogo linked showName />
        <Link href="/" className="manifesto-back"><ArrowLeft size={16} /> <LocalizedContent>Beranda</LocalizedContent></Link>
      </nav>

      <header className="manifesto-hero">
        <p className="manifesto-eyebrow"><LocalizedContent>PANDANGAN KAMI TENTANG MASA DEPAN KOMIK</LocalizedContent></p>
        <h1>Manifesto AI<br /><em>MU-KOMIK</em></h1>
        <p className="manifesto-lead"><LocalizedContent>AI untuk bercerita.<br /><strong>Manusia untuk menciptakan makna.</strong></LocalizedContent></p>
        <div className="manifesto-origin">
          <p><LocalizedContent>Kami percaya setiap komik lahir dari sebuah gagasan.</LocalizedContent></p>
          <p><LocalizedContent>Dari pengalaman. Dari imajinasi. Dari kegelisahan. Dari tawa. Dari kehidupan sehari-hari.</LocalizedContent></p>
          <p><LocalizedContent>AI hadir bukan untuk mengambil alih cerita itu.</LocalizedContent></p>
          <strong><LocalizedContent>AI hadir untuk membantu kreator mewujudkannya.</LocalizedContent></strong>
        </div>
      </header>

      <section className="manifesto-principles">
        {principles.map((principle, index) => (
          <article className="manifesto-principle" key={principle.title}>
            <span className="manifesto-number">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2><LocalizedContent>{principle.title}</LocalizedContent></h2>
              {principle.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`${principle.title}-${paragraphIndex}`}><LocalizedContent>{paragraph}</LocalizedContent></p>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="manifesto-human-ai">
        <p className="manifesto-eyebrow"><LocalizedContent>AI + MANUSIA</LocalizedContent></p>
        <h2><LocalizedContent>Kami tidak percaya masa depan komik adalah<br /><span>AI menggantikan manusia.</span></LocalizedContent></h2>
        <h2><LocalizedContent>Kami percaya masa depan komik adalah<br /><strong>manusia yang menjadi lebih kuat karena AI.</strong></LocalizedContent></h2>
        <div className="manifesto-contrast">
          <p><LocalizedContent>AI memberikan kecepatan.<br /><strong>Manusia memberikan arah.</strong></LocalizedContent></p>
          <p><LocalizedContent>AI membantu menghasilkan kemungkinan.<br /><strong>Manusia memilih mana yang bermakna.</strong></LocalizedContent></p>
          <p><LocalizedContent>AI membantu membuat.<br /><strong>Manusia menentukan apa yang layak diceritakan.</strong></LocalizedContent></p>
        </div>
      </section>

      <section className="manifesto-home">
        <p className="manifesto-eyebrow">MU-KOMIK</p>
        <h2><LocalizedContent>Tempat cerita menemukan rumahnya.</LocalizedContent></h2>
        <p><LocalizedContent>Kami membangun MU-KOMIK untuk para pencipta dunia.</LocalizedContent></p>
        <p><LocalizedContent>Dunia yang lucu. Dunia yang absurd. Dunia yang dekat dengan kehidupan. Dunia yang belum pernah diceritakan.</LocalizedContent></p>
        <p><LocalizedContent>Dengan teknologi AI, kami ingin membuat proses menciptakan komik menjadi lebih mudah, lebih cepat, dan lebih terbuka.</LocalizedContent></p>
        <blockquote><LocalizedContent>
          Di balik setiap cerita yang berarti, selalu ada manusia yang ingin mengatakan sesuatu.
          <strong>MU-KOMIK percaya pada manusia itu.</strong>
        </LocalizedContent></blockquote>
      </section>

      <footer className="manifesto-footer">
        <BrandLogo linked />
        <Link href="/" className="manifesto-back"><LocalizedContent>Kembali ke MU-KOMIK</LocalizedContent> <ArrowUpRight size={16} /></Link>
      </footer>
    </main>
  );
}
