"use server"

import { cookies } from "next/headers"

type AdminQueryValue = string | number | boolean | null | undefined

export interface AdminRequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, AdminQueryValue>
}

function resolveAdminBaseUrl() {
  return process.env.ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787"
}

function appendQuery(url: URL, query?: Record<string, AdminQueryValue>) {
  if (!query) {
    return
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue
    }

    url.searchParams.set(key, String(value))
  }
}

function normalizeRequestBody(body: unknown) {
  if (body === undefined || body === null) {
    return undefined
  }

  if (typeof body === "string") {
    return body
  }

  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob || body instanceof ArrayBuffer) {
    return body
  }

  return JSON.stringify(body)
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Record<string, unknown>
      const message =
        payload.error ||
        payload.message ||
        payload.detail ||
        payload.reason ||
        payload.statusText

      if (typeof message === "string" && message.trim()) {
        return message
      }
    } catch {
      // Fall through to text parsing.
    }
  }

  try {
    const text = await response.text()
    if (text.trim()) {
      return text.trim()
    }
  } catch {
    // Ignore and use the fallback below.
  }

  return `Request failed with status ${response.status}`
}

function timingSafeStringEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.max(leftBytes.length, rightBytes.length)
  let diff = leftBytes.length ^ rightBytes.length

  for (let index = 0; index < length; index++) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }

  return diff === 0
}

export async function hasAdminSession() {
  const expectedToken = process.env.ADMIN_SESSION_TOKEN
  if (!expectedToken) {
    return false
  }

  const cookieName = process.env.ADMIN_SESSION_COOKIE_NAME || "elfilm_admin_session"
  const cookieStore = await cookies()
  const presentedToken = cookieStore.get(cookieName)?.value || ""

  return timingSafeStringEqual(presentedToken, expectedToken)
}

export async function requireAdminSession() {
  if (!(await hasAdminSession())) {
    throw new Error("Admin session is not authorized.")
  }
}

export async function requestAdmin<T>(endpoint: string, options: AdminRequestOptions = {}): Promise<T> {
  await requireAdminSession()

  const apiKey = process.env.ADMIN_API_KEY
  if (!apiKey) {
    throw new Error("ADMIN_API_KEY is not configured on the server.")
  }

  const url = new URL(endpoint, resolveAdminBaseUrl())
  appendQuery(url, options.query)

  const headers = new Headers()
  headers.set("Authorization", `Bearer ${apiKey}`)
  headers.set("Accept", "application/json")

  const body = normalizeRequestBody(options.body)
  if (
    body !== undefined &&
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams) &&
    !(options.body instanceof Blob) &&
    !(options.body instanceof ArrayBuffer)
  ) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Unauthorized while calling ${url.pathname}. ${message}`)
    }

    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return (await response.json()) as T
  }

  const text = await response.text()
  return text as unknown as T
}
