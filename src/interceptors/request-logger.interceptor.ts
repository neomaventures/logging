import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common"
import { PATH_METADATA } from "@nestjs/common/constants"
import { type Observable, tap } from "rxjs"

import { type LoggingModuleOptions } from "../interfaces/logging-module-options.interface"
import { ApplicationLogger } from "../services/application-logger"
import { LOGGING_MODULE_OPTIONS } from "../symbols"

/**
 * Interceptor that logs requests going into and coming out of route handlers.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  /**
   * Creates an instance of RequestLoggerInterceptor.
   *
   * @param config - Subset of the module's options consumed by this interceptor.
   * @param config.logErrors - Whether to log errors that occur in route handlers (default: true).
   * @param logger - The ApplicationLogger instance used for logging.
   */
  public constructor(
    @Inject(LOGGING_MODULE_OPTIONS)
    private readonly config: Pick<LoggingModuleOptions, "logErrors">,
    private readonly logger: ApplicationLogger,
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

    this.logger.debug(
      "Processing an incoming request and dispatching it to a route handler.",
      route,
    )

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse()
          this.logger.debug(
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
