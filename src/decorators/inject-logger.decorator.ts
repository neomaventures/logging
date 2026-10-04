import { Inject } from "@nestjs/common"

import { ApplicationLogger } from "../services/application-logger"

/**
 * Parameter decorator that injects a logger.
 *
 * Two call shapes:
 *
 * - `@InjectLogger()` — injects the app-wide {@link ApplicationLogger}.
 *   Equivalent to `@Inject(ApplicationLogger)`. Use this in app-level code
 *   that has no package namespace.
 *
 * - `@InjectLogger(namespace)` — injects the namespaced {@link Logger}
 *   registered by `LoggingModule.forFeature([{ namespace }])` in the same
 *   module (or one of its imports).
 *
 * @param namespace - Optional namespace; omit for {@link ApplicationLogger}.
 * @returns A `ParameterDecorator` for a constructor parameter.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class AuthService {
 *   public constructor(
 *     @InjectLogger("neomaventures:auth")
 *     private readonly logger: Logger,
 *   ) {}
 * }
 *
 * @Injectable()
 * export class CheckoutService {
 *   public constructor(
 *     @InjectLogger() private readonly logger: ApplicationLogger,
 *   ) {}
 * }
 * ```
 *
 * @throws `UnknownDependenciesException` at app startup if a namespace is
 *   supplied but no `forFeature` entry has registered it in scope.
 *
 * @see LoggingModule.forFeature
 */
export const InjectLogger = (namespace?: string): ParameterDecorator =>
  Inject(namespace ?? ApplicationLogger)
