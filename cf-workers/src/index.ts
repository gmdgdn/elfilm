// ElFilm API - Main Cloudflare Workers entry point

import { createRouter } from './api/routes';
import { Env } from './types';

const app = createRouter();

// Export the worker handler
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    app.fetch(request, env),
};

// Optional: Handle scheduled events for cleanup/maintenance
export const scheduled: ExportedHandler<Env>['scheduled'] = async (event, env, ctx) => {
  // Clean up old search queries (older than 30 days)
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      `DELETE FROM search_queries WHERE created_at < ?`
    )
      .bind(thirtyDaysAgo)
      .run();

    console.log('Cleaned up old search queries');
  } catch (error) {
    console.error('Error cleaning up search queries:', error);
  }
};
