// Cloudflare AI integration for semantic search and recommendations

import { Env, Film, AIRecommendation, SearchResponse } from './types';
import { Database } from './db';

export class AIService {
  constructor(private ai: Ai, private db: Database) {}

  /**
   * Use Cloudflare AI to generate embeddings for semantic search
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.ai.run('@cf/baai/bge-small-en-v1.5', {
        text: text,
      });

      return response as any;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Summarize a film's plot using AI
   */
  async summarizePlot(plot: string, language: 'en' | 'ar' = 'en'): Promise<string> {
    try {
      const prompt =
        language === 'ar'
          ? `لخص هذه القصة بجملة أو جملتين: ${plot}`
          : `Summarize this plot in 1-2 sentences: ${plot}`;

      const response = await this.ai.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: prompt,
        max_tokens: 150,
      });

      return (response as any).response || '';
    } catch (error) {
      console.error('Error summarizing plot:', error);
      return plot.substring(0, 200) + '...';
    }
  }

  /**
   * Generate recommendations based on a film's genres and themes
   */
  async recommendSimilarFilms(
    filmId: number,
    maxResults: number = 5
  ): Promise<AIRecommendation[]> {
    try {
      // Get the film
      const film = await this.db.getFilm(filmId, {} as Env);
      if (!film) {
        throw new Error('Film not found');
      }

      // Build a description of the film for similarity matching
      const filmDescription = `
        Title: ${film.title_en}
        Arabic Title: ${film.title_ar}
        Year: ${film.production_year}
        Genres: ${film.genres.join(', ')}
        Type: ${film.film_type}
        Tags: ${film.tags_en.join(', ')}
        Duration: ${film.duration_minutes} minutes
      `;

      // Generate embedding for the film
      const filmEmbedding = await this.generateEmbedding(filmDescription);

      // Get all other films from the same year or nearby years
      const candidateYears = [
        film.production_year - 2,
        film.production_year - 1,
        film.production_year,
        film.production_year + 1,
        film.production_year + 2,
      ];

      const candidates = await Promise.all(
        candidateYears.map(year =>
          this.db.getFilmsByYear(year, 50, 0)
        )
      );

      const allCandidates = candidates
        .flat()
        .filter((f: any) => f.id !== filmId)
        .slice(0, 50);

      // Calculate similarity scores (simplified - in production, use vector similarity)
      const recommendations: AIRecommendation[] = await Promise.all(
        allCandidates.map(async (candidate: any) => {
          const candidateDesc = `
            Title: ${candidate.title_en}
            Genres: ${candidate.genres?.join(', ') || ''}
            Tags: ${candidate.tags_en?.join(', ') || ''}
          `;

          // Simplified similarity based on genres and tags
          let similarityScore = 0;
          const filmGenreSet = new Set(film.genres);
          const candidateGenres = candidate.genres || [];
          const commonGenres = candidateGenres.filter((g: string) => filmGenreSet.has(g)).length;
          similarityScore += commonGenres * 0.3;

          const filmTagSet = new Set(film.tags_en);
          const candidateTags = candidate.tags_en || [];
          const commonTags = candidateTags.filter((t: string) => filmTagSet.has(t)).length;
          similarityScore += commonTags * 0.2;

          // Year proximity bonus
          const yearDiff = Math.abs(candidate.production_year - film.production_year);
          similarityScore += Math.max(0, 1 - yearDiff / 10) * 0.2;

          const reason = `Similar genres: ${commonGenres} match${
            commonTags > 0 ? `, ${commonTags} shared tags` : ''
          }`;

          return {
            film: candidate,
            similarity_score: similarityScore,
            reason,
          };
        })
      );

      // Sort by similarity and return top results
      return recommendations
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, maxResults);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Translate text between English and Arabic
   */
  async translate(text: string, targetLanguage: 'en' | 'ar'): Promise<string> {
    try {
      const systemPrompt =
        targetLanguage === 'ar'
          ? 'You are a translator. Translate the following English text to Arabic. Reply with only the translation, no explanations.'
          : 'You are a translator. Translate the following Arabic text to English. Reply with only the translation, no explanations.';

      const response = await this.ai.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: `${systemPrompt}\n\nText: ${text}`,
        max_tokens: 500,
      });

      return (response as any).response || text;
    } catch (error) {
      console.error('Error translating text:', error);
      return text;
    }
  }

  /**
   * Generate smart search suggestions based on user input
   */
  async generateSearchSuggestions(query: string): Promise<string[]> {
    try {
      const response = await this.ai.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: `You are a movie database assistant. Generate 3-5 related search queries for the following user query. Return them as a JSON array.

        User query: "${query}"

        Response format: ["suggestion1", "suggestion2", "suggestion3"]

        Only return the JSON array, nothing else.`,
        max_tokens: 200,
      });

      const text = (response as any).response || '[]';
      try {
        return JSON.parse(text);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  /**
   * Generate search explanation in natural language
   */
  async explainSearchResults(query: string, resultsCount: number): Promise<string> {
    try {
      if (resultsCount === 0) {
        return `No films found matching "${query}". Try using different keywords.`;
      }

      const response = await this.ai.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: `You are a movie database assistant. Write a brief, friendly explanation of what the user will find.

        User searched for: "${query}"
        Results found: ${resultsCount} films

        Generate a 1-2 sentence explanation.`,
        max_tokens: 100,
      });

      return (response as any).response || `Found ${resultsCount} films matching your search.`;
    } catch (error) {
      console.error('Error explaining results:', error);
      return `Found ${resultsCount} films matching your search.`;
    }
  }

  /**
   * Classify film content (genre, themes) using AI
   */
  async classifyFilm(title: string, summary: string): Promise<{ genres: string[]; themes: string[] }> {
    try {
      const response = await this.ai.run('@cf/meta/llama-2-7b-chat-int8', {
        prompt: `Classify this film:

Title: ${title}
Summary: ${summary}

Respond with a JSON object with "genres" (list of genres) and "themes" (list of themes).
Only return the JSON object.`,
        max_tokens: 200,
      });

      const text = (response as any).response || '{"genres": [], "themes": []}';
      try {
        return JSON.parse(text);
      } catch {
        return { genres: [], themes: [] };
      }
    } catch (error) {
      console.error('Error classifying film:', error);
      return { genres: [], themes: [] };
    }
  }
}

export function createAIService(env: Env, db: Database): AIService {
  return new AIService(env.AI, db);
}
