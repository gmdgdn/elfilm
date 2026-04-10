import type { APIRoute } from "astro"

import { reindexMovieSearchBatch } from "../../../../lib/archive"
import { env } from "cloudflare:workers"

export const prerender = false

function isAuthorized(request: Request) {
  const configuredKey = (env as { ADMIN_API_KEY?: string }).ADMIN_API_KEY
  if (!configuredKey) {
    return false
  }

  const authHeader = request.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const direct = request.headers.get("x-admin-key")

  return bearer === configuredKey || direct === configuredKey
}

export const POST: APIRoute = async ({ request, url }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const body = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => ({}))
    : {}

  const limitInput = Number((body as { limit?: number }).limit ?? url.searchParams.get("limit") ?? 50)
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.trunc(limitInput), 1), 100) : 50
  const afterId = typeof (body as { afterId?: unknown }).afterId === "string"
    ? (body as { afterId: string }).afterId
    : url.searchParams.get("afterId")

  const result = await reindexMovieSearchBatch(limit, afterId)

  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  })
}
