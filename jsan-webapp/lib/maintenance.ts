import type { SupabaseClient } from '@supabase/supabase-js';
import { type DbUserRole, isEventStaff, mapDbRoleToAppRole } from '@/lib/roles';

export const DEFAULT_MAINTENANCE_MESSAGE =
  'La plateforme JSAN est en cours de préparation. Nous revenons très bientôt.';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

export interface MaintenanceSettings {
  id: string;
  maintenance_mode: boolean;
  maintenance_message: string | null;
}

export function isMaintenanceForcedByEnv(): boolean {
  return (process.env.MAINTENANCE_MODE ?? '').trim().toLowerCase() === 'true';
}

export function maintenanceMessageFromEnv(): string {
  const custom = (process.env.MAINTENANCE_MESSAGE ?? '').trim();
  return custom || DEFAULT_MAINTENANCE_MESSAGE;
}

export function isStaffDbRole(role: DbUserRole | null | undefined): boolean {
  return role === 'organisateur' || role === 'superadmin' || role === 'admin';
}

export function canBypassMaintenance(dbRole: DbUserRole | null | undefined): boolean {
  return isStaffDbRole(dbRole);
}

export function shouldBlockAppRoleDuringMaintenance(
  dbRole: DbUserRole | null | undefined
): boolean {
  if (!dbRole) return true;
  return !canBypassMaintenance(dbRole);
}

export async function fetchMaintenanceStatusFromApi(): Promise<MaintenanceStatus> {
  if (isMaintenanceForcedByEnv()) {
    return { enabled: true, message: maintenanceMessageFromEnv() };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_site_maintenance`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });

    if (!res.ok) {
      return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
    }

    const rows = (await res.json()) as Array<{ enabled: boolean; message: string }>;
    const row = rows[0];
    if (!row) {
      return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
    }

    return {
      enabled: Boolean(row.enabled),
      message: row.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
    };
  } catch {
    return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
  }
}

export async function fetchMaintenanceSettings(
  supabase: SupabaseClient
): Promise<MaintenanceSettings | null> {
  const { data } = await supabase
    .from('events_config')
    .select('id, maintenance_mode, maintenance_message')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as MaintenanceSettings | null;
}

export async function updateMaintenanceSettings(
  supabase: SupabaseClient,
  configId: string,
  input: { enabled: boolean; message?: string }
): Promise<string | null> {
  const payload: Record<string, unknown> = {
    maintenance_mode: input.enabled,
  };
  if (input.message !== undefined) {
    payload.maintenance_message = input.message.trim() || DEFAULT_MAINTENANCE_MESSAGE;
  }

  const { error } = await supabase
    .from('events_config')
    .update(payload)
    .eq('id', configId);

  return error?.message ?? null;
}

export function maintenanceBypassLabel(dbRole: DbUserRole | null | undefined): string {
  const appRole = dbRole ? mapDbRoleToAppRole(dbRole) : null;
  if (isEventStaff(appRole)) return 'Accès organisateur actif pendant la maintenance.';
  return '';
}
