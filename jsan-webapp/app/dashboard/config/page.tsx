import Topbar from "@/components/Topbar";

export default function ConfigPage() {
  return (
    <main className="dashboard-main">
      <Topbar title="Configuration de l'Événement" />
      <div className="dashboard-content">
        
        <div className="config-card">
          <h2 style={{ fontFamily: 'Outfit', fontSize: '20px', marginBottom: '20px', color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Informations Générales de l'Événement</h2>
          <form>
            <div className="form-group">
              <label htmlFor="event-name">Nom de l'édition (ex: JSAN 2025, JSAN 2026...)</label>
              <input type="text" id="event-name" name="event-name" placeholder="Saisir le nom de l'événement..." style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 'var(--radius-md, 8px)', fontFamily: "'Inter', sans-serif", marginBottom: '15px' }} />
            </div>
            <div className="grid-dates">
              <div className="form-group">
                <label htmlFor="event-start">Date de début de l'événement</label>
                <input type="date" id="event-start" name="event-start" />
              </div>
              <div className="form-group">
                <label htmlFor="event-end">Date de fin de l'événement</label>
                <input type="date" id="event-end" name="event-end" />
              </div>
            </div>
          </form>
        </div>

        <div className="config-card">
          <h2 style={{ fontFamily: 'Outfit', fontSize: '20px', marginBottom: '20px', color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Soumissions Scientifiques (Abstracts)</h2>
          <form>
            <div className="form-group">
              <label htmlFor="submission-start">Date d'ouverture des soumissions</label>
              <input type="date" id="submission-start" name="submission-start" />
            </div>
            <div className="form-group">
              <label htmlFor="submission-deadline">Date limite de soumission stricte</label>
              <input type="date" id="submission-deadline" name="submission-deadline" />
            </div>
            <div className="form-group">
              <label htmlFor="submission-results">Date d'annonce des résultats aux auteurs</label>
              <input type="date" id="submission-results" name="submission-results" />
            </div>
            
            <div style={{ marginTop: '30px', textAlign: 'right' }}>
              <button type="button" className="btn-save" style={{ background: 'var(--primary-color)', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Enregistrer la configuration</button>
            </div>
          </form>
        </div>

      </div>
    </main>
  );
}
