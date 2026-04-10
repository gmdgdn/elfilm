import type { Env } from "../env";
import { queryAll, queryFirst } from "../db";

export type AdminFieldInput =
  | "text"
  | "textarea"
  | "integer"
  | "real"
  | "boolean"
  | "date"
  | "datetime"
  | "url";

export interface AdminColumnSchema {
  name: string;
  label: string;
  dbType: string;
  input: AdminFieldInput;
  required: boolean;
  nullable: boolean;
  primaryKey: boolean;
  editableOnCreate: boolean;
  editableOnUpdate: boolean;
  tableVisible: boolean;
  description?: string;
}

export interface AdminEntitySchema {
  key: string;
  label: string;
  description: string;
  table: string;
  primaryKey: string[];
  searchable: string[];
  previewColumns: string[];
  defaultSort: {
    field: string;
    direction: "ASC" | "DESC";
  };
  readOnly: boolean;
  readOnlyReason?: string;
  columns: AdminColumnSchema[];
}

export interface AdminEntitySummary extends AdminEntitySchema {
  count: number;
}

interface TableColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface ColumnOverride {
  label?: string;
  input?: AdminFieldInput;
  description?: string;
  tableVisible?: boolean;
  editableOnCreate?: boolean;
  editableOnUpdate?: boolean;
  required?: boolean;
}

interface EntityDefinition {
  key: string;
  label: string;
  description: string;
  table: string;
  primaryKey: string[];
  searchable?: string[];
  previewColumns?: string[];
  defaultSort?: {
    field: string;
    direction: "ASC" | "DESC";
  };
  readOnly?: boolean;
  readOnlyReason?: string;
  columns?: Record<string, ColumnOverride>;
}

interface ListRowsOptions {
  limit?: number;
  offset?: number;
  search?: string;
  orderBy?: string;
  direction?: "ASC" | "DESC";
}

