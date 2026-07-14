import React from 'react';

/** Conteneur scrollable horizontal pour tables larges (mobile / admin). */
export default function TableScroll({
  children,
  minWidth = 640,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="table-scroll-shell">
      <div className="table-scroll-hint" aria-hidden>
        ← glisser pour voir toutes les colonnes →
      </div>
      <div className="table-scroll-x">
        <div style={{ minWidth }}>
          {children}
        </div>
      </div>
    </div>
  );
}
