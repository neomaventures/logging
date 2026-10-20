# @neomaventures/logging

Structured, typed logging for NestJS applications, powered by pino. Provides an app-wide `ApplicationLogger` plus per-package namespaced loggers via `LoggingModule.forFeature`. Reads the current request from `@neomaventures/request-context` and attaches it as a `req` field on every entry — no `Scope.REQUEST`, no `req.logger`, no `@Req()` threading.

[![npm version](https://img.shields.io/npm/v/%40neomaventures%2Flogging)](https://www.npmjs.com/package/@neomaventures/logging)
[![CI](https://github.com/neomaventures/logging/actions/workflows/ci.yml/badge.svg)](https://github.com/neomaventures/logging/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why @neomaventures/logging?

- **Structured-only API** — every method has the same shape: `(message: string, context?: LogContext): void`. No printf, no positional context strings, no ambiguity at call sites.
- **Per-package namespaced loggers** — packages register `LoggingModule.forFeature([{ namespace: 'neomaventures:foo' }])` and inject their own `Logger`. App can dial each package's level independently.
- **Split level precedence** — `defaultLevel` raises **the app's own** logger only. Namespaced loggers floor at `'error'` unless the app opts each one in. Turning on debug for your code doesn't turn every dependency into a firehose.
- **Automatic request context** — log lines made during a request automatically carry `req`. Works in any default-scoped service.
- **`err` field convention** — pass an `Error` as `{ err }` and pino's default serializer extracts `{ type, message, stack }` for you.
- **Field redaction** — declarative path patterns mask sensitive data before serialization.
- **Static delegates** — `ApplicationLogger.info(...)` for decorators / non-DI code that still needs the structured pipeline.

## Not Nest's app logger

`ApplicationLogger` deliberately does not implement `@nestjs/common`'s `LoggerService` interface. **Don't pass it to `app.useLogger(...)`** — that won't type-check, and isn't the intended integration. Nest's own framework logs (bootstrap, router exploration, etc.) continue to flow through Nest's `ConsoleLogger`; this is the structured logger for **application code** and the rest of the Neoma ecosystem.

## Installation

```bash
pnpm add @neomaventures/logging @neomaventures/request-context
```

`@neomaventures/request-context` is a peer dependency — it's what gives `ApplicationLogger` access to the current request.

## Quick start

Install both modules at the root. `RequestContextModule.forRoot()` must come before `LoggingModule.forRoot()` so the request-context boundary is in place when the logger reads from it:

```ts
import { Module } from "@nestjs/common"
import { LoggingModule, LogLevel } from "@neomaventures/logging"
import { RequestContextModule } from "@neomaventures/request-context"

@Module({
  imports: [
    RequestContextModule.forRoot(),
    LoggingModule.forRoot({
      defaultLevel: LogLevel.Debug,
      context: { service: "api", version: "1.0.0" },
    }),
  ],
})
export class AppModule {}
```

## Using the ApplicationLogger

Inject via `@InjectLogger()` (or `@Inject(ApplicationLogger)`):

```ts
import { Injectable } from "@nestjs/common"
import { ApplicationLogger, InjectLogger } from "@neomaventures/logging"

@Injectable()
export class UsersService {
  public constructor(
    @InjectLogger() private readonly logger: ApplicationLogger,
  ) {}

  public async createUser(data: CreateUserDto): Promise<User> {
    this.logger.info("creating user", { email: data.email })
    try {
      const user = await this.repo.save(data)
      this.logger.info("user created", { userId: user.id })
      return user
    } catch (err) {
      this.logger.error("user creation failed", { err, email: data.email })
      throw err
    }
  }
}
```

### Static delegates

Decorators, utility functions, and other non-DI code can use the static delegates — same structured contract, no DI required:

```ts
import { ApplicationLogger } from "@neomaventures/logging"

export function logBoot(stage: string): void {
  ApplicationLogger.info("boot stage", { stage })
}
```

Static calls route through the constructed singleton. They no-op silently if called before `LoggingModule.forRoot()` has been registered (e.g. at module-init time before the app is bootstrapped).

## Namespaced loggers (`forFeature`)

Each `@neomaventures/*` package — or any feature module — claims a namespace and registers it with `LoggingModule.forFeature`:

```ts
import { Module } from "@nestjs/common"
import { LoggingModule } from "@neomaventures/logging"

@Module({
  imports: [LoggingModule.forFeature(["neomaventures:auth"])],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

And inject the namespaced `Logger` inside the package:

```ts
import { Injectable } from "@nestjs/common"
import { InjectLogger, type Logger } from "@neomaventures/logging"

@Injectable()
export class AuthService {
  public constructor(
    @InjectLogger("neomaventures:auth") private readonly logger: Logger,
  ) {}
}
```

`forFeature` accepts either the string shorthand (above) or the object form when a package wants to set its own default level or pino `name`:

```ts
LoggingModule.forFeature([
  { namespace: "neomaventures:auth", level: LogLevel.Warn, name: "auth" },
])
```

## Level precedence

`ApplicationLogger` and namespaced loggers have **separate** precedence chains:

### Namespaced (package) loggers

Resolved in order:

1. **`forRoot.loggers[namespace].level`** — app override, highest priority.
2. **`forFeature` entry's `level`** — the package's own default.
3. **`'error'` floor** — built-in.

`forRoot.defaultLevel` does **not** apply to namespaced loggers. Raising `defaultLevel` to `'debug'` turns up the app's verbosity without lighting up every package in the graph.

### ApplicationLogger

Bound directly to `forRoot.defaultLevel` (default `'info'`). No override chain.

### Example

```ts
LoggingModule.forRoot({
  defaultLevel: LogLevel.Debug,
  loggers: [{ namespace: "neomaventures:auth", level: LogLevel.Trace }],
})
```

- `ApplicationLogger` emits at `debug` and above.
- The `neomaventures:auth` logger emits at `trace` and above.
- Every other namespaced logger floors at `error`.

### Silencing a namespaced logger

Set the level to `LogLevel.Silent` to suppress every entry from a namespace
(pino native — Infinity threshold). Useful for opting a noisy package out
entirely, or in tests where a package's logger would otherwise pollute output:

```ts
LoggingModule.forRoot({
  loggers: [{ namespace: "neomaventures:auth", level: LogLevel.Silent }],
})
```

## LogContext

```ts
type LogContext = {
  /**
   * Attached error. When this is an `Error`, pino's default serializer
   * extracts { type, message, stack } into the log entry.
   */
  err?: unknown
} & Record<string, unknown>
```

Any keys allowed. `err` is called out because pino's `err` serializer auto-extracts an attached `Error`'s structured shape:

```ts
try {
  await chargeCard(amount)
} catch (err) {
  this.logger.error("charge failed", { err, chargeId, amount })
}
```

```json
{
  "level": 50,
  "msg": "charge failed",
  "chargeId": "ch_abc",
  "amount": 4900,
  "err": {
    "type": "StripeCardError",
    "message": "Your card was declined.",
    "stack": "StripeCardError: Your card was declined.\n    at ..."
  }
}
```

## Request and response fields

Entries made during a request carry `req`, and the request logger's completion
entry carries `res`. Both are reduced to the fields worth logging:

```json
{
  "req": {
    "method": "GET",
    "path": "/accounts/7f3a9c2e/ingestions",
    "route": "/accounts/:id/ingestions",
    "ip": "203.0.113.7",
    "headers": {
      "accept": "text/html",
      "user-agent": "Mozilla/5.0 …",
      "x-request-id": "b1946ac9"
    }
  },
  "res": {
    "statusCode": 200,
    "headers": { "content-type": "text/html; charset=utf-8" }
  }
}
```

- **`path`** is the request path with its ids and **without the query string**,
  which can carry secrets such as OAuth codes. It is correct in middleware too.
- **`route`** is the matched route pattern, for grouping by endpoint. It is only
  present once Nest has routed the request, so entries made in middleware omit
  it.
- **`headers`** are allow-listed: `accept`, `content-type`, `content-length`,
  `user-agent` and `x-request-id` on the request; `content-type` and
  `content-length` on the response. Cookies, `authorization`, `set-cookie` and
  everything else are never logged.

## Configuration

```ts
interface LoggingModuleOptions {
  /** ApplicationLogger level. Default 'info'. Does NOT apply to namespaced loggers. */
  defaultLevel?: LogLevel
  /** Per-namespace app overrides — wins over any package default and the 'error' floor. */
  loggers?: ReadonlyArray<LoggerConfig>
  /** pino destination (stream, sonic-boom, transport, …). Defaults to stdout. */
  destination?: any
  /** Pino redact paths. */
  redact?: ReadonlyArray<string>
  /** Static fields stamped onto every entry. */
  context?: Record<string, unknown>
  /** Whether RequestLoggerInterceptor logs handler exceptions. Default true. */
  logErrors?: boolean
}
```

`LogLevel` is exposed as a **const object** so consumers reference levels via importable identifiers (`LogLevel.Debug`) rather than magic strings — the rest of the pack uses the same convention for namespaces, tokens, and scopes. The companion `LogLevel` type still resolves to the underlying string union (`'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'`), so existing call sites passing string literals continue to typecheck.

```ts
import { LogLevel } from "@neomaventures/logging"

LogLevel.Debug // "debug"
LogLevel.Silent // "silent"
```

## Async configuration

```ts
LoggingModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    defaultLevel: config.get("LOG_LEVEL"),
    redact: ["password", "*.secret"],
  }),
})
```

## Testing

Use `ArrayStream` from the shipped fixtures to capture log output in memory:

```ts
import { Test } from "@nestjs/testing"
import { ApplicationLogger, LoggingModule } from "@neomaventures/logging"
import { RequestContextModule } from "@neomaventures/request-context"
import { ArrayStream } from "@neomaventures/logging/fixtures"