const entityDefinitions: EntityDefinition[] = [
  {
    key: "movies",
    label: "Movies",
    description: "Core archive titles, release metadata, and public-facing movie records.",
    table: "movies",
    primaryKey: ["id"],
    searchable: ["title", "title_ar", "title_en", "summary_ar", "story", "slug"],
    previewColumns: ["title_ar", "title_en", "year", "work_type", "rating", "release_date"],
    defaultSort: { field: "year", direction: "DESC" },
    columns: {
      summary_ar: { input: "textarea", tableVisible: false },
      story: { input: "textarea", tableVisible: false },
      poster_url: { input: "url", tableVisible: false },
      release_date: { input: "date" },
      rating: { input: "real" },
      duration_minutes: { input: "integer" },
      year: { input: "integer" },
    },
  },
  {
    key: "people",
    label: "People",
    description: "Actors, directors, writers, and other contributor records.",
    table: "people",
    primaryKey: ["id"],
    searchable: ["name_ar", "name_en", "full_name", "slug"],
    previewColumns: ["name_ar", "name_en", "birthdate", "deathdate", "country"],
    defaultSort: { field: "name_ar", direction: "ASC" },
    columns: {
      bio_ar: { input: "textarea", tableVisible: false },
      bio: { input: "textarea", tableVisible: false },
      profile_image: { input: "url", tableVisible: false },
      birthdate: { input: "date" },
      deathdate: { input: "date" },
    },
  },
  {
    key: "companies",
    label: "Companies",
    description: "Studios, distributors, labs, and production organizations.",
    table: "companies",
    primaryKey: ["id"],
    searchable: ["name_ar", "name_en", "slug", "kind"],
    previewColumns: ["name_ar", "name_en", "kind", "country", "founded_year"],
    defaultSort: { field: "name_ar", direction: "ASC" },
    columns: {
      description_ar: { input: "textarea", tableVisible: false },
      founded_year: { input: "integer" },
      closed_year: { input: "integer" },
    },
  },
  {
    key: "genres",
    label: "Genres",
    description: "Controlled browse taxonomy for the archive catalogue.",
    table: "genres",
    primaryKey: ["id"],
    searchable: ["name_ar", "name_en", "slug"],
    previewColumns: ["name_ar", "name_en", "slug"],
    defaultSort: { field: "name_ar", direction: "ASC" },
    columns: {
      id: { editableOnCreate: false, editableOnUpdate: false },
    },
  },
  {
    key: "tags",
    label: "Tags",
    description: "Semantic discovery and editorial tagging for movies.",
    table: "tags",
    primaryKey: ["id"],
    searchable: ["name_ar", "name_en", "slug", "category"],
    previewColumns: ["name_ar", "name_en", "category", "slug"],
    defaultSort: { field: "name_ar", direction: "ASC" },
    columns: {
      id: { editableOnCreate: false, editableOnUpdate: false },
    },
  },
  {
    key: "movie_people",
    label: "Movie People",
    description: "Cast and crew relationships between movies and people.",
    table: "movie_people",
    primaryKey: ["movie_id", "person_id", "role_kind", "role_credit"],
    searchable: ["movie_id", "person_id", "role_kind", "role_credit"],
    previewColumns: ["movie_id", "person_id", "role_kind", "role_credit", "billing_order"],
    defaultSort: { field: "movie_id", direction: "ASC" },
    columns: {
      billing_order: { input: "integer" },
      role_credit: { description: "Use an empty string when the credit is implied by role_kind." },
    },
  },
  {
    key: "movie_companies",
    label: "Movie Companies",
    description: "Production, distribution, and studio relationships for movies.",
    table: "movie_companies",
    primaryKey: ["movie_id", "company_id", "role_kind"],
    searchable: ["movie_id", "company_id", "role_kind"],
    previewColumns: ["movie_id", "company_id", "role_kind"],
    defaultSort: { field: "movie_id", direction: "ASC" },
  },
  {
    key: "movie_genres",
    label: "Movie Genres",
    description: "Join table connecting movies to browse genres.",
    table: "movie_genres",
    primaryKey: ["movie_id", "genre_id"],
    searchable: ["movie_id", "genre_id"],
    previewColumns: ["movie_id", "genre_id"],
    defaultSort: { field: "movie_id", direction: "ASC" },
    columns: {
      genre_id: { input: "integer" },
    },
  },
  {
    key: "movie_tags",
    label: "Movie Tags",
    description: "Join table connecting movies to semantic tags.",
    table: "movie_tags",
    primaryKey: ["movie_id", "tag_id"],
    searchable: ["movie_id", "tag_id"],
    previewColumns: ["movie_id", "tag_id"],
    defaultSort: { field: "movie_id", direction: "ASC" },
    columns: {
      tag_id: { input: "integer" },
    },
  },
  {
    key: "assets",
    label: "Assets",
    description: "Poster, still, and portrait references backed by R2 objects.",
    table: "assets",
    primaryKey: ["id"],
    searchable: ["movie_id", "person_id", "kind", "r2_key", "url"],
    previewColumns: ["kind", "movie_id", "person_id", "r2_key", "created_at"],
    defaultSort: { field: "created_at", direction: "DESC" },
    columns: {
      id: { editableOnCreate: false, editableOnUpdate: false },
      url: { input: "url" },
      width: { input: "integer" },
      height: { input: "integer" },
      created_at: { editableOnCreate: false, editableOnUpdate: false },
    },
  },
  {
    key: "watch_links",
    label: "Watch Links",
    description: "Streaming and embed targets, including verification metadata.",
    table: "watch_links",
    primaryKey: ["id"],
    searchable: ["movie_id", "platform", "provider_key", "title", "source_kind", "url"],
    previewColumns: ["platform", "movie_id", "title", "source_kind", "verified_at", "is_official"],
    defaultSort: { field: "verified_at", direction: "DESC" },
    columns: {
      id: { editableOnCreate: false, editableOnUpdate: false },
      url: { input: "url" },
      embed_url: { input: "url" },
      confidence: { input: "real" },
      is_official: { input: "boolean" },
      verified_at: { input: "datetime" },
    },
  },
  {
    key: "news",
    label: "News",
    description: "External coverage and article references tied to archive entities.",
    table: "news",
    primaryKey: ["id"],
    searchable: ["entity_type", "entity_id", "category", "title", "domain", "snippet"],
    previewColumns: ["entity_type", "entity_id", "category", "title", "published_at"],
    defaultSort: { field: "published_at", direction: "DESC" },
    columns: {
      id: { editableOnCreate: false, editableOnUpdate: false },
      link: { input: "url" },
      snippet: { input: "textarea", tableVisible: false },
      published_at: { input: "datetime" },
    },
  },
  {
    key: "movie_search",
    label: "Movie Search Index",
    description: "Derived full-text search surface used by archive search and vectorization.",
    table: "movie_search",
    primaryKey: ["movie_id"],
    searchable: ["movie_id", "title", "title_ar", "title_en", "summary_ar", "story", "genres"],
    previewColumns: ["movie_id", "title_ar", "title_en", "genres", "cast_names"],
    defaultSort: { field: "movie_id", direction: "ASC" },
    readOnly: true,
    readOnlyReason: "Derived FTS index; edit the source entities instead.",
    columns: {
      summary_ar: { input: "textarea", tableVisible: false },
      story: { input: "textarea", tableVisible: false },
      cast_names: { input: "textarea", tableVisible: false },
      crew_names: { input: "textarea", tableVisible: false },
    },
  },
  {
    key: "audit_log",
    label: "Audit Log",
    description: "Immutable write history for archive operations and maintenance actions.",
    table: "audit_log",
    primaryKey: ["id"],
    searchable: ["action", "entity_type", "entity_id", "details"],
    previewColumns: ["action", "entity_type", "entity_id", "created_at"],
    defaultSort: { field: "created_at", direction: "DESC" },
    readOnly: true,
    readOnlyReason: "Generated by admin actions.",
    columns: {
      id: { editableOnCreate: false, editableOnUpdate: false },
      details: { input: "textarea", tableVisible: false, editableOnCreate: false, editableOnUpdate: false },
      created_at: { editableOnCreate: false, editableOnUpdate: false },
    },
  },
  {
    key: "admin_users",
    label: "Admin Users",
    description: "Human operators allowed to manage the archive.",
    table: "admin_users",
    primaryKey: ["id"],
    searchable: ["email", "name", "role"],
    previewColumns: ["email", "name", "role", "last_login"],
    defaultSort: { field: "created_at", direction: "DESC" },
    columns: {
      last_login: { input: "datetime" },
      created_at: { editableOnCreate: false, editableOnUpdate: false },
    },
  },
  {
    key: "system_settings",
    label: "System Settings",
    description: "Operational flags and runtime defaults persisted in D1.",
    table: "system_settings",
    primaryKey: ["key"],
    searchable: ["key", "value", "value_type", "description"],
    previewColumns: ["key", "value_type", "description", "updated_at"],
    defaultSort: { field: "key", direction: "ASC" },
    columns: {
      value: { input: "textarea", tableVisible: false },
      description: { input: "textarea", tableVisible: false },
      updated_at: { editableOnCreate: false, editableOnUpdate: false },
    },
  },
];

