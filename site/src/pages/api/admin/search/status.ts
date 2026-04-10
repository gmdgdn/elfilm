import type { APIRoute } from "astro"

import { getSearchIndexStatus } from "../../../../lib/archive"
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

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const info = await getSearchIndexStatus()
  return new Response(JSON.stringify({ info }), {
    headers: { "content-type": "application/json" },
  })
}
