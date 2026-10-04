import { type ModuleMetadata } from "@nestjs/common"

import { type LoggerConfig } from "./logger-config.interface"
import { type LogLevel } from "./logger.interface"

/**
 * Top-level options passed to `LoggingModule.forRoot`.
 *
 * @see LoggingModule.forRoot
 * @see LoggingModule.forRootAsync
 */
export interface LoggingModuleOptions {
  /**
   * Level for `ApplicationLogger` **only** — the app's own logger.
   *
   * Default: `'info'`.
   *
   * Does **not** apply to namespaced (package) loggers. Namespaced loggers
   * floor at `'error'` regardless of this setting, and are raised only via
   * `loggers[ns].level` (app override) or the package's own `forFeature`
   * entry. This is intentional: raising the app's verbosity must not turn
   * every Neoma package in the graph into a firehose.
   *
   * @example
   * ```ts
   * LoggingModule.forRoot({ defaultLevel: "debug" })
   * // ApplicationLogger emits debug+; package loggers still floor at error.
   * ```
   */
  defaultLevel?: LogLevel

  /**
   * App-level overrides for namespaced loggers. Each entry's `level` takes
   * priority over the matching `forFeature` entry's `level` and over the
   * built-in `'error'` floor. Entries referencing namespaces no package
   * registers are no-ops.
   *
   * @example
   * ```ts
   * LoggingModule.forRoot({
   *   loggers: [
   *     { namespace: "neomaventures:auth", level: "debug" },
   *     { namespace: "neomaventures:storage", level: "trace" },
   *   ],
   * })
   * ```
   */
  loggers?: ReadonlyArray<LoggerConfig>

  /**
   * Destination passed straight to pino. Accepts anything pino accepts
   * (`pino.destination(...)`, a `WriteStream`, etc.). Defaults to stdout.
   */
  destination?: any

  /**
   * Field paths redacted from log entries (pino `redact` syntax).
   *
   * @example
   * ```ts
   * { redact: ["req.headers.authorization", "*.password"] }
   * ```
   */
  redact?: ReadonlyArray<string>

  /**
   * Static fields stamped onto every entry from every logger sharing this
   * root (service name, deployment, region, etc.).
   */
  context?: Record<string, unknown>

  /**
   * Whether the bundled `RequestLoggerInterceptor` should emit an entry for
   * thrown exceptions. Default: `true`.
   */
  logErrors?: boolean
}

/**
 * Async counterpart to {@link LoggingModuleOptions}. Mirrors the standard
 * NestJS `useFactory` async-module shape.
 *
 * @see LoggingModule.forRootAsync
 *
 * @example
 * ```ts
 * LoggingModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     defaultLevel: config.get("LOG_LEVEL"),
 *   }),
 * })
 * ```
 */
export interface LoggingModuleAsyncOptions {
  /** Modules required to resolve `inject` tokens inside `useFactory`. */
  imports?: ModuleMetadata["imports"]
  /** Providers injected positionally into `useFactory`. */
  inject?: any[]
  /** Factory returning resolved {@link LoggingModuleOptions} (sync or async). */
  useFactory: (
    ...args: any[]
  ) => LoggingModuleOptions | Promise<LoggingModuleOptions>
}
