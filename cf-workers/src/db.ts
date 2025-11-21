// Database utility functions for D1

import { Env, Film, Person, FilmFilters, PaginationParams } from './types';

export class Database {
  constructor(private db: D1Database) {}

  // Film queries
  async getFilm(filmId: number, env: Env): Promise<Film | null> {
    const result = await this.db
      .prepare('SELECT * FROM films WHERE id = ?')
      .bind(filmId)
      .first<Film>();

    if (!result) return null;

    // Fetch related data
    const genres = await this.getFilmGenres(filmId);
    const cast = await this.getFilmCast(filmId);
    const crew = await this.getFilmCrew(filmId);
    const tags_en = await this.getFilmTags(filmId, 'en');
    const tags_ar = await this.getFilmTags(filmId, 'ar');

    return {
      ...result,
      genres: genres.map(g => g.name_en),
      cast,
      crew,
      tags_en,
      tags_ar,
    };
  }

  async getFilmBySlug(slug: string, env: Env): Promise<Film | null> {
    const result = await this.db
      .prepare('SELECT * FROM films WHERE slug = ?')
      .bind(slug)
      .first<Film>();

    if (!result) return null;

    return this.getFilm(result.id!, env);
  }

  async getFilmsByYear(year: number, limit: number = 100, offset: number = 0): Promise<any[]> {
    return this.db
      .prepare(
        'SELECT * FROM films WHERE production_year = ? ORDER BY title_en LIMIT ? OFFSET ?'
      )
      .bind(year, limit, offset)
      .all<Film>();
  }

  async searchFilms(query: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    const searchQuery = `%${query}%`;
    return this.db
      .prepare(
        `SELECT DISTINCT f.* FROM films f
         WHERE f.title_en LIKE ? OR f.title_ar LIKE ? OR f.summary_ar LIKE ?
         ORDER BY f.production_year DESC
         LIMIT ? OFFSET ?`
      )
      .bind(searchQuery, searchQuery, searchQuery, limit, offset)
      .all<Film>();
  }

  async filterFilms(filters: FilmFilters, limit: number = 100, offset: number = 0): Promise<Film[]> {
    let query = 'SELECT DISTINCT f.* FROM films f LEFT JOIN film_genres fg ON f.id = fg.film_id WHERE 1=1';
    const bindings: any[] = [];

    if (filters.year_min) {
      query += ' AND f.production_year >= ?';
      bindings.push(filters.year_min);
    }

    if (filters.year_max) {
      query += ' AND f.production_year <= ?';
      bindings.push(filters.year_max);
    }

    if (filters.duration_min) {
      query += ' AND f.duration_minutes >= ?';
      bindings.push(filters.duration_min);
    }

    if (filters.duration_max) {
      query += ' AND f.duration_minutes <= ?';
      bindings.push(filters.duration_max);
    }

    if (filters.genre_ids && filters.genre_ids.length > 0) {
      query += ` AND fg.genre_id IN (${filters.genre_ids.map(() => '?').join(',')})`;
      bindings.push(...filters.genre_ids);
    }

    query += ' ORDER BY f.production_year DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    return this.db.prepare(query).bind(...bindings).all<Film>();
  }

  async getFilmGenres(filmId: number): Promise<any[]> {
    return this.db
      .prepare(
        `SELECT g.* FROM genres g
         JOIN film_genres fg ON g.id = fg.genre_id
         WHERE fg.film_id = ?`
      )
      .bind(filmId)
      .all();
  }

  async getFilmCast(filmId: number): Promise<any[]> {
    return this.db
      .prepare(
        `SELECT c.*, p.name_en, p.name_ar
         FROM cast c
         JOIN people p ON c.person_id = p.id
         WHERE c.film_id = ?
         ORDER BY c.display_order`
      )
      .bind(filmId)
      .all();
  }

  async getFilmCrew(filmId: number): Promise<any[]> {
    return this.db
      .prepare(
        `SELECT cr.*, p.name_en, p.name_ar, crr.name_en as role_name
         FROM crew cr
         JOIN people p ON cr.person_id = p.id
         JOIN crew_roles crr ON cr.crew_role_id = crr.id
         WHERE cr.film_id = ?
         ORDER BY crr.display_order`
      )
      .bind(filmId)
      .all();
  }

  async getFilmTags(filmId: number, language: string = 'en'): Promise<string[]> {
    const results = await this.db
      .prepare(
        `SELECT t.name_${language} FROM tags t
         JOIN film_tags ft ON t.id = ft.tag_id
         WHERE ft.film_id = ? AND ft.language = ?`
      )
      .bind(filmId, language)
      .all<{ [`name_${string}`]: string }>();

    return results.map((r: any) => r[`name_${language}`]).filter(Boolean);
  }

  // Person queries
  async getPerson(personId: number): Promise<Person | null> {
    return this.db.prepare('SELECT * FROM people WHERE id = ?').bind(personId).first<Person>();
  }

