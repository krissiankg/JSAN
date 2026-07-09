import Topbar from "@/components/Topbar";

export default function FilesPage() {
  return (
    <main className="dashboard-main">
      <Topbar title="Gestion des Pièces Jointes" />
      <div className="dashboard-content">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fichier</th>
                <th>ID Résumé</th>
                <th>Soumis par</th>
                <th>Date</th>
                <th>Taille</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span style={{ color: '#ef4444', fontWeight: 600 }}>PDF</span> Abstract_Nutrition_v1.pdf</td>
                <td>#1042</td>
                <td>Marie Curie</td>
                <td>12 Oct 2024</td>
                <td>2.4 MB</td>
                <td className="options-cell">
                  <button className="btn btn-outline btn-sm">Télécharger</button>
                </td>
              </tr>
              <tr>
                <td><span style={{ color: '#3b82f6', fontWeight: 600 }}>DOCX</span> Etude_Clinique_Final.docx</td>
                <td>#1043</td>
                <td>Jean Dupont</td>
                <td>14 Oct 2024</td>
                <td>1.1 MB</td>
                <td className="options-cell">
                  <button className="btn btn-outline btn-sm">Télécharger</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
