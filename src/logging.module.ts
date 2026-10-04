import { type DynamicModule, Module, type Provider } from "@nestjs/common"
import { APP_INTERCEPTOR } from "@nestjs/core"

import { RequestLoggerInterceptor } from "./interceptors/request-logger.interceptor"
import { type LoggerConfig } from "./interfaces/logger-config.interface"
import {
  type LoggingModuleAsyncOptions,
  type LoggingModuleOptions,
} from "./interfaces/logging-module-options.interface"
import { ApplicationLogger } from "./services/application-logger"
import { createLogger } from "./services/create-logger"
import { LOGGING_MODULE_OPTIONS } from "./symbols"

const PROVIDERS: Provider[] = [
  ApplicationLogger,
  { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
]
// `LOGGING_MODULE_OPTIONS` is exported so `forFeature` providers can resolve
// it without re-registering. It remains internal to consumers — only the
// per-namespace logger token is meant to be injected.
const EXPORTS = [ApplicationLogger, LOGGING_MODULE_OPTIONS]

/**
 * NestJS module providing structured logging.
 *
 * Register the root via `forRoot()` / `forRootAsync()` once at the app's
 * root module; register per-package namespaced loggers via `forFeature()`
 * inside each package's own module.
 *
 * @see LoggingModule.forFeature — for per-package logger registration.
 */
@Module({})
export class LoggingModule {
  /**
   * Register the logging root for the application. Call **once** in the
   * application's root module. Provides {@link ApplicationLogger}, the
   * `RequestLoggerInterceptor`, and the internal `LOGGING_MODULE_OPTIONS`
   * token. Module is global.
   *
   * @param options - App-wide configuration. Omit for defaults (`info` level,
   *   stdout destination, no overrides).
   * @returns A `DynamicModule` ready to be added to `AppModule.imports`.
   *
   * @example
   * ```ts
   * @Module({
   *   imports: [LoggingModule.forRoot({ defaultLevel: "debug" })],
   * })
   * export class AppModule {}
   * ```
   */
  public static forRoot(options: LoggingModuleOptions = {}): DynamicModule {
    return {
      global: true,
      module: LoggingModule,
      providers: [
        { provide: LOGGING_MODULE_OPTIONS, useValue: options },
        ...PROVIDERS,
      ],
      exports: EXPORTS,
    }
  }

  /**
   * Async variant of {@link LoggingModule.forRoot}. Use when options must be
   * resolved from `ConfigService` or another async source.
   *
   * @param options - Async options descriptor with `useFactory`.
   * @returns A `DynamicModule` ready to be added to `AppModule.imports`.
   *
   * @example
   * ```ts
   * LoggingModule.forRootAsync({
   *   imports: [ConfigModule],
   *   inject: [ConfigService],
   *   useFactory: (cfg: ConfigService) => ({ defaultLevel: cfg.get("LOG_LEVEL") }),
   * })
   * ```
   */
  public static forRootAsync(
    options: LoggingModuleAsyncOptions,
  ): DynamicModule {
    return {
      global: true,
      module: LoggingModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: LOGGING_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ...PROVIDERS,
      ],
      exports: EXPORTS,
    }
  }

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
