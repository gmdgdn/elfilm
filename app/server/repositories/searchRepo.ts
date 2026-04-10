/**
 * Search repository - Universal search across all entities
 */

import type { Env } from '../env';
import { searchMovies, type Movie } from './movieRepo';
import { searchPeople, type Person } from './personRepo';
import { searchCompanies, type Company } from './companyRepo';

// ============================================================
// TYPES
// ============================================================

export interface SearchResults {
    movies: Movie[];
    people: Person[];
    companies: Company[];
    total: number;
}

export type SearchCategory = 'all' | 'movies' | 'people' | 'companies';

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

/**
 * Universal search across all entities
 */
export async function universalSearch(
    env: Env,
    query: string,
    category: SearchCategory = 'all',
    limit: number = 20
): Promise<SearchResults> {
    if (!query || query.trim().length === 0) {
        return {
            movies: [],
            people: [],
            companies: [],
            total: 0,
        };
    }

    // Search based on category
    const [movies, people, companies] = await Promise.all([
        category === 'all' || category === 'movies'
            ? searchMovies(env, query, limit)
            : [],
        category === 'all' || category === 'people'
            ? searchPeople(env, query, limit)
            : [],
        category === 'all' || category === 'companies'
            ? searchCompanies(env, query, limit)
            : [],
    ]);

    return {
        movies,
        people,
        companies,
        total: movies.length + people.length + companies.length,
    };
}

/**
 * Get search suggestions for autocomplete
 */
export async function getSearchSuggestions(
    env: Env,
    query: string,
    limit: number = 5
): Promise<SearchResults> {
    // For suggestions, use a smaller limit per category
    return universalSearch(env, query, 'all', limit);
}
