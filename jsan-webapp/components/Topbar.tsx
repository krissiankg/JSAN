interface TopbarProps {
  title: string;
}

export default function Topbar({ title }: TopbarProps) {
  return (
    <header className="dashboard-topbar">
      <div className="topbar-left">
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <div className="topbar-search">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher..." />
        </div>
        <button className="icon-btn">🔔</button>
      </div>
    </header>
  );
}
