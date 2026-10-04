/**
 * Canonical log level vocabulary across `@neomaventures/*` packages.
 *
 * Ordered from lowest to highest severity. Setting a level enables that level
 * **and every level above it** — i.e. setting `level: 'warn'` emits `warn`,
 * `error`, and `fatal` but suppresses `trace`, `debug`, and `info`.
 *
 * | Level    | Fires when level is set to                          |
 * |----------|-----------------------------------------------------|
 * | `trace`  | `trace` only                                        |
 * | `debug`  | `trace`, `debug`                                    |
 * | `info`   | `trace`, `debug`, `info`                            |
 * | `warn`   | `trace`, `debug`, `info`, `warn`                    |
 * | `error`  | `trace`, `debug`, `info`, `warn`, `error`           |
 * | `fatal`  | every level                                         |
 * | `silent` | nothing — pino suppresses all entries on this child |
 *
 * Values map 1:1 to pino's native level vocabulary — no translation layer.
 *
 * Exposed as a **const object** so consumers reference levels via importable
 * identifiers (`LogLevel.Debug`) rather than magic strings, matching the rest
 * of the pack's namespace/token/scope conventions. The companion `LogLevel`
 * type resolves to the union of values, so existing call sites passing string
 * literals still typecheck.
 *
 * @example
 * ```ts
 * import { LogLevel, LoggingModule } from "@neomaventures/logging"
 *
 * LoggingModule.forRoot({ defaultLevel: LogLevel.Debug })
 * // ApplicationLogger now emits debug + info + warn + error + fatal
 * ```
 */
export const LogLevel = {
  Trace: "trace",
  Debug: "debug",
  Info: "info",
  Warn: "warn",
  Error: "error",
  Fatal: "fatal",
  Silent: "silent",
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

/**
 * Structured context merged into a log entry.
 *
 * The `err` key is **reserved by pino** — passing an `Error` under any other
 * key will not get pino's stack/cause serialisation. Place the underlying
 * error under `err` and any other fields alongside it.
 *
 * @example
 * ```ts
 * logger.error("payment failed", { err, accountId, attempt: 3 })
 * ```
 */
export type LogContext = {
  /**
   * Attached error. When this is an `Error`, pino's default serializer
   * extracts `{ type, message, stack }` into the log entry.
   */
  err?: unknown
} & Record<string, unknown>

/**
 * Structured logger contract implemented by both `ApplicationLogger` and the
 * per-namespace loggers registered via `LoggingModule.forFeature`.
 *
 * Each level method writes a single structured entry. Calls below the
 * resolved level for this logger are no-ops (pino enforces this at the child
 * level).
 *
 * @see LoggingModule.forFeature — to register a namespaced `Logger`.
 * @see ApplicationLogger — for the app-wide instance.
 */
export interface Logger {
  /**
   * Write a `trace`-level entry. Highest verbosity; typically disabled in
   * production.
   *
   * @param message - Human-readable summary of the event.
   * @param context - Optional structured fields merged into the entry.
   *
   * @example
   * ```ts
   * logger.trace("entering handler", { route: req.path })
   * ```
   */
  trace(message: string, context?: LogContext): void

  /**
   * Write a `debug`-level entry. Diagnostic detail useful when investigating
   * a specific issue; usually disabled in production.
   *
   * @param message - Human-readable summary of the event.
   * @param context - Optional structured fields merged into the entry.
   */
  debug(message: string, context?: LogContext): void

  /**
   * Write an `info`-level entry. Normal operational events worth recording
   * (request completed, job dispatched, user signed in).
   *
   * @param message - Human-readable summary of the event.
   * @param context - Optional structured fields merged into the entry.
   */
  info(message: string, context?: LogContext): void

  /**
   * Write a `warn`-level entry. Recoverable problems or unusual conditions
   * that may warrant attention but did not break the request.
   *
   * @param message - Human-readable summary of the event.
   * @param context - Optional structured fields merged into the entry.
   */
  warn(message: string, context?: LogContext): void

  /**
   * Write an `error`-level entry. A handled failure: caught exception, failed
   * external call, validation rejection. Pass the underlying error as
   * `context.err` for pino's reserved error serialisation.
   *
   * @param message - Human-readable summary of the failure.
   * @param context - Optional structured fields. Place the error under `err`.
   *
   * @example
   * ```ts
   * try { await charge(account) }
   * catch (err) { logger.error("charge failed", { err, accountId: account.id }) }
   * ```
   */
  error(message: string, context?: LogContext): void

  /**
   * Write a `fatal`-level entry. Unrecoverable failure — the process is about
   * to exit or the request can no longer be served meaningfully.
   *
   * @param message - Human-readable summary of the failure.
   * @param context - Optional structured fields. Place the error under `err`.
   */
  fatal(message: string, context?: LogContext): void
}
