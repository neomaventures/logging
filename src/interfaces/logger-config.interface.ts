import { type LogLevel } from "./logger.interface"

/**
 * Per-namespace logger configuration. Used by both:
 *
 * 1. `LoggingModule.forFeature([...])` — a package registering its own logger.
 * 2. `LoggingModuleOptions.loggers[]` — an app overriding a package's level.
 *
 * @see LoggingModule.forFeature
 * @see LoggingModuleOptions.loggers
 */
export interface LoggerConfig {
  /**
   * Globally-unique namespace, e.g. `'neomaventures:auth'`. This is the key
   * both the registering package and the consuming app use to refer to this
   * logger. Convention: `'<vendor>:<package>[:<sublabel>]'`.
   */
  namespace: string

  /**
   * Level for this namespace. **Rarely set by packages** — packages should
   * generally not ask to be louder than `'error'`; let consumers opt in.
   *
   * When set on a `forFeature` entry: that is the package's own default.
   * When set on `LoggingModuleOptions.loggers[]`: that is the app override
   * and takes priority over any package default.
   */
  level?: LogLevel

  /**
   * Optional pino `name` field stamped on every entry from this logger.
   * Defaults to the namespace if omitted.
   */
  name?: string
}
