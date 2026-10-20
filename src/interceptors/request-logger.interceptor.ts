import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common"
import { PATH_METADATA } from "@nestjs/common/constants"
import { type Observable, tap } from "rxjs"

import { InjectLogger } from "../decorators/inject-logger.decorator"
import { type Logger } from "../interfaces/logger.interface"
import { type LoggingModuleOptions } from "../interfaces/logging-module-options.interface"
import { LOGGING_MODULE_OPTIONS, LOGGING_NAMESPACE } from "../symbols"

/**
 * Interceptor that logs requests going into and coming out of route handlers.
 *
 * Logs under the `neomaventures:logging` namespace: handled requests at
 * `info`, failed ones at `error`. Like every namespace it floors at `error`,
 * so handled requests are only logged once the app raises it.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  /**
   * Creates an instance of RequestLoggerInterceptor.
   *
   * @param config - Subset of the module's options consumed by this interceptor.
   * @param config.logErrors - Whether to log errors that occur in route handlers (default: true).
   * @param logger - The package's `neomaventures:logging` namespaced logger.
   */
  public constructor(
    @Inject(LOGGING_MODULE_OPTIONS)
    private readonly config: Pick<LoggingModuleOptions, "logErrors">,
    @InjectLogger(LOGGING_NAMESPACE)
    private readonly logger: Logger,
  ) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const start = Date.now()

    const controllerPath = Reflect.getMetadata(
      PATH_METADATA,
      context.getClass(),
    )
    const handlerPath = Reflect.getMetadata(PATH_METADATA, context.getHandler())
    const route = {
      controller: { name: context.getClass().name, path: controllerPath },
      handler: { name: context.getHandler().name, path: handlerPath },
    }

    this.logger.info(
      "Processing an incoming request and dispatching it to a route handler.",
      route,
    )

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse()
          this.logger.info(
            "Processed an incoming request that was successfully handled by a route handler.",
            {
              ...route,
              res: response,
              duration: `${Date.now() - start}ms`,
            },
          )
        },
        error: (error) => {
          if (this.config.logErrors !== false) {
            this.logger.error(
              "Error processing an incoming request in the route handler.",
              {
                ...route,
                duration: `${Date.now() - start}ms`,
                err: error,
              },
            )
          }
        },
      }),
    )
  }
}
