/**
 * Identité visuelle JSAN — dérivée du logo (engrenage vert + accents jaune / rouge-orangé).
 * Utiliser ces tokens plutôt que des bleus/violets génériques.
 */
export const JSAN_BRAND = {
  green: '#1B6B2E',
  greenDark: '#145224',
  greenDeep: '#0F2E18',
  greenSoft: '#E8F5EC',
  greenMuted: '#3D8A4F',
  yellow: '#F0C419',
  yellowDark: '#C9A010',
  yellowSoft: '#FFF8E1',
  red: '#D94A2A',
  redDark: '#B53A1F',
  redSoft: '#FDECEA',
  ink: '#0F1F14',
} as const;

export type JsanBrandColor = (typeof JSAN_BRAND)[keyof typeof JSAN_BRAND];
