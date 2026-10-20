/**
 * Response headers safe to log. Anything not listed here — `set-cookie`
 * especially — is dropped.
 */
const HEADERS = ["content-type", "content-length"] as const

/**
 * The parts of an Express response the serializer reads.
 */
export interface SerializableResponse {
  statusCode: number
  getHeader(name: string): unknown
}

/**
 * The shape a response is logged as under the `res` field.
 */
export interface SerializedResponse {
  statusCode: number
  headers: Partial<Record<(typeof HEADERS)[number], string>>
}

/**
 * Pino serializer reducing an Express response to its status code and an
 * allow-list of headers.
 *
 * @param res - The response attached to the log entry.
 *
 * @returns The serialized response.
 */
export const serializeResponse = (
  res: SerializableResponse,
): SerializedResponse => ({
  statusCode: res.statusCode,
  headers: Object.fromEntries(
    HEADERS.filter((name) => res.getHeader(name) !== undefined).map((name) => [
      name,
      String(res.getHeader(name)),
    ]),
  ),
})
