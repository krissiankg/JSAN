import Link from 'next/link';

interface SidebarProps {
  role: 'author' | 'evaluator' | 'admin' | 'organizer';
  userName: string;
  userInitials: string;
  userEmail: string;
}

export default function Sidebar({ role, userName, userInitials, userEmail }: SidebarProps) {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-logo">
        <img 
          src="/media/media_library/logo-jsan.png" 
          alt="JSAN Logo" 
          style={{ height: '40px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} 
        />
      </div>

      {/* Rôle Organisateur / Super Admin */}
      {(role === 'organizer' || role === 'admin') && (
        <>
          <div className="sidebar-section-title">Espace Organisateur</div>
          <nav className="sidebar-nav">
            <ul>
              <li><Link href="/dashboard" className="active"><span className="icon">📊</span> Vue Globale & Résumés</Link></li>
              <li><Link href="/dashboard/users"><span className="icon">👥</span> Gestion Utilisateurs</Link></li>
              <li><Link href="/dashboard/files"><span className="icon">📁</span> Pièces Jointes</Link></li>
              {role === 'admin' && (
                <li><Link href="/dashboard/config"><span className="icon">⚙️</span> Configuration Événement</Link></li>
              )}
            </ul>
          </nav>
        </>
      )}

      {/* Rôle Évaluateur */}
      {(role === 'evaluator' || role === 'organizer') && (
        <>
          <div className="sidebar-section-title" style={{ marginTop: role === 'organizer' ? '15px' : '0' }}>
            Espace Évaluateur
          </div>
          <nav className="sidebar-nav">
            <ul>
              <li><Link href="/dashboard/evaluations"><span className="icon">📝</span> Mes Évaluations <span className="badge" style={{ backgroundColor: 'var(--primary-color)' }}>2</span></Link></li>
            </ul>
          </nav>
        </>
      )}

      {/* Rôle Auteur */}
      {(role === 'author' || role === 'evaluator' || role === 'organizer') && (
        <>
          <div className="sidebar-section-title" style={{ marginTop: (role === 'organizer' || role === 'evaluator') ? '15px' : '0' }}>
            Espace Auteur
          </div>
          <nav className="sidebar-nav">
            <ul>
              <li><Link href="/dashboard/my-abstracts"><span className="icon">📄</span> Mes Résumés</Link></li>
              <li><Link href="/dashboard/submit"><span className="icon">➕</span> Nouvelle Soumission</Link></li>
            </ul>
          </nav>
        </>
      )}

      <div className="sidebar-footer">
        <div className="user-role-label" style={{ color: role === 'admin' ? '#f59e0b' : (role === 'organizer' ? '#10b981' : '#7e22ce') }}>
          {role === 'admin' && 'Super Administrateur >'}
          {role === 'organizer' && 'Organisateur / Comité >'}
          {role === 'evaluator' && 'Évaluateur Scientifique >'}
          {role === 'author' && 'Auteur >'}
        </div>
        <div className="user-profile">
          <div className="user-avatar" style={{ backgroundColor: role === 'admin' ? '#f59e0b' : (role === 'organizer' ? '#10b981' : '#7e22ce') }}>
            {userInitials}
          </div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-email">{userEmail}</span>
          </div>
        </div>
        <Link href="/login" className="logout-btn">
          <span className="icon">🚪</span> Déconnexion
        </Link>
      </div>
    </aside>
  );
}