const entityMap = new Map(entityDefinitions.map((entity) => [entity.key, entity]));

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function titleCase(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferInputType(columnName: string, dbType: string): AdminFieldInput {
  const normalizedName = columnName.toLowerCase();
  const normalizedType = dbType.toUpperCase();

  if (normalizedName.startsWith("is_")) {
    return "boolean";
  }
  if (normalizedName.endsWith("_at")) {
    return "datetime";
  }
  if (normalizedName.includes("date")) {
    return "date";
  }
  if (normalizedName.includes("url") || normalizedName.includes("link")) {
    return "url";
  }
  if (normalizedName.includes("summary") || normalizedName.includes("story") || normalizedName.includes("bio") || normalizedName.includes("snippet") || normalizedName.includes("description") || normalizedName === "value") {
    return "textarea";
  }
  if (normalizedType.includes("INT")) {
    return "integer";
  }
  if (normalizedType.includes("REAL") || normalizedType.includes("FLOA") || normalizedType.includes("DOUB")) {
    return "real";
  }

  return "text";
}

function mergeColumnSchema(definition: EntityDefinition, column: TableColumnInfo): AdminColumnSchema {
  const override = definition.columns?.[column.name];
  const isPrimaryKey = column.pk > 0;
  const isAutoGenerated = isPrimaryKey && column.type.toUpperCase().includes("INT");
  const nullable = column.notnull === 0;

  return {
    name: column.name,
    label: override?.label || titleCase(column.name),
    dbType: column.type,
    input: override?.input || inferInputType(column.name, column.type),
    required: override?.required ?? (!nullable && !isAutoGenerated && column.dflt_value === null),
    nullable,
    primaryKey: isPrimaryKey,
    editableOnCreate: override?.editableOnCreate ?? !isAutoGenerated,
    editableOnUpdate: override?.editableOnUpdate ?? !isPrimaryKey,
    tableVisible: override?.tableVisible ?? !["summary_ar", "story", "bio", "bio_ar", "snippet", "description", "details", "value"].includes(column.name),
    description: override?.description,
  };
}

async function getActualColumns(env: Env, definition: EntityDefinition) {
  return queryAll<TableColumnInfo>(env, `PRAGMA table_info(${quoteIdentifier(definition.table)})`);
}

async function getSchema(env: Env, entityKey: string): Promise<AdminEntitySchema> {
  const definition = entityMap.get(entityKey);
  if (!definition) {
    throw new Error(`Unknown entity "${entityKey}"`);
  }

  const columns = await getActualColumns(env, definition);
  if (columns.length === 0) {
    throw new Error(`Table "${definition.table}" is not available in the database.`);
  }

  const actualColumnNames = new Set(columns.map((column) => column.name));
  const previewColumns = (definition.previewColumns || columns.map((column) => column.name))
    .filter((column) => actualColumnNames.has(column));
  const searchable = (definition.searchable || [])
    .filter((column) => actualColumnNames.has(column));
  const defaultSort = definition.defaultSort && actualColumnNames.has(definition.defaultSort.field)
    ? definition.defaultSort
    : {
        field: definition.primaryKey.find((column) => actualColumnNames.has(column)) || columns[0].name,
        direction: "ASC" as const,
      };

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    table: definition.table,
    primaryKey: definition.primaryKey.filter((column) => actualColumnNames.has(column)),
    searchable,
    previewColumns,
    defaultSort,
    readOnly: Boolean(definition.readOnly),
    readOnlyReason: definition.readOnlyReason,
    columns: columns.map((column) => mergeColumnSchema(definition, column)),
  };
}

