/**
 * Person repository - Data access layer for people
 */

import type { Env } from '../env';
import { queryAll, queryFirst } from '../db';

// ============================================================
// TYPES
// ============================================================

// Simplified Person interface matching current database schema
export interface Person {
    id: string;
    slug?: string;
    name_ar: string | null;
    name_en: string | null;
    birthdate: string | null;
    deathdate?: string | null;
    country?: string | null;
    profile_image: string | null;
    bio: string | null;
    bio_ar?: string | null;
}

export interface PersonWithFilmography extends Person {
    filmography: Filmography;
}

export interface Filmography {
    as_actor: FilmographyEntry[];
    as_director: FilmographyEntry[];
    as_writer: FilmographyEntry[];
    as_crew: FilmographyEntry[];
}

export interface FilmographyEntry {
    movie_id: string;
    movie_slug: string;
    title_ar: string;
    title_en: string | null;
    year: number;
    role_kind: string;
    role_credit: string | null;
}

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

const PUBLIC_PERSON_IMAGE_BASE_URL = 'https://film.gmd.gdn/assets/elfilm/people';
const PERSON_LIST_SELECT = `
SELECT
    p.id,
    p.slug,
    p.name_ar,
    p.name_en,
    p.birthdate,
    p.deathdate,
    p.country,
    p.profile_image,
    NULL as bio,
    NULL as bio_ar
FROM people p`;
const PERSON_IMAGE_PRIORITY = `
CASE
    WHEN COALESCE(NULLIF(p.profile_image, ''), NULL) IS NOT NULL THEN 0
    WHEN EXISTS (
        SELECT 1
        FROM assets a
        WHERE a.person_id = p.id
          AND a.kind = 'portrait'
    ) THEN 0
    ELSE 1
END`;

function hydratePersonImage<T extends Person>(person: T): T {
    return {
        ...person,
        profile_image: person.profile_image || `${PUBLIC_PERSON_IMAGE_BASE_URL}/${person.id}.jpg`,
    };
}

/**
 * Get a single person by ID (simplified for current schema)
 */
export async function getPersonBySlug(
    env: Env,
    idOrSlug: string
): Promise<PersonWithFilmography | null> {
    const person = await queryFirst<Person>(
        env,
        'SELECT * FROM people WHERE id = ? OR slug = ?',
        idOrSlug,
        idOrSlug
    );

    if (!person) return null;

    const filmography = await getPersonFilmography(env, person.id);

    return {
        ...hydratePersonImage(person),
        filmography,
    };
}

/**
 * Get person's filmography grouped by role
 */
export async function getPersonFilmography(
    env: Env,
    personId: string
): Promise<Filmography> {
    const allCredits = await queryAll<FilmographyEntry>(
        env,
        `SELECT 
      m.id as movie_id,
      m.slug as movie_slug,
      m.title_ar,
      m.title_en,
      m.year,
      mp.role_kind,
      mp.role_credit
    FROM movie_people mp
    JOIN movies m ON m.id = mp.movie_id
    WHERE mp.person_id = ?
    ORDER BY m.year DESC`,
        personId
    );

    return {
        as_actor: allCredits.filter(c => c.role_kind === 'actor'),
        as_director: allCredits.filter(c => c.role_kind === 'director'),
        as_writer: allCredits.filter(c => c.role_kind === 'writer'),
        as_crew: allCredits.filter(c =>
            !['actor', 'director', 'writer'].includes(c.role_kind)
        ),
    };
}

/**
 * List people with pagination
 */
export async function listPeople(
    env: Env,
    options: {
        roleKind?: string;
        orderBy?: 'name_ar' | 'name_en';
        limit?: number;
        offset?: number;
    } = {}
): Promise<Person[]> {
    const {
        roleKind,
        orderBy = 'name_ar',
        limit = 50,
        offset = 0,
    } = options;
    const orderColumn = `p.${orderBy}`;

      let query = `SELECT DISTINCT
    p.id,
    p.slug,
    p.name_ar,
    p.name_en,
    p.birthdate,
    p.deathdate,
    p.country,
    p.profile_image,
    NULL as bio,
    NULL as bio_ar
FROM people p`;
    const params: unknown[] = [];

    if (roleKind) {
        query += ` JOIN movie_people mp ON mp.person_id = p.id WHERE mp.role_kind = ?`;
        params.push(roleKind);
    }

    query += ` ORDER BY ${PERSON_IMAGE_PRIORITY}, ${orderColumn} COLLATE NOCASE LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const people = await queryAll<Person>(env, query, ...params);
    return people.map((person) => hydratePersonImage(person));
}

/**
 * Count people with optional role filtering.
 */
export async function countPeople(
    env: Env,
    roleKind?: string
): Promise<number> {
    const result = roleKind
        ? await queryFirst<{ count: number }>(
            env,
            `SELECT COUNT(DISTINCT p.id) as count
             FROM people p
             JOIN movie_people mp ON mp.person_id = p.id
             WHERE mp.role_kind = ?`,
            roleKind
        )
        : await queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM people');

    return result?.count || 0;
}

/**
 * Search people by name
 */
export async function searchPeople(
    env: Env,
    query: string,
    limit: number = 20
): Promise<Person[]> {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const searchTerm = `%${query}%`;

    const people = await queryAll<Person>(
        env,
        `${PERSON_LIST_SELECT}
        WHERE p.name_ar LIKE ? OR p.name_en LIKE ?
        ORDER BY ${PERSON_IMAGE_PRIORITY}, p.name_ar COLLATE NOCASE
        LIMIT ?`,
        searchTerm, searchTerm, limit
    );

    return people.map((person) => hydratePersonImage(person));
}

/**
 * Get people born on a specific day and month
 */
export async function getPeopleBornOn(
    env: Env,
    month: number,
    day: number,
    limit: number = 20
): Promise<Person[]> {
    // Format month and day to ensure two digits (e.g., '01', '05')
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');

    const people = await queryAll<Person>(
        env,
        `${PERSON_LIST_SELECT}
    WHERE strftime('%m', p.birthdate) = ? 
    AND strftime('%d', p.birthdate) = ?
    ORDER BY ${PERSON_IMAGE_PRIORITY}, p.birthdate DESC
    LIMIT ?`,
        m, d, limit
    );

    return people.map((person) => hydratePersonImage(person));
}

/**
 * Get people died on a specific day and month
 */
export async function getPeopleDiedOn(
    env: Env,
    month: number,
    day: number,
    limit: number = 20
): Promise<Person[]> {
    // Format month and day to ensure two digits (e.g., '01', '05')
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');

    const people = await queryAll<Person>(
        env,
        `${PERSON_LIST_SELECT}
    WHERE strftime('%m', p.deathdate) = ? 
    AND strftime('%d', p.deathdate) = ?
    ORDER BY ${PERSON_IMAGE_PRIORITY}, p.deathdate DESC
    LIMIT ?`,
        m, d, limit
    );

    return people.map((person) => hydratePersonImage(person));
}
