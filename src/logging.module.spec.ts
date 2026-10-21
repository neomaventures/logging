import os from "node:os"

import { faker } from "@faker-js/faker"
import { RequestContextModule } from "@neomaventures/request-context"
import {
  Controller,
  Get,
  Param,
  type INestApplication,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { ArrayStream, LogLevelNumber } from "fixtures/logging"
import request from "supertest"
import { type App } from "supertest/types"

import {
  ApplicationLogger,
  InjectLogger,
  type Logger,
  LoggingModule,
  LogLevel,
} from "./index"

describe("LoggingModule", () => {
  describe("forRootAsync", () => {
    describe("Given useFactory resolves options", () => {
      it("should wire ApplicationLogger and forFeature loggers identically to forRoot", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRootAsync({
              useFactory: () => ({
                destination: new ArrayStream(logs),
                loggers: [{ namespace, level: "debug" }],
              }),
            }),
            LoggingModule.forFeature([{ namespace }]),
          ],
        }).compile()

        const ns = module.get<Logger>(namespace)

        ns.debug("ns-debug")

        expect(logs).toEqual([
          expect.objectContaining({
            level: LogLevelNumber.debug,
            ns: namespace,
          }),
        ])
      })
    })
  })

  describe("forFeature shorthand parity", () => {
    describe("Given a namespace passed as a bare string", () => {
      it("should register a logger that emits under the namespace", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`

        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              loggers: [{ namespace, level: "debug" }],
            }),
            LoggingModule.forFeature([namespace]),
          ],
        }).compile()

        const logger = module.get<Logger>(namespace)
        logger.debug("shorthand")

        expect(logs).toEqual([
          expect.objectContaining({
            level: LogLevelNumber.debug,
            ns: namespace,
            msg: "shorthand",
          }),
        ])
      })
    })

    describe("Given a namespace passed as { namespace }", () => {
      it("should register a logger that emits under the namespace", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`

        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              loggers: [{ namespace, level: "debug" }],
            }),
            LoggingModule.forFeature([{ namespace }]),
          ],
        }).compile()

        const logger = module.get<Logger>(namespace)
        logger.debug("object form")

        expect(logs).toEqual([
          expect.objectContaining({
            level: LogLevelNumber.debug,
            ns: namespace,
            msg: "object form",
          }),
        ])
      })
    })
  })

  describe("LogLevel.Silent", () => {
    describe("Given level is LogLevel.Silent in forRoot loggers", () => {
      it("should emit no log entries for the namespaced logger", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`

        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              loggers: [{ namespace, level: LogLevel.Silent }],
            }),
            LoggingModule.forFeature([{ namespace }]),
          ],
        }).compile()

        const ns = module.get<Logger>(namespace)

        ns.trace("nope")
        ns.debug("nope")
        ns.info("nope")
        ns.warn("nope")
        ns.error("nope")
        ns.fatal("nope")

        expect(logs).toEqual([])
      })
    })
  })

  describe("forRoot + forFeature level precedence", () => {
    describe("Given a forRoot override and a forFeature package default", () => {
      it("should resolve to the forRoot override", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              loggers: [{ namespace, level: LogLevel.Debug }],
            }),
            LoggingModule.forFeature([{ namespace, level: LogLevel.Warn }]),
          ],
        }).compile()

        module.get<Logger>(namespace).debug(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.debug }),
        ])
      })
    })

    describe("Given only a forFeature package default", () => {
      it("should resolve to the package default", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({ destination: new ArrayStream(logs) }),
            LoggingModule.forFeature([{ namespace, level: LogLevel.Warn }]),
          ],
        }).compile()

        const logger = module.get<Logger>(namespace)
        logger.info(faker.hacker.phrase())
        logger.warn(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.warn }),
        ])
      })
    })

    describe("Given neither a forRoot override nor a package default", () => {
      it("should floor at error", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({ destination: new ArrayStream(logs) }),
            LoggingModule.forFeature([namespace]),
          ],
        }).compile()

        const logger = module.get<Logger>(namespace)
        logger.info(faker.hacker.phrase())
        logger.warn(faker.hacker.phrase())
        logger.error(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.error }),
        ])
      })
    })

    describe("Given forRoot sets a defaultLevel", () => {
      it("should NOT leak defaultLevel into namespaced loggers (regression)", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              defaultLevel: LogLevel.Debug,
            }),
            LoggingModule.forFeature([namespace]),
          ],
        }).compile()

        const logger = module.get<Logger>(namespace)
        logger.debug(faker.hacker.phrase())
        logger.info(faker.hacker.phrase())
        logger.warn(faker.hacker.phrase())
        logger.error(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.error }),
        ])
      })
    })
  })

  describe("forFeature entry fields", () => {
    describe("Given a forFeature logger with a name", () => {
      it("should stamp the namespace as `ns` and the name as `name`", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const name = faker.lorem.word()
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({ destination: new ArrayStream(logs) }),
            LoggingModule.forFeature([{ namespace, name }]),
          ],
        }).compile()

        module.get<Logger>(namespace).error(faker.hacker.phrase())

        expect(logs).toEqual([expect.objectContaining({ ns: namespace, name })])
      })
    })
  })

  describe("forRoot base fields", () => {
    describe("Given no context option", () => {
      it("should keep pino's default pid and hostname fields", async () => {
        const logs: any[] = []
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({ destination: new ArrayStream(logs) }),
          ],
        }).compile()

        module.get(ApplicationLogger).info(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({
            pid: process.pid,
            hostname: os.hostname(),
          }),
        ])
      })
    })

    describe("Given a context option", () => {
      it("should merge the context with pid and hostname on namespaced entries", async () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const service = faker.lorem.word()
        const module = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              context: { service },
            }),
            LoggingModule.forFeature([namespace]),
          ],
        }).compile()

        module.get<Logger>(namespace).error(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({
            pid: process.pid,
            hostname: os.hostname(),
            service,
          }),
        ])
      })
    })
  })

  describe("request logging", () => {
    const namespace = "neomaventures:logging"
    const dispatched =
      "Processing an incoming request and dispatching it to a route handler."
    const completed =
      "Processed an incoming request that was successfully handled by a route handler."
    const failed = "Error processing an incoming request in the route handler."

    @Controller("widgets")
    class WidgetsController {
      @Get("fail")
      public fail(): void {
        throw new Error("handler failed")
      }

      @Get(":id")
      public get(@Param("id") id: string): { id: string } {
        return { id }
      }
    }

    // Logs from middleware, i.e. before Nest has routed the request.
    @Module({ controllers: [WidgetsController] })
    class WidgetsModule implements NestModule {
      public configure(consumer: MiddlewareConsumer): void {
        consumer
          .apply((_req: unknown, _res: unknown, next: () => void) => {
            ApplicationLogger.debug("middleware")
            next()
          })
          .forRoutes("*")
      }
    }

    let app: INestApplication
    let logs: any[]

    afterEach(async () => {
      await app.close()
    })

    describe("Given no override for the request logger's namespace", () => {
      beforeEach(async () => {
        logs = []
        const module = await Test.createTestingModule({
          imports: [
            RequestContextModule.forRoot(),
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              defaultLevel: LogLevel.Debug,
            }),
            WidgetsModule,
          ],
        }).compile()
        app = module.createNestApplication({ logger: false })
        await app.init()
      })

      it("should not log handled requests, even with a debug defaultLevel", async () => {
        await request(app.getHttpServer() as App).get(
          `/widgets/${faker.string.uuid()}`,
        )

        // Only the request logger's completion entry carries `res`.
        expect(logs).not.toContainEqual(
          expect.objectContaining({ res: expect.anything() }),
        )
      })

      it("should still log the app's own debug entries", async () => {
        await request(app.getHttpServer() as App).get(
          `/widgets/${faker.string.uuid()}`,
        )

        expect(logs).toContainEqual(
          expect.objectContaining({ msg: "middleware" }),
        )
      })

      it("should still log a request whose handler throws, with its route and duration", async () => {
        await request(app.getHttpServer() as App).get("/widgets/fail")

        expect(logs).toContainEqual(
          expect.objectContaining({
            level: LogLevelNumber.error,
            ns: namespace,
            msg: failed,
            controller: { name: "WidgetsController", path: "widgets" },
            handler: { name: "fail", path: "fail" },
            duration: expect.stringMatching(/^\d+ms$/),
            err: expect.objectContaining({ message: "handler failed" }),
          }),
        )
      })

      it("should still propagate the handler's error to the client", async () => {
        await request(app.getHttpServer() as App)
          .get("/widgets/fail")
          .expect(500)
      })
    })

    describe("Given logErrors is false", () => {
      beforeEach(async () => {
        logs = []
        const module = await Test.createTestingModule({
          imports: [
            RequestContextModule.forRoot(),
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              logErrors: false,
            }),
            WidgetsModule,
          ],
        }).compile()
        app = module.createNestApplication({ logger: false })
        await app.init()
      })

      it("should not log a request whose handler throws", async () => {
        await request(app.getHttpServer() as App).get("/widgets/fail")

        expect(logs).not.toContainEqual(
          expect.objectContaining({ err: expect.anything() }),
        )
      })

      it("should still propagate the handler's error to the client", async () => {
        await request(app.getHttpServer() as App)
          .get("/widgets/fail")
          .expect(500)
      })
    })

    describe("Given the request logger's namespace is raised to info", () => {
      const id = faker.string.uuid()
      const secret = faker.string.alphanumeric(32)
      let response: request.Response

      beforeEach(async () => {
        logs = []
        const module = await Test.createTestingModule({
          imports: [
            RequestContextModule.forRoot(),
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              defaultLevel: LogLevel.Debug,
              loggers: [
                { namespace: LoggingModule.LogNamespace, level: LogLevel.Info },
              ],
            }),
            WidgetsModule,
          ],
        }).compile()
        app = module.createNestApplication({ logger: false })
        await app.init()

        response = await request(app.getHttpServer() as App)
          .get(`/widgets/${id}?code=${secret}`)
          .set("Cookie", `sid=${secret}`)
          .set("Accept", "application/json")
      })

      it("should log the request in, then out", () => {
        expect(
          logs.filter(({ ns }) => ns === namespace).map(({ msg }) => msg),
        ).toEqual([dispatched, completed])
      })

      it("should log the route handler on the way in", () => {
        expect(logs).toContainEqual(
          expect.objectContaining({
            msg: dispatched,
            controller: { name: "WidgetsController", path: "widgets" },
            handler: { name: "get", path: ":id" },
          }),
        )
      })

      it("should log the route handler and duration on the way out", () => {
        expect(logs).toContainEqual(
          expect.objectContaining({
            msg: completed,
            controller: { name: "WidgetsController", path: "widgets" },
            handler: { name: "get", path: ":id" },
            duration: expect.stringMatching(/^\d+ms$/),
          }),
        )
      })

      it("should return the handler's response unchanged", () => {
        expect(response.body).toEqual({ id })
      })

      it("should log handled requests at info under its namespace", () => {
        expect(logs).toContainEqual(
          expect.objectContaining({
            level: LogLevelNumber.info,
            ns: namespace,
            res: expect.objectContaining({ statusCode: 200 }),
          }),
        )
      })

      it("should log the path with its ids and without the query string from middleware", () => {
        expect(logs).toContainEqual(
          expect.objectContaining({
            msg: "middleware",
            req: expect.objectContaining({ path: `/widgets/${id}` }),
          }),
        )
      })

      it("should not log the matched route from middleware", () => {
        const entry = logs.find(({ msg }) => msg === "middleware")

        expect(entry.req).not.toHaveProperty("route")
      })

      it("should log the matched route pattern once routed", () => {
        expect(logs).toContainEqual(
          expect.objectContaining({
            req: expect.objectContaining({
              path: `/widgets/${id}`,
              route: "/widgets/:id",
            }),
          }),
        )
      })

      it("should log only allow-listed headers", () => {
        expect(logs).toContainEqual(
          expect.objectContaining({
            req: expect.objectContaining({
              headers: expect.objectContaining({ accept: "application/json" }),
            }),
          }),
        )
      })

      it("should never log the cookie or query string", () => {
        expect(JSON.stringify(logs)).not.toContain(secret)
      })
    })
  })

  describe("global registration", () => {
    describe("Given forRoot is imported in a parent module", () => {
      it("should expose ApplicationLogger to feature modules without an explicit import", async () => {
        @Injectable()
        class FeatureService {
          public constructor(
            @InjectLogger() public readonly logger: ApplicationLogger,
          ) {}
        }

        @Module({ providers: [FeatureService], exports: [FeatureService] })
        class FeatureModule {}

        const module = await Test.createTestingModule({
          imports: [LoggingModule.forRoot({}), FeatureModule],
        }).compile()

        const feature = module.get(FeatureService)
        const provider = module.get(ApplicationLogger)

        expect(feature.logger).toBe(provider)
      })
    })
  })
})