describe("UsersService", () => {
  const logs: any[] = []
  let logger: ApplicationLogger

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        RequestContextModule.forRoot(),
        LoggingModule.forRoot({ destination: new ArrayStream(logs) }),
      ],
    }).compile()

    logger = module.get(ApplicationLogger)
  })

  it("logs structured fields", () => {
    logger.info("user created", { userId: "123" })

    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 30,
        msg: "user created",
        userId: "123",
      }),
    )
  })
})
```

For unit specs that don't need the full module, override the provider with a mock:

```ts
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn() /* ... */,
}

const module = await Test.createTestingModule({
  providers: [
    UsersService,
    { provide: ApplicationLogger, useValue: mockLogger },
  ],
}).compile()
```

## Requirements

- Node.js >= 22
- NestJS 11.x
- `@neomaventures/request-context` (peer dependency)

## Known limitations

Tracked for a later release. Read these before depending on the package.

### Namespace matching is exact, and silent when it misses

`loggers[].namespace` is compared with `===`. There is no `debug`-style wildcard
(`neomaventures:*`), and an override naming a namespace no package registers is
a no-op — including when the namespace is simply misspelled. Check the `ns`
field on an emitted entry to confirm the name you are overriding.

## License

MIT — see [LICENSE](./LICENSE).
