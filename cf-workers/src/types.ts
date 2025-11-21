// ElFilm API TypeScript Types

export interface Env {
  DB: D1Database;
  POSTERS: R2Bucket;
  IMAGES: R2Bucket;
  AI: Ai;
  ENVIRONMENT?: string;
  API_VERSION?: string;
  MAX_PAGE_SIZE?: string;
  ENABLE_AI?: string;
}

// Film types
export interface FilmBase {
  id?: number;
  slug: string;
  title_en: string;
  title_ar?: string;
  production_year: number;
  film_type?: string;
  duration_minutes?: number;
  summary_ar?: string;
  poster_url?: string;
}

export interface Film extends FilmBase {
  genres: string[];
  cast: CastMember[];
  crew: CrewMember[];
  tags_en: string[];
  tags_ar: string[];
  created_at: string;
  updated_at: string;
}

export interface FilmDetailed extends Film {
  people_details: {
    cast: CastMemberDetailed[];
    crew: CrewMemberDetailed[];
  };
}

// Cast types
export interface CastMember {
  person_id: number;
  name_en: string;
  name_ar?: string;
  role_name?: string;
  imdb_rating?: number;
  display_order: number;
}

export interface CastMemberDetailed extends CastMember {
  bio_en?: string;
  bio_ar?: string;
  birth_year?: number;
  image_url?: string;
}

// Crew types
export interface CrewMember {
  person_id: number;
  name_en: string;
  name_ar?: string;
  role_name: string;
  role_id: number;
}

export interface CrewMemberDetailed extends CrewMember {
  bio_en?: string;
  bio_ar?: string;
  birth_year?: number;
  image_url?: string;
}

// Person types
export interface Person {
  id: number;
  name_en: string;
  name_ar?: string;
  birth_year?: number;
  bio_en?: string;
  bio_ar?: string;
  image_url?: string;
  imdb_id?: string;
  created_at: string;
  updated_at: string;
}

// Genre types
export interface Genre {
  id: number;
  name_en: string;
  name_ar?: string;
}

// Tag types
export interface Tag {
  id: number;
  name_en?: string;
  name_ar?: string;
  category: string;
}

// Request/Response types
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export interface SearchParams {
  q: string;
  language?: 'en' | 'ar' | 'both';
  year?: number;
  genre?: string;
  tag?: string;
  type?: 'film' | 'person';
  page?: number;
  limit?: number;
}

export interface SearchResponse {
  results: {
    films?: Film[];
    people?: Person[];
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
  query: string;
  suggestions?: string[];
}

export interface AISearchRequest {
  query: string;
  language?: 'en' | 'ar';
  max_results?: number;
}

export interface AIRecommendationRequest {
  film_id: number;
  max_results?: number;
}

export interface AIRecommendation {
  film: Film;
  similarity_score: number;
  reason: string;
}

// Filter types
export interface FilmFilters {
  year_min?: number;
  year_max?: number;
  genre_ids?: number[];
  tag_ids?: number[];
  duration_min?: number;
  duration_max?: number;
  search?: string;
}

// Error response
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// API Health
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  timestamp: string;
  services: {
    database: 'ok' | 'error';
    ai: 'ok' | 'error' | 'disabled';
    storage: 'ok' | 'error';
  };
}

// Statistics
export interface StatisticsResponse {
  total_films: number;
  total_people: number;
  total_genres: number;
  total_tags: number;
  years_covered: {
    min: number;
    max: number;
  };
  last_updated: string;
}
