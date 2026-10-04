import { getRequest } from "@neomaventures/request-context"
import { Inject, Injectable } from "@nestjs/common"
import pino from "pino"

import {
  type LogContext,
  type Logger,
  type LogLevel,
} from "../interfaces/logger.interface"
import { type LoggingModuleOptions } from "../interfaces/logging-module-options.interface"
import { LOGGING_MODULE_OPTIONS } from "../symbols"

import { getPinoRoot } from "./create-logger"

const APP_DEFAULT: LogLevel = "info"

/**
 * App-wide default logger. The class itself doubles as its DI token —
 * `@Inject(ApplicationLogger)` (or `@InjectLogger()`) resolves an instance.
 *
 * - Bound to `LoggingModuleOptions.defaultLevel` (default `'info'`) with no
 *   namespace.
 * - Shares a single underlying pino root with every namespaced logger
 *   produced by {@link createLogger}.
 * - Retains the **static delegate** pattern: `ApplicationLogger.info(...)`,
 *   `ApplicationLogger.error(...)`, etc., write through the most recently
 *   constructed instance. Static calls before the module boots are no-ops.
 *   Provided for code paths that cannot use DI (bootstrap, top-level scripts).
 *
 * @see Logger — the instance method contract.
 *
 * @example
 * ```ts
 * // DI usage
 * constructor(@InjectLogger() private readonly logger: ApplicationLogger) {}
 *
 * // Static usage (bootstrap, no DI available)
 * ApplicationLogger.info("server starting", { port })
 * ```
 */
@Injectable()
export class ApplicationLogger implements Logger {
  private static instance: ApplicationLogger | null = null

  private readonly pino: pino.Logger

  /**
   * @param options - The resolved root options, injected from the internal
   *   `LOGGING_MODULE_OPTIONS` token. The `defaultLevel` field controls the
   *   level of the app-wide logger (`'info'` if omitted).
   */
  public constructor(
    @Inject(LOGGING_MODULE_OPTIONS)
    options: LoggingModuleOptions = {},
  ) {
    const level = options.defaultLevel ?? APP_DEFAULT
    this.pino = getPinoRoot(options).child({}, { level })
    ApplicationLogger.instance = this
  }

  /** @inheritDoc */
  public trace(message: string, context?: LogContext): void {
    this.logAtLevel("trace", message, context)
  }

  /** @inheritDoc */
  public debug(message: string, context?: LogContext): void {
    this.logAtLevel("debug", message, context)
  }

  /** @inheritDoc */
  public info(message: string, context?: LogContext): void {
    this.logAtLevel("info", message, context)
  }

  /** @inheritDoc */
  public warn(message: string, context?: LogContext): void {
    this.logAtLevel("warn", message, context)
  }

  /** @inheritDoc */
  public error(message: string, context?: LogContext): void {
    this.logAtLevel("error", message, context)
  }

  /** @inheritDoc */
  public fatal(message: string, context?: LogContext): void {
    this.logAtLevel("fatal", message, context)
  }

  /**
   * Static delegate for {@link ApplicationLogger#trace}. Routes through the
   * most recently constructed instance; no-op before the module boots.
   */
  public static trace(message: string, context?: LogContext): void {
    ApplicationLogger.instance?.trace(message, context)
  }

  /** @see ApplicationLogger.trace */
  public static debug(message: string, context?: LogContext): void {
    ApplicationLogger.instance?.debug(message, context)
  }

  /** @see ApplicationLogger.trace */
  public static info(message: string, context?: LogContext): void {
    ApplicationLogger.instance?.info(message, context)
  }

  /** @see ApplicationLogger.trace */
  public static warn(message: string, context?: LogContext): void {
    ApplicationLogger.instance?.warn(message, context)
  }

  /** @see ApplicationLogger.trace */
  public static error(message: string, context?: LogContext): void {
    ApplicationLogger.instance?.error(message, context)
  }

  /** @see ApplicationLogger.trace */
  public static fatal(message: string, context?: LogContext): void {
    ApplicationLogger.instance?.fatal(message, context)
  }

  /**
   * Test hook — reset the static instance pointer. Used in unit specs so a
   * fresh module compile is not contaminated by a prior test's instance.
   *
   * @internal
   */
  public static resetForTests(): void {
    ApplicationLogger.instance = null
  }

  private logAtLevel(
    level: Exclude<LogLevel, "silent">,
    message: string,
    context?: LogContext,
  ): void {
    const request = getRequest()
    const reqField = request ? { req: request } : {}
    const payload = { ...context, ...reqField }
    switch (level) {
      case "trace":
        this.pino.trace(payload, message)
        return
      case "debug":
        this.pino.debug(payload, message)
        return
      case "info":
        this.pino.info(payload, message)
        return
      case "warn":
        this.pino.warn(payload, message)
        return
      case "error":
        this.pino.error(payload, message)
        return
      case "fatal":
        this.pino.fatal(payload, message)
        return
    }
  }
}
