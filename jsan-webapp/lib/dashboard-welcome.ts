import type { AppUserRole, DbUserRole } from '@/lib/roles';
import { isEvaluatorApproved } from '@/lib/roles';
import { JSAN_BRAND } from '@/lib/brand';

export interface DashboardWelcomeConfig {
  spaceLabel: string;
  welcomeSubtitle: string;
  accentColor: string;
}

export function getDashboardWelcomeConfig(
  appRole: AppUserRole | null,
  dbRole: DbUserRole | null
): DashboardWelcomeConfig {
  switch (appRole) {
    case 'participant':
      return {
        spaceLabel: 'Espace Participant',
        welcomeSubtitle:
          'Gérez votre inscription, vos billets et vos justificatifs pour les JSAN 2025.',
        accentColor: JSAN_BRAND.green,
      };
    case 'auteur':
      return {
        spaceLabel: 'Espace Auteur',
        welcomeSubtitle:
          'Inscription, billets et justificatifs — puis soumettez et suivez vos résumés scientifiques.',
        accentColor: JSAN_BRAND.greenDark,
      };
    case 'pair':
      return {
        spaceLabel: dbRole && isEvaluatorApproved(dbRole)
          ? 'Espace Évaluateur'
          : 'Espace Évaluateur (en attente de validation)',
        welcomeSubtitle: dbRole && isEvaluatorApproved(dbRole)
          ? 'Consultez le programme, évaluez les soumissions qui vous sont assignées et suivez votre activité.'
          : 'Votre candidature est en cours d\'examen. En attendant, gérez votre profil et votre inscription à l\'événement.',
        accentColor: JSAN_BRAND.yellowDark,
      };
    case 'organisateur':
      return {
        spaceLabel: 'Espace Organisateur',
        welcomeSubtitle:
          'Pilotez les soumissions, le programme, les inscriptions et les finances des JSAN 2025.',
        accentColor: JSAN_BRAND.red,
      };
    case 'superadmin':
      return {
        spaceLabel: 'Espace Super Admin',
        welcomeSubtitle:
          'Administration complète de la plateforme JSAN : configuration, utilisateurs et supervision globale.',
        accentColor: JSAN_BRAND.greenDark,
      };
    default:
      return {
        spaceLabel: 'Espace JSAN',
        welcomeSubtitle: 'Bienvenue sur la plateforme des Journées Scientifiques de l\'Alimentation et de la Nutrition.',
        accentColor: JSAN_BRAND.green,
      };
  }
}

export function getDisplayName(prenom?: string | null, nom?: string | null, fallback = 'Utilisateur'): string {
  const name = [prenom, nom].filter(Boolean).join(' ').trim();
  return name || fallback;
}
