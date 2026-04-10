/**
 * Company repository - Data access layer for companies
 */

import type { Env } from '../env';
import { queryAll, queryFirst } from '../db';

// ============================================================
// TYPES
// ============================================================

export interface Company {
    id: string;
    slug: string;
    name_en: string | null;
    name_ar: string;
    kind: string | null;
    country: string;
    founded_year: number | null;
    closed_year: number | null;
    description_ar: string | null;
    created_at: string;
}

export interface CompanyWithProductions extends Company {
    productions: Production[];
}

export interface Production {
    movie_id: string;
    movie_slug: string;
    title_ar: string;
    title_en: string | null;
    year: number;
    role_kind: string;
}

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

/**
 * Get a single company by slug with productions
 */
export async function getCompanyBySlug(
    env: Env,
    idOrSlug: string
): Promise<CompanyWithProductions | null> {
    const company = await queryFirst<Company>(
        env,
        'SELECT * FROM companies WHERE id = ? OR slug = ?',
        idOrSlug,
        idOrSlug
    );

    if (!company) return null;

    const productions = await getCompanyProductions(env, company.id);

    return {
        ...company,
        productions,
    };
}

/**
 * Get company's productions
 */
export async function getCompanyProductions(
    env: Env,
    companyId: string
): Promise<Production[]> {
    return queryAll<Production>(
        env,
        `SELECT 
      m.id as movie_id,
      m.slug as movie_slug,
      m.title_ar,
      m.title_en,
      m.year,
      mc.role_kind
    FROM movie_companies mc
    JOIN movies m ON m.id = mc.movie_id
    WHERE mc.company_id = ?
    ORDER BY m.year DESC`,
        companyId
    );
}

/**
 * List companies with pagination
 */
export async function listCompanies(
    env: Env,
    options: {
        kind?: string;
        orderBy?: 'name_ar' | 'founded_year';
        limit?: number;
        offset?: number;
    } = {}
): Promise<Company[]> {
    const {
        kind,
        orderBy = 'name_ar',
        limit = 50,
        offset = 0,
    } = options;

    let query = 'SELECT * FROM companies';
    const params: unknown[] = [];

    if (kind) {
        query += ' WHERE kind = ?';
        params.push(kind);
    }

    query += ` ORDER BY ${orderBy} ${orderBy === 'founded_year' ? 'ASC' : 'COLLATE NOCASE'} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return queryAll<Company>(env, query, ...params);
}

/**
 * Count companies with optional kind filtering.
 */
export async function countCompanies(
    env: Env,
    kind?: string
): Promise<number> {
    const result = kind
        ? await queryFirst<{ count: number }>(
            env,
            'SELECT COUNT(*) as count FROM companies WHERE kind = ?',
            kind
        )
        : await queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM companies');

    return result?.count || 0;
}

/**
 * Search companies by name
 */
export async function searchCompanies(
    env: Env,
    query: string,
    limit: number = 20
): Promise<Company[]> {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const searchTerm = `%${query}%`;

    return queryAll<Company>(
        env,
        `SELECT * FROM companies
    WHERE name_ar LIKE ? OR name_en LIKE ?
    ORDER BY name_ar
    LIMIT ?`,
        searchTerm, searchTerm, limit
    );
}
