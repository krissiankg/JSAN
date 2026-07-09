/** Rôles stockés en base (enum user_role PostgreSQL) */
export type DbUserRole =
  | 'participant'
  | 'auteur'
  | 'pair_en_attente'
  | 'pair_valide'
  | 'organisateur'
  | 'superadmin'
  | 'admin';

/** Rôles utilisés par l'interface (dashboards) */
export type AppUserRole =
  | 'participant'
  | 'auteur'
  | 'pair'
  | 'organisateur'
  | 'superadmin';

export type RegisterRole = 'participant' | 'auteur' | 'pair';

export interface NotificationPreferences {
  email_evenement: boolean;
  email_billetterie: boolean;
  email_messagerie: boolean;
  email_soumissions: boolean;
  app_evenement: boolean;
  app_billetterie: boolean;
  app_messagerie: boolean;
  app_soumissions: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_evenement: true,
  email_billetterie: true,
  email_messagerie: true,
  email_soumissions: false,
  app_evenement: true,
  app_billetterie: true,
  app_messagerie: true,
  app_soumissions: true,
};

export interface UserProfile {
  id: string;
  role: DbUserRole;
  nom: string | null;
  prenom: string | null;
  institution: string | null;
  telephone: string | null;
  specialite: string | null;
  bio: string | null;
  is_student_verified: boolean;
  is_member_verified: boolean;
  notification_preferences?: NotificationPreferences | null;
  registration_email_sent_at?: string | null;
  welcome_email_sent_at?: string | null;
  created_at: string;
}

/** Convertit le rôle BDD → rôle affiché dans l'app */
export function mapDbRoleToAppRole(dbRole: DbUserRole): AppUserRole {
  switch (dbRole) {
    case 'participant':
      return 'participant';
    case 'auteur':
      return 'auteur';
    case 'pair_en_attente':
    case 'pair_valide':
      return 'pair';
    case 'organisateur':
      return 'organisateur';
    case 'superadmin':
    case 'admin':
      return 'superadmin';
    default:
      return 'participant';
  }
}

/** Évaluateur validé par l'organisateur */
export function isEvaluatorApproved(dbRole: DbUserRole): boolean {
  return dbRole === 'pair_valide';
}

/** Accès admin événement (soumissions, programme, paiements…) */
export function isEventStaff(appRole: AppUserRole | null): boolean {
  return appRole === 'organisateur' || appRole === 'superadmin';
}

/** Accès configuration plateforme (SuperAdmin uniquement) */
export function isSuperAdmin(appRole: AppUserRole | null): boolean {
  return appRole === 'superadmin';
}

/** Rôle à enregistrer en BDD lors de l'inscription */
export function registerRoleToDbRole(role: RegisterRole): DbUserRole {
  switch (role) {
    case 'participant':
      return 'participant';
    case 'auteur':
      return 'auteur';
    case 'pair':
      return 'pair_en_attente';
  }
}

/** Redirection après connexion selon le rôle */
export function getDashboardHomePath(
  appRole: AppUserRole,
  dbRole: DbUserRole
): string {
  switch (appRole) {
    case 'participant':
      return '/dashboard';
    case 'auteur':
      return '/dashboard/mes-resumes';
    case 'pair':
      return isEvaluatorApproved(dbRole)
        ? '/dashboard/resumes-a-evaluer'
        : '/dashboard/mes-resumes';
    case 'organisateur':
    case 'superadmin':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}

export function getRoleLabel(appRole: AppUserRole | null): string {
  switch (appRole) {
    case 'participant':
      return 'Participant';
    case 'auteur':
      return 'Auteur';
    case 'pair':
      return 'Évaluateur';
    case 'organisateur':
      return 'Organisateur';
    case 'superadmin':
      return 'Super Admin';
    default:
      return 'Utilisateur';
  }
}
