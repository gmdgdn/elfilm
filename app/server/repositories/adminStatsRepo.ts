/**
 * Admin statistics repository
 * Provides analytics and statistics for the admin dashboard
 */

import type { Env } from '../env';
import { queryAll, queryFirst } from '../db';

// ============================================================
// TYPES
// ============================================================

export interface OverallStats {
    totalMovies: number;
    totalPeople: number;
    totalCompanies: number;
    totalGenres: number;
    totalTags: number;
    recentMovies: number; // Added in last 30 days
    recentPeople: number;
}

export interface MoviesByYearStat {
    year: number;
    count: number;
}

export interface GenreDistribution {
    id: number;
    name_ar: string;
    name_en: string | null;
    count: number;
}

export interface TopCredit {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string | null;
    profile_image: string | null;
    count: number;
}

export interface RecentActivity {
    id: string;
    title_ar: string;
    title_en: string | null;
    year: number;
    created_at: string;
}

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

/**
 * Get overall statistics for the dashboard
 */
export async function getOverallStats(env: Env): Promise<OverallStats> {
    const [
        moviesCount,
        peopleCount,
        companiesCount,
        genresCount,
        tagsCount,
        recentMoviesCount,
        recentPeopleCount,
    ] = await Promise.all([
        queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM movies'),
        queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM people'),
        queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM companies'),
        queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM genres'),
        queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM tags'),
        queryFirst<{ count: number }>(
            env,
            `SELECT COUNT(*) as count FROM movies 
             WHERE created_at >= datetime('now', '-30 days')`
        ),
        queryFirst<{ count: number }>(
            env,
            `SELECT COUNT(*) as count FROM people 
             WHERE created_at >= datetime('now', '-30 days')`
        ),
    ]);

    return {
        totalMovies: moviesCount?.count || 0,
        totalPeople: peopleCount?.count || 0,
        totalCompanies: companiesCount?.count || 0,
        totalGenres: genresCount?.count || 0,
        totalTags: tagsCount?.count || 0,
        recentMovies: recentMoviesCount?.count || 0,
        recentPeople: recentPeopleCount?.count || 0,
    };
}

/**
 * Get movie counts by year
 */
export async function getMoviesByYearStats(
    env: Env,
    limit: number = 50
): Promise<MoviesByYearStat[]> {
    return queryAll<MoviesByYearStat>(
        env,
        `SELECT year, COUNT(*) as count 
         FROM movies 
         GROUP BY year 
         ORDER BY year DESC 
         LIMIT ?`,
        limit
    );
}

/**
 * Get genre distribution (movies per genre)
 */
export async function getGenreDistribution(env: Env): Promise<GenreDistribution[]> {
    return queryAll<GenreDistribution>(
        env,
        `SELECT 
            g.id,
            g.name_ar,
            g.name_en,
            COUNT(mg.movie_id) as count
         FROM genres g
         LEFT JOIN movie_genres mg ON mg.genre_id = g.id
         GROUP BY g.id
         ORDER BY count DESC`
    );
}

/**
 * Get top actors by number of movie credits
 */
export async function getTopActors(
    env: Env,
    limit: number = 10
): Promise<TopCredit[]> {
    return queryAll<TopCredit>(
        env,
        `SELECT 
            p.id,
            p.slug,
            p.name_ar,
            p.name_en,
            p.profile_image,
            COUNT(mp.movie_id) as count
         FROM people p
         JOIN movie_people mp ON mp.person_id = p.id
         WHERE mp.role_kind = 'actor'
         GROUP BY p.id
         ORDER BY count DESC
         LIMIT ?`,
        limit
    );
}

/**
 * Get top directors by number of movies
 */
export async function getTopDirectors(
    env: Env,
    limit: number = 10
): Promise<TopCredit[]> {
    return queryAll<TopCredit>(
        env,
        `SELECT 
            p.id,
            p.slug,
            p.name_ar,
            p.name_en,
            p.profile_image,
            COUNT(mp.movie_id) as count
         FROM people p
         JOIN movie_people mp ON mp.person_id = p.id
         WHERE mp.role_kind = 'director'
         GROUP BY p.id
         ORDER BY count DESC
         LIMIT ?`,
        limit
    );
}

/**
 * Get recently added movies
 */
export async function getRecentActivity(
    env: Env,
    limit: number = 10
): Promise<RecentActivity[]> {
    return queryAll<RecentActivity>(
        env,
        `SELECT id, title_ar, title_en, year, created_at
         FROM movies
         ORDER BY created_at DESC
         LIMIT ?`,
        limit
    );
}

/**
 * Get decade-wise movie statistics
 */
export async function getMoviesByDecadeStats(env: Env): Promise<{ decade: number; count: number }[]> {
    return queryAll<{ decade: number; count: number }>(
        env,
        `SELECT 
            (year / 10) * 10 as decade,
            COUNT(*) as count
         FROM movies
         GROUP BY decade
         ORDER BY decade DESC`
    );
}