function normalizeValue(column: AdminColumnSchema, rawValue: unknown) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === null) {
    return null;
  }

  if (column.input === "boolean") {
    if (typeof rawValue === "boolean") {
      return rawValue ? 1 : 0;
    }
    if (typeof rawValue === "number") {
      return rawValue ? 1 : 0;
    }
    const normalized = String(rawValue).trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized) ? 1 : 0;
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (trimmed.length === 0 && column.nullable) {
      return null;
    }

    if (column.input === "integer") {
      return trimmed.length === 0 ? null : Number.parseInt(trimmed, 10);
    }

    if (column.input === "real") {
      return trimmed.length === 0 ? null : Number.parseFloat(trimmed);
    }

    return rawValue;
  }

  if (column.input === "integer" || column.input === "real") {
    return rawValue;
  }

  return rawValue;
}

function assertMutable(schema: AdminEntitySchema) {
  if (schema.readOnly) {
    throw new Error(schema.readOnlyReason || `${schema.label} is read-only.`);
  }
}

function buildPrimaryKeyWhere(schema: AdminEntitySchema, key: Record<string, unknown>) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const primaryKeyField of schema.primaryKey) {
    if (!(primaryKeyField in key)) {
      throw new Error(`Missing primary key field "${primaryKeyField}".`);
    }

    conditions.push(`${quoteIdentifier(primaryKeyField)} = ?`);
    params.push(key[primaryKeyField]);
  }

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

function pickColumn(schema: AdminEntitySchema, columnName: string) {
  return schema.columns.find((column) => column.name === columnName) || null;
}

export async function listDatabaseEntities(env: Env): Promise<AdminEntitySummary[]> {
  const summaries = await Promise.all(
    entityDefinitions.map(async (definition) => {
      const schema = await getSchema(env, definition.key);
      const result = await queryFirst<{ count: number }>(
        env,
        `SELECT COUNT(*) as count FROM ${quoteIdentifier(schema.table)}`
      );

      return {
        ...schema,
        count: result?.count || 0,
      };
    })
  );

  return summaries;
}

export async function getDatabaseEntitySchema(env: Env, entityKey: string) {
  return getSchema(env, entityKey);
}

