import os from "node:os"

import { getRequest } from "@neomaventures/request-context"
import pino from "pino"

import { type LoggerConfig } from "../interfaces/logger-config.interface"
import {
  type LogContext,
  type Logger,
  type LogLevel,
} from "../interfaces/logger.interface"
import { type LoggingModuleOptions } from "../interfaces/logging-module-options.interface"

const REDACTED = "[REDACTED]"
const NAMESPACED_FLOOR: LogLevel = "error"

/**
 * Module-private cache keying a pino root to the exact options object it was
 * built from. `LoggingModule.forRoot` resolves a single options instance per
 * module registration, so identity-based caching gives us one shared root per
 * `forRoot` call without exposing a class or a global singleton.
 */
const roots = new WeakMap<LoggingModuleOptions, pino.Logger>()

const buildRoot = (options: LoggingModuleOptions): pino.Logger => {
  const { destination = null, redact = [], context } = options
  const hasContext = context && Object.keys(context).length > 0
  const base = hasContext
    ? { pid: process.pid, hostname: os.hostname(), ...context }
    : undefined
  return pino(
    {
      // Lowest possible level on the root — per-child levels enforce filtering.
      level: "trace",
      redact: { paths: [...redact], censor: REDACTED },
      // Omitting `base` entirely preserves pino's default `pid` + `hostname`.
      // Passing `base: {...}` replaces those defaults, so we only set it when
      // the consumer supplied a context and we can merge the defaults back in.
      ...(base ? { base } : {}),
    },
    // `destination` is typed `any` on LoggingModuleOptions to accept anything
    // pino can write to (streams, sonic-boom, transports, etc.).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    destination,
  )
}

const rootFor = (options: LoggingModuleOptions): pino.Logger => {
  const cached = roots.get(options)
  if (cached) return cached
  const root = buildRoot(options)
  roots.set(options, root)
  return root
}

/**
 * Emit at the requested level. An explicit switch keeps level dispatch
 * statically analysable — no dynamic property access on the pino instance.
 *
 * Note: `'silent'` is a configured level only, never an emission level — the
 * {@link Logger} contract has no `silent(...)` method. The case is unreachable
 * but listed to keep the switch exhaustive over {@link LogLevel}.
 */
const emitAt = (
  instance: pino.Logger,
  level: Exclude<LogLevel, "silent">,
  payload: Record<string, unknown>,
  message: string,
): void => {
  switch (level) {
    case "trace":
      instance.trace(payload, message)
      return
    case "debug":
      instance.debug(payload, message)
      return
    case "info":
      instance.info(payload, message)
      return
    case "warn":
      instance.warn(payload, message)
      return
    case "error":
      instance.error(payload, message)
      return
    case "fatal":
      instance.fatal(payload, message)
      return
  }
}

/**
 * Wrap a pino logger in the {@link Logger} contract, attaching the current
 * request from `@neomaventures/request-context` to every entry.
 */
const wrap = (instance: pino.Logger): Logger => {
  const emit = (
    level: Exclude<LogLevel, "silent">,
    message: string,
    context?: LogContext,
  ): void => {
    const request = getRequest()
    const reqField = request ? { req: request } : {}
    emitAt(instance, level, { ...context, ...reqField }, message)
  }
  return {
    trace: (m, c) => emit("trace", m, c),
    debug: (m, c) => emit("debug", m, c),
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
    fatal: (m, c) => emit("fatal", m, c),
  }
}

/**
 * Build a namespaced {@link Logger} backed by the pino root configured from
 * {@link LoggingModuleOptions}. Used internally by
 * {@link LoggingModule.forFeature}; consumers normally use `@InjectLogger` to
 * resolve a registered logger rather than calling this directly.
 *
 * Resolves the effective level honouring the precedence chain:
 *
 * 1. `LoggingModuleOptions.loggers[namespace].level` (app override).
 * 2. The `config.level` passed here (package default from `forFeature`).
 * 3. Built-in `'error'` floor.
 *
 * `LoggingModuleOptions.defaultLevel` is **not** consulted — it applies to
 * {@link ApplicationLogger} only.
 *
 * @param options - The resolved root options for the module registration.
 * @param config - Namespace + optional package-default level / name.
 * @returns A pino child logger satisfying {@link Logger}.
 *
 * @example
 * ```ts
 * const log = createLogger(options, { namespace: "neomaventures:auth" })
 * log.info("user signed in", { userId })
 * ```
 */
export const createLogger = (
  options: LoggingModuleOptions,
  config: LoggerConfig,
): Logger => {
  const override = (options.loggers ?? []).find(
    (c) => c.namespace === config.namespace,
  )?.level
  const level = override ?? config.level ?? NAMESPACED_FLOOR
  const root = rootFor(options)
  const child = root.child(
    { ns: config.namespace, ...(config.name ? { name: config.name } : {}) },
    { level },
  )
  return wrap(child)
}

/**
 * Internal accessor for the pino root associated with a given options object.
 * Used by {@link ApplicationLogger}'s provider to share a single pino instance
 * with every namespaced logger produced from the same `forRoot` call.
 *
 * @internal
 */
export const getPinoRoot = (options: LoggingModuleOptions): pino.Logger =>
  rootFor(options)
