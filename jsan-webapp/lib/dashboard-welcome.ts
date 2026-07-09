import type { AppUserRole, DbUserRole } from '@/lib/roles';
import { isEvaluatorApproved } from '@/lib/roles';

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
        accentColor: '#2563eb',
      };
    case 'auteur':
      return {
        spaceLabel: 'Espace Auteur',
        welcomeSubtitle:
          'Inscription, billets et justificatifs — puis soumettez et suivez vos résumés scientifiques.',
        accentColor: '#1e3a5f',
      };
    case 'pair':
      return {
        spaceLabel: dbRole && isEvaluatorApproved(dbRole)
          ? 'Espace Évaluateur'
          : 'Espace Évaluateur (en attente de validation)',
        welcomeSubtitle: dbRole && isEvaluatorApproved(dbRole)
          ? 'Consultez le programme, évaluez les soumissions qui vous sont assignées et suivez votre activité.'
          : 'Votre candidature est en cours d\'examen. En attendant, gérez votre profil et votre inscription à l\'événement.',
        accentColor: '#7c3aed',
      };
    case 'organisateur':
      return {
        spaceLabel: 'Espace Organisateur',
        welcomeSubtitle:
          'Pilotez les soumissions, le programme, les inscriptions et les finances des JSAN 2025.',
        accentColor: '#dc2626',
      };
    case 'superadmin':
      return {
        spaceLabel: 'Espace Super Admin',
        welcomeSubtitle:
          'Administration complète de la plateforme JSAN : configuration, utilisateurs et supervision globale.',
        accentColor: '#7c3aed',
      };
    default:
      return {
        spaceLabel: 'Espace JSAN',
        welcomeSubtitle: 'Bienvenue sur la plateforme des Journées Scientifiques de l\'Alimentation et de la Nutrition.',
        accentColor: '#2563eb',
      };
  }
}

export function getDisplayName(prenom?: string | null, nom?: string | null, fallback = 'Utilisateur'): string {
  const name = [prenom, nom].filter(Boolean).join(' ').trim();
  return name || fallback;
}
