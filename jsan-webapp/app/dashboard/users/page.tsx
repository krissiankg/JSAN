import Topbar from "@/components/Topbar";

export default function UsersPage() {
  return (
    <main className="dashboard-main">
      <Topbar title="Gestion des Utilisateurs" />
      <div className="dashboard-content">
        <div className="filter-tabs" style={{ marginBottom: '20px' }}>
          <button className="tab-btn active">Tous</button>
          <button className="tab-btn">Auteurs</button>
          <button className="tab-btn">Évaluateurs</button>
          <button className="tab-btn">Administrateurs</button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Marie Curie</strong></td>
                <td>marie@lab.fr</td>
                <td><span className="status-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>Auteur</span></td>
                <td><span className="status-badge" style={{ background: '#dcfce7', color: '#166534' }}>Actif</span></td>
                <td className="options-cell"><button className="btn btn-outline btn-sm">Gérer</button></td>
              </tr>
              <tr>
                <td><strong>Dr. Smith</strong></td>
                <td>smith@eval.org</td>
                <td><span className="status-badge" style={{ background: '#f3e8ff', color: '#7e22ce' }}>Évaluateur</span></td>
                <td><span className="status-badge" style={{ background: '#dcfce7', color: '#166534' }}>Actif</span></td>
                <td className="options-cell"><button className="btn btn-outline btn-sm">Gérer</button></td>
              </tr>
              <tr>
                <td><strong>Admin Principal</strong></td>
                <td>admin@jsan.org</td>
                <td><span className="status-badge" style={{ background: '#fef3c7', color: '#b45309' }}>Administrateur</span></td>
                <td><span className="status-badge" style={{ background: '#dcfce7', color: '#166534' }}>Actif</span></td>
                <td className="options-cell"><button className="btn btn-outline btn-sm">Gérer</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