export async function listDatabaseRows(
  env: Env,
  entityKey: string,
  options: ListRowsOptions = {}
) {
  const schema = await getSchema(env, entityKey);
  const {
    limit = 25,
    offset = 0,
    search,
    orderBy = schema.defaultSort.field,
    direction = schema.defaultSort.direction,
  } = options;

  const safeOrderBy = pickColumn(schema, orderBy)?.name || schema.defaultSort.field;
  const safeDirection = direction === "ASC" ? "ASC" : "DESC";
  const params: unknown[] = [];
  let whereClause = "";

  if (search && search.trim() && schema.searchable.length > 0) {
    const searchTerm = `%${search.trim()}%`;
    whereClause = `WHERE ${schema.searchable
      .map((column) => `${quoteIdentifier(column)} LIKE ?`)
      .join(" OR ")}`;
    params.push(...schema.searchable.map(() => searchTerm));
  }

  const rows = await queryAll<Record<string, unknown>>(
    env,
    `SELECT * FROM ${quoteIdentifier(schema.table)}
     ${whereClause}
     ORDER BY ${quoteIdentifier(safeOrderBy)} ${safeDirection}
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );

  const total = await queryFirst<{ count: number }>(
    env,
    `SELECT COUNT(*) as count FROM ${quoteIdentifier(schema.table)} ${whereClause}`,
    ...params
  );

  return {
    entity: schema,
    rows,
    total: total?.count || 0,
    limit,
    offset,
    search: search || "",
    orderBy: safeOrderBy,
    direction: safeDirection,
  };
}

export async function createDatabaseRow(
  env: Env,
  entityKey: string,
  values: Record<string, unknown>
) {
  const schema = await getSchema(env, entityKey);
  assertMutable(schema);

  const editableColumns = schema.columns.filter((column) => column.editableOnCreate);
  const insertColumns: string[] = [];
  const insertValues: unknown[] = [];

  for (const column of editableColumns) {
    if (!(column.name in values)) {
      continue;
    }

    const normalized = normalizeValue(column, values[column.name]);
    insertColumns.push(quoteIdentifier(column.name));
    insertValues.push(normalized);
  }

  for (const column of editableColumns.filter((candidate) => candidate.required)) {
    const supplied = values[column.name];
    if (supplied === undefined || supplied === null || supplied === "") {
      throw new Error(`Field "${column.label}" is required.`);
    }
  }

  if (insertColumns.length === 0) {
    throw new Error("No values were provided for creation.");
  }

  const placeholders = insertColumns.map(() => "?").join(", ");
  const result = await env.DB.prepare(
    `INSERT INTO ${quoteIdentifier(schema.table)} (${insertColumns.join(", ")})
     VALUES (${placeholders})`
  )
    .bind(...insertValues)
    .run();

  let primaryKey: Record<string, unknown>;
  if (schema.primaryKey.length === 1 && !(schema.primaryKey[0] in values)) {
    primaryKey = {
      [schema.primaryKey[0]]: result.meta.last_row_id ?? null,
    };
  } else {
    primaryKey = Object.fromEntries(schema.primaryKey.map((field) => [field, values[field]]));
  }

  return {
    primaryKey,
    row: await getDatabaseRow(env, entityKey, primaryKey),
  };
}

export async function getDatabaseRow(
  env: Env,
  entityKey: string,
  key: Record<string, unknown>
) {
  const schema = await getSchema(env, entityKey);
  const primaryKey = buildPrimaryKeyWhere(schema, key);

  return queryFirst<Record<string, unknown>>(
    env,
    `SELECT * FROM ${quoteIdentifier(schema.table)}
     WHERE ${primaryKey.whereClause}`,
    ...primaryKey.params
  );
}

export async function updateDatabaseRow(
  env: Env,
  entityKey: string,
  key: Record<string, unknown>,
  values: Record<string, unknown>
) {
  const schema = await getSchema(env, entityKey);
  assertMutable(schema);

  const updates: string[] = [];
  const params: unknown[] = [];

  for (const column of schema.columns.filter((candidate) => candidate.editableOnUpdate)) {
    if (!(column.name in values)) {
      continue;
    }

    updates.push(`${quoteIdentifier(column.name)} = ?`);
    params.push(normalizeValue(column, values[column.name]));
  }

  if (schema.columns.some((column) => column.name === "updated_at") && !("updated_at" in values)) {
    updates.push(`${quoteIdentifier("updated_at")} = CURRENT_TIMESTAMP`);
  }

  if (updates.length === 0) {
    throw new Error("No editable fields were provided.");
  }

  const primaryKey = buildPrimaryKeyWhere(schema, key);
  await env.DB.prepare(
    `UPDATE ${quoteIdentifier(schema.table)}
     SET ${updates.join(", ")}
     WHERE ${primaryKey.whereClause}`
  )
    .bind(...params, ...primaryKey.params)
    .run();

  return {
    primaryKey: key,
    row: await getDatabaseRow(env, entityKey, key),
  };
}

export async function deleteDatabaseRow(
  env: Env,
  entityKey: string,
  key: Record<string, unknown>
) {
  const schema = await getSchema(env, entityKey);
  assertMutable(schema);

  const existingRow = await getDatabaseRow(env, entityKey, key);
  if (!existingRow) {
    throw new Error(`${schema.label} row not found.`);
  }

  const primaryKey = buildPrimaryKeyWhere(schema, key);
  await env.DB.prepare(
    `DELETE FROM ${quoteIdentifier(schema.table)}
     WHERE ${primaryKey.whereClause}`
  )
    .bind(...primaryKey.params)
    .run();

  return {
    primaryKey: key,
    row: existingRow,
  };
}
