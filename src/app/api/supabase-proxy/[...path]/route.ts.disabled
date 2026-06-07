import { NextRequest, NextResponse } from "next/server"

// Server-only env var — the raw Supabase project URL, never exposed to the browser
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Headers from the client request that should be forwarded to Supabase
const FORWARD_REQUEST_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "prefer",
  "range",
  "x-client-info",
  "x-upsert",
]

// Headers from Supabase's response that should be forwarded to the client
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-range",
  "x-total-count",
  "location",
  "sb-gateway-version",
  "x-supabase-api-version",
  "retry-after",
  "etag",
]

async function handleProxy(
  request: NextRequest,
  resolvedParams: { path: string[] }
): Promise<NextResponse> {
  if (!SUPABASE_URL) {
    return NextResponse.json({ error: "Proxy not configured" }, { status: 500 })
  }

  const pathStr = resolvedParams.path.join("/")
  const { search } = new URL(request.url)
  const targetUrl = `${SUPABASE_URL}/${pathStr}${search}`

  // Build forwarded headers
  const upstreamHeaders = new Headers()
  for (const header of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(header)
    if (value) upstreamHeaders.set(header, value)
  }
  // Always ensure apikey is present — fall back to anon key if client omitted it
  if (!upstreamHeaders.get("apikey")) {
    upstreamHeaders.set("apikey", SUPABASE_ANON_KEY)
  }

  // Forward body for methods that carry one
  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const body = hasBody ? await request.arrayBuffer() : undefined

  let upstream: Response
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body,
      // Forward redirects as-is to the browser (important for OAuth authorize)
      redirect: "manual",
    })
  } catch (err) {
    console.error("[supabase-proxy] fetch error:", err)
    return NextResponse.json({ error: "Upstream unreachable" }, { status: 502 })
  }

  // Build response headers
  const responseHeaders = new Headers()
  for (const header of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(header)
    if (value) responseHeaders.set(header, value)
  }

  // CORS — required for browser clients
  responseHeaders.set("access-control-allow-origin", "*")
  responseHeaders.set(
    "access-control-allow-methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  )
  responseHeaders.set(
    "access-control-allow-headers",
    "authorization, apikey, content-type, prefer, range, x-client-info, x-upsert"
  )
  responseHeaders.set(
    "access-control-expose-headers",
    "content-range, x-total-count, sb-gateway-version"
  )

  const responseBody = await upstream.arrayBuffer()

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

// Export each HTTP method Supabase uses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

// Preflight — browsers send this before cross-origin requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers":
        "authorization, apikey, content-type, prefer, range, x-client-info, x-upsert",
      "access-control-max-age": "86400",
    },
  })
}
