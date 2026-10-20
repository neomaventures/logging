/**
 * Request headers safe to log. Anything not listed here — cookies,
 * authorization, custom tokens — is dropped.
 */
const HEADERS = [
  "accept",
  "content-type",
  "content-length",
  "user-agent",
  "x-request-id",
] as const

/**
 * The parts of an Express request the serializer reads.
 */
export interface SerializableRequest {
  method: string
  url: string
  originalUrl?: string
  route?: { path?: unknown }
  ip?: string
  headers: Record<string, string | string[] | undefined>
}

/**
 * The shape a request is logged as under the `req` field.
 */
export interface SerializedRequest {
  method: string
  path: string
  route?: string
  ip?: string
  headers: Partial<Record<(typeof HEADERS)[number], string | string[]>>
}

/**
 * Pino serializer reducing an Express request to the fields worth logging.
 *
 * - `path` comes from `originalUrl` because Express strips the mount path from
 *   `req.path` inside middleware. The query string is dropped as it can carry
 *   secrets (e.g. OAuth codes).
 * - `route` is the matched pattern (`/accounts/:id`) and is only present once
 *   routing has happened, i.e. not in middleware.
 * - `headers` is restricted to an allow-list.
 *
 * @param req - The request attached to the log entry.
 *
 * @returns The serialized request.
 */
export const serializeRequest = (
  req: SerializableRequest,
): SerializedRequest => {
  const url = req.originalUrl ?? req.url
  const route = req.route?.path

  return {
    method: req.method,
    path: url.split("?")[0],
    ...(typeof route === "string" ? { route } : {}),
    ip: req.ip,
    headers: Object.fromEntries(
      HEADERS.filter((name) => req.headers[name] !== undefined).map((name) => [
        name,
        req.headers[name],
      ]),
    ),
  }
}
