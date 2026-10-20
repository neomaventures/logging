import {
  ConfigurableModuleBuilder,
  type DynamicModule,
  Module,
} from "@nestjs/common"
import { APP_INTERCEPTOR } from "@nestjs/core"

import { RequestLoggerInterceptor } from "./interceptors/request-logger.interceptor"
import { type LoggerConfig } from "./interfaces/logger-config.interface"
import { type LoggingModuleOptions } from "./interfaces/logging-module-options.interface"
import { ApplicationLogger } from "./services/application-logger"
import { createLogger } from "./services/create-logger"
import { LOGGING_MODULE_OPTIONS, LOGGING_NAMESPACE } from "./symbols"

/**
 * Generates `forRoot` / `forRootAsync`. The transform runs for both, so the
 * global flag, providers and the request logger's namespaced logger are
 * defined once and the two methods cannot drift apart.
 */
const { ConfigurableModuleClass } =
  new ConfigurableModuleBuilder<LoggingModuleOptions>({
    optionsInjectionToken: LOGGING_MODULE_OPTIONS,
  })
    .setClassMethodName("forRoot")
    .setExtras({}, (definition): DynamicModule => ({
      ...definition,
      global: true,
      imports: [
        ...(definition.imports ?? []),
        // The request logger's namespaced logger, registered like any package's.
        LoggingModule.forFeature([LOGGING_NAMESPACE]),
      ],
      providers: [
        ...(definition.providers ?? []),
        ApplicationLogger,
        { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
      ],
      // `LOGGING_MODULE_OPTIONS` is exported so `forFeature` providers can
      // resolve it without re-registering. It remains internal to consumers —
      // only the per-namespace logger token is meant to be injected.
      exports: [ApplicationLogger, LOGGING_MODULE_OPTIONS],
    }))
    .build()

/**
 * NestJS module providing structured logging.
 *
 * Register the root via `forRoot(options)` / `forRootAsync(options)` once at
 * the app's root module — it is global and provides {@link ApplicationLogger}
 * and the request logger. Pass `{}` for the defaults (`info` level, stdout, no
 * overrides). Register per-package namespaced loggers via `forFeature()`
 * inside each package's own module.
 *
 * `forRootAsync` accepts Nest's standard async options: `useFactory` (with
 * `imports` / `inject`), `useClass` or `useExisting`.
 *
 * @example
 * ```ts
 * LoggingModule.forRoot({ defaultLevel: "debug" })
 *
 * LoggingModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (cfg: ConfigService) => ({ defaultLevel: cfg.get("LOG_LEVEL") }),
 * })
 * ```
 *
 * @see LoggingModule.forFeature — for per-package logger registration.
 */
@Module({})
export class LoggingModule extends ConfigurableModuleClass {
  /**
   * Register one or more namespaced loggers for a feature module or package.
   *
   * Each entry produces a non-global provider keyed by the **namespace string
   * itself**, exported from the returned dynamic module so the module's own
   * providers can inject it via `@InjectLogger(namespace)`. Tests can
   * substitute the logger with `overrideProvider(namespace).useValue(...)`.
   *
   * Accepts the shorthand `string` form — equivalent to
   * `{ namespace: '<string>' }` with no level (package default applies; floor
   * is `'error'`). Use the shorthand when a package only needs to claim its
   * namespace and is happy with the floor.
   *
   * @param configs - Per-namespace configs. Use a string for namespace-only;
   *   use the object form to set a package default `level` or `name`.
   * @returns A `DynamicModule` to be added to the package module's `imports`.
   *
   * @example
   * ```ts
   * // Shorthand — package claims its namespace, level floors at 'error'.
   * @Module({
   *   imports: [LoggingModule.forFeature(["neomaventures:auth"])],
   *   providers: [AuthService],
   * })
   * export class AuthModule {}
   *
   * // Object form — package sets its own default.
   * LoggingModule.forFeature([
   *   { namespace: "neomaventures:auth", level: "warn" },
   * ])
   * ```
   *
   * @see InjectLogger — to inject the registered logger.
   */
  public static forFeature(
    configs: ReadonlyArray<LoggerConfig | string>,
  ): DynamicModule {
    const normalised: LoggerConfig[] = configs.map((c) =>
      typeof c === "string" ? { namespace: c } : c,
    )
    return {
      module: LoggingModule,
      providers: normalised.map((cfg) => ({
        provide: cfg.namespace,
        useFactory: (opts: LoggingModuleOptions) => createLogger(opts, cfg),
        inject: [LOGGING_MODULE_OPTIONS],
      })),
      exports: normalised.map((cfg) => cfg.namespace),
    }
  }
}
