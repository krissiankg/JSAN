"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  type Abstract,
  ABSTRACT_SELECT,
  abstractStatusLabel,
  abstractStatusStyle,
  formatAbstractDate,
  formatCoAuthors,
} from '@/lib/abstracts';
import { getAbstractFileSignedUrl } from '@/lib/abstract-files';
import TableScroll from '@/components/dashboard/TableScroll';

export default function MesResumesSoumis() {
  const { user } = useAuth();
  const supabase = createClient();

  const [data, setData] = useState<Abstract[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    titre: true,
    motsCles: true,
    thematique: true,
    fichier: true,
    coAuteurs: true,
    statut: true,
    date: true,
  });

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data: rows } = await supabase
        .from('abstracts')
        .select(ABSTRACT_SELECT)
        .eq('author_id', user.id)
        .neq('statut', 'Brouillon')
        .order('created_at', { ascending: false });
      if (rows) setData(rows as Abstract[]);
      setLoading(false);
    }
    load();
  }, [user, supabase]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    const items = [...data];
    if (!sortConfig.key) return items;
    items.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortConfig.key) {
        case 'titre': aVal = a.titre; bVal = b.titre; break;
        case 'motsCles': aVal = a.mots_cles ?? ''; bVal = b.mots_cles ?? ''; break;
        case 'thematique': aVal = a.thematique ?? ''; bVal = b.thematique ?? ''; break;
        case 'statut': aVal = a.statut; bVal = b.statut; break;
        case 'date': aVal = new Date(a.created_at).getTime(); bVal = new Date(b.created_at).getTime(); break;
        default: aVal = a.id; bVal = b.id;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [data, sortConfig]);

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownload = async (storagePath: string) => {
    const url = await getAbstractFileSignedUrl(supabase, storagePath);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderSortIndicator = (key: string) => {
    if (sortConfig.key === key) return sortConfig.direction === 'asc' ? ' 🔼' : ' 🔽';
    return ' ↕️';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Consultez la liste de tous vos résumés officiellement soumis au comité scientifique.
        </p>
        <Link href="/dashboard/nouvelle-soumission" style={{ background: '#111827', color: '#ffffff', padding: '6px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 500, fontSize: '13px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          ➕ Nouveau Résumé
        </Link>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', position: 'relative' }}>
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '8px', color: '#475569', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ⚙️ Affichage des colonnes
          </button>
          {showColumnMenu && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10, width: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '5px' }}>Colonnes visibles</div>
              {Object.entries(visibleColumns).map(([key, isVisible]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isVisible} onChange={() => toggleColumn(key as keyof typeof visibleColumns)} />
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                </label>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <p style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Chargement…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <TableScroll minWidth={900}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>
                  {visibleColumns.id && <th onClick={() => handleSort('id')} style={{ paddingBottom: '10px', fontWeight: 500, cursor: 'pointer', fontSize: '12px' }}>Identité{renderSortIndicator('id')}</th>}
                  {visibleColumns.titre && <th onClick={() => handleSort('titre')} style={{ paddingBottom: '10px', fontWeight: 500, cursor: 'pointer', fontSize: '12px' }}>Titre{renderSortIndicator('titre')}</th>}
                  {visibleColumns.motsCles && <th onClick={() => handleSort('motsCles')} style={{ paddingBottom: '10px', fontWeight: 500, cursor: 'pointer', fontSize: '12px' }}>Mots-clés{renderSortIndicator('motsCles')}</th>}
                  {visibleColumns.thematique && <th onClick={() => handleSort('thematique')} style={{ paddingBottom: '10px', fontWeight: 500, cursor: 'pointer', fontSize: '12px' }}>Thématique{renderSortIndicator('thematique')}</th>}
                  {visibleColumns.fichier && <th style={{ paddingBottom: '10px', fontWeight: 500, textAlign: 'center', fontSize: '12px' }}>Fichier</th>}
                  {visibleColumns.coAuteurs && <th style={{ paddingBottom: '10px', fontWeight: 500, fontSize: '12px' }}>Co-auteurs</th>}
                  {visibleColumns.statut && <th onClick={() => handleSort('statut')} style={{ paddingBottom: '10px', fontWeight: 500, textAlign: 'center', cursor: 'pointer', fontSize: '12px' }}>Statut{renderSortIndicator('statut')}</th>}
                  {visibleColumns.date && <th onClick={() => handleSort('date')} style={{ paddingBottom: '10px', fontWeight: 500, textAlign: 'right', cursor: 'pointer', fontSize: '12px' }}>Date{renderSortIndicator('date')}</th>}
                  <th style={{ paddingBottom: '10px', fontWeight: 500, textAlign: 'right', fontSize: '12px' }}>Détail</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((item) => {
                  const statusStyle = abstractStatusStyle(item.statut);
                  const fileName = item.abstract_files?.[0]?.file_name;
                  const filePath = item.abstract_files?.[0]?.file_url;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {visibleColumns.id && <td style={{ padding: '12px 10px 12px 0', color: '#475569', fontWeight: 600, fontSize: '12px', verticalAlign: 'top' }}>{item.id.slice(0, 8)}…</td>}
                      {visibleColumns.titre && (
                        <td style={{ padding: '12px 15px 12px 0', verticalAlign: 'top' }}>
                          <Link href={`/dashboard/mes-resumes/${item.id}`} style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.4, fontSize: '13px', textDecoration: 'none' }}>
                            {item.titre}
                          </Link>
                        </td>
                      )}
                      {visibleColumns.motsCles && <td style={{ padding: '12px 15px 12px 0', color: '#64748b', fontSize: '12px', verticalAlign: 'top' }}>{item.mots_cles ?? '—'}</td>}
                      {visibleColumns.thematique && <td style={{ padding: '12px 15px 12px 0', verticalAlign: 'top' }}><span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>{item.thematique ?? '—'}</span></td>}
                      {visibleColumns.fichier && (
                        <td style={{ padding: '12px 10px 12px 0', textAlign: 'center', verticalAlign: 'top', fontSize: '12px', color: '#64748b' }}>
                          {fileName && filePath ? (
                            <button
                              type="button"
                              onClick={() => handleDownload(filePath)}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#1B6B2E', cursor: 'pointer', fontSize: '12px' }}
                            >
                              📄 {fileName}
                            </button>
                          ) : fileName ? (
                            `📄 ${fileName}`
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {visibleColumns.coAuteurs && <td style={{ padding: '12px 15px 12px 0', color: '#64748b', fontSize: '12px', verticalAlign: 'top' }}>{formatCoAuthors(item.abstract_authors)}</td>}
                      {visibleColumns.statut && (
                        <td style={{ padding: '12px 10px 12px 0', textAlign: 'center', verticalAlign: 'top' }}>
                          <span style={{ ...statusStyle, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, display: 'inline-block', whiteSpace: 'nowrap' }}>
                            {abstractStatusLabel(item.statut)}
                          </span>
                        </td>
                      )}
                      {visibleColumns.date && <td style={{ padding: '12px 0', textAlign: 'right', color: '#64748b', fontSize: '13px', verticalAlign: 'top' }}>{formatAbstractDate(item.created_at)}</td>}
                      <td style={{ padding: '12px 0', textAlign: 'right', verticalAlign: 'top' }}>
                        <Link href={`/dashboard/mes-resumes/${item.id}`} style={{ fontSize: '12px', color: '#1B6B2E', fontWeight: 500, textDecoration: 'none' }}>
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {sortedData.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      Aucun résumé soumis. <Link href="/dashboard/nouvelle-soumission" style={{ color: '#1B6B2E' }}>Créer une soumission</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableScroll>
          </div>
        )}
      </div>
    </div>
  );
}
