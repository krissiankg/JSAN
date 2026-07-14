import Link from 'next/link';
import '../styles/blog.css';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="blog-shell">
      <header className="blog-header">
        <div className="blog-header-inner">
          <Link href="/" className="blog-brand">
            <img src="/media/media_library/logo-jsan.png" alt="JSAN" />
          </Link>
          <nav className="blog-nav">
            <Link href="/">Accueil</Link>
            <Link href="/blog" className="active">Blog</Link>
            <Link href="/login">Connexion</Link>
          </nav>
        </div>
      </header>
      <main className="blog-main">{children}</main>
      <footer className="blog-footer">
        <p>
          © {new Date().getFullYear()} SNB · JSAN — Version 2.0
          {' · '}
          Conçu par{' '}
          <a href="https://guelichweb.online/" target="_blank" rel="noopener noreferrer">
            Guelichweb
          </a>
        </p>
      </footer>
    </div>
  );
}
