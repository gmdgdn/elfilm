import type { Env } from "../env";
import { queryAll } from "../db";

export interface SystemSettingRow {
  key: string;
  value: string;
  value_type: string;
  description: string | null;
  updated_at: string;
}

export interface AdminSettingsSnapshot {
  maintenanceMode: boolean;
  debugMode: boolean;
  publicRegistration: boolean;
  cacheTtl: number;
}

const defaultSettings: AdminSettingsSnapshot = {
  maintenanceMode: false,
  debugMode: false,
  publicRegistration: false,
  cacheTtl: 3600,
};

const settingDefinitions = [
  {
    key: "maintenance_mode",
    toValue: (settings: AdminSettingsSnapshot) => settings.maintenanceMode,
    apply: (settings: AdminSettingsSnapshot, rawValue: unknown) => {
      settings.maintenanceMode = Boolean(rawValue);
    },
    description: "Enable maintenance mode for public traffic.",
  },
  {
    key: "debug_mode",
    toValue: (settings: AdminSettingsSnapshot) => settings.debugMode,
    apply: (settings: AdminSettingsSnapshot, rawValue: unknown) => {
      settings.debugMode = Boolean(rawValue);
    },
    description: "Expose verbose diagnostics for admin troubleshooting.",
  },
  {
    key: "public_registration",
    toValue: (settings: AdminSettingsSnapshot) => settings.publicRegistration,
    apply: (settings: AdminSettingsSnapshot, rawValue: unknown) => {
      settings.publicRegistration = Boolean(rawValue);
    },
    description: "Allow future public registration workflows.",
  },
  {
    key: "cache_ttl",
    toValue: (settings: AdminSettingsSnapshot) => settings.cacheTtl,
    apply: (settings: AdminSettingsSnapshot, rawValue: unknown) => {
      const parsed = Number(rawValue);
      settings.cacheTtl = Number.isFinite(parsed) ? parsed : defaultSettings.cacheTtl;
    },
    description: "Default cache TTL for archive responses, in seconds.",
  },
];

function parseStoredValue(row: SystemSettingRow) {
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export async function getSystemSettings(env: Env): Promise<AdminSettingsSnapshot> {
  const rows = await queryAll<SystemSettingRow>(
    env,
    "SELECT key, value, value_type, description, updated_at FROM system_settings"
  );
  const nextSettings = { ...defaultSettings };

  for (const definition of settingDefinitions) {
    const row = rows.find((candidate) => candidate.key === definition.key);
    if (row) {
      definition.apply(nextSettings, parseStoredValue(row));
    }
  }

  return nextSettings;
}

export async function updateSystemSettings(
  env: Env,
  patch: Partial<AdminSettingsSnapshot>
) {
  const nextSettings = {
    ...(await getSystemSettings(env)),
    ...patch,
  };

  await env.DB.batch(
    settingDefinitions.map((definition) =>
      env.DB.prepare(
        `INSERT INTO system_settings (key, value, value_type, description, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           value_type = excluded.value_type,
           description = excluded.description,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(
        definition.key,
        JSON.stringify(definition.toValue(nextSettings)),
        "json",
        definition.description
      )
    )
  );

  return getSystemSettings(env);
}
