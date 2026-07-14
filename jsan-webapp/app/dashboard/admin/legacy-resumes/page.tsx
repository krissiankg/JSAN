import { redirect } from 'next/navigation';

/** Ancien outil d’import legacy — désactivé (tous les résumés sont rattachés). */
export default function AdminLegacyResumesPage() {
  redirect('/dashboard/admin/bibliotheque');
}