  async searchPeople(query: string, limit: number = 20, offset: number = 0): Promise<Person[]> {
    const searchQuery = `%${query}%`;
    return this.db
      .prepare(
        `SELECT * FROM people
         WHERE name_en LIKE ? OR name_ar LIKE ? OR bio_en LIKE ?
         ORDER BY name_en
         LIMIT ? OFFSET ?`
      )
      .bind(searchQuery, searchQuery, searchQuery, limit, offset)
      .all<Person>();
  }

  async getPersonCredits(personId: number): Promise<any> {
    const asActor = await this.db
      .prepare(
        `SELECT f.*, 'actor' as credit_type FROM films f
         JOIN cast c ON f.id = c.film_id
         WHERE c.person_id = ?
         ORDER BY f.production_year DESC`
      )
      .bind(personId)
      .all();

    const asCrew = await this.db
      .prepare(
        `SELECT f.*, cr.name_en as role_name, 'crew' as credit_type FROM films f
         JOIN crew c ON f.id = c.film_id
         JOIN crew_roles cr ON c.crew_role_id = cr.id
         WHERE c.person_id = ?
         ORDER BY f.production_year DESC`
      )
      .bind(personId)
      .all();

    return {
      person: await this.getPerson(personId),
      as_actor: asActor,
      as_crew: asCrew,
    };
  }

  // Statistics and metadata
  async getStatistics(): Promise<any> {
    const [filmCount, peopleCount, genreCount, tagCount] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM films').first<{ count: number }>(),
      this.db.prepare('SELECT COUNT(*) as count FROM people').first<{ count: number }>(),
      this.db.prepare('SELECT COUNT(*) as count FROM genres').first<{ count: number }>(),
      this.db.prepare('SELECT COUNT(*) as count FROM tags').first<{ count: number }>(),
    ]);

    const yearRange = await this.db
      .prepare('SELECT MIN(production_year) as min, MAX(production_year) as max FROM films')
      .first<{ min: number; max: number }>();

    return {
      total_films: filmCount?.count || 0,
      total_people: peopleCount?.count || 0,
      total_genres: genreCount?.count || 0,
      total_tags: tagCount?.count || 0,
      years_covered: yearRange || { min: null, max: null },
    };
  }

  async getYears(): Promise<number[]> {
    const results = await this.db
      .prepare('SELECT DISTINCT production_year FROM films ORDER BY production_year ASC')
      .all<{ production_year: number }>();

    return results.map((r: any) => r.production_year);
  }

  async getGenres(): Promise<any[]> {
    return this.db.prepare('SELECT * FROM genres ORDER BY name_en').all();
  }

  // Admin functions
  async insertFilm(film: any): Promise<any> {
    return this.db
      .prepare(
        `INSERT INTO films (slug, title_en, title_ar, production_year, film_type, duration_minutes, summary_ar)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        film.slug,
        film.title_en,
        film.title_ar,
        film.production_year,
        film.type,
        film.duration_minutes,
        film.summary_ar
      )
      .run();
  }

  async insertPerson(person: any): Promise<any> {
    return this.db
      .prepare(
        `INSERT INTO people (name_en, name_ar, bio_en, bio_ar, birth_year)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(person.name_en, person.name_ar, person.bio_en, person.bio_ar, person.birth_year)
      .run();
  }

  async insertCastMember(filmId: number, personId: number, roleName?: string, rating?: number): Promise<any> {
    return this.db
      .prepare(
        `INSERT INTO cast (film_id, person_id, role_name, imdb_rating)
         VALUES (?, ?, ?, ?)`
      )
      .bind(filmId, personId, roleName, rating)
      .run();
  }

  async insertCrewMember(filmId: number, personId: number, crewRoleId: number): Promise<any> {
    return this.db
      .prepare(`INSERT INTO crew (film_id, person_id, crew_role_id) VALUES (?, ?, ?)`)
      .bind(filmId, personId, crewRoleId)
      .run();
  }

  async linkGenreToFilm(filmId: number, genreId: number): Promise<any> {
    return this.db
      .prepare(`INSERT OR IGNORE INTO film_genres (film_id, genre_id) VALUES (?, ?)`)
      .bind(filmId, genreId)
      .run();
  }

  async linkTagToFilm(filmId: number, tagId: number, language: string): Promise<any> {
    return this.db
      .prepare(`INSERT OR IGNORE INTO film_tags (film_id, tag_id, language) VALUES (?, ?, ?)`)
      .bind(filmId, tagId, language)
      .run();
  }

  async recordSearchQuery(query: string, resultsCount: number, language: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO search_queries (query, results_count, language)
         VALUES (?, ?, ?)`
      )
      .bind(query, resultsCount, language)
      .run();
  }
}

export function createDatabase(env: Env): Database {
  return new Database(env.DB);
}
