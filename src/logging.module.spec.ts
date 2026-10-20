import { faker } from "@faker-js/faker"
import { RequestContextModule } from "@neomaventures/request-context"
import {
  Controller,
  Get,
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
  LOGGING_NAMESPACE,
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

  describe("request logging", () => {
    const namespace = "neomaventures:logging"

    @Controller("widgets")
    class WidgetsController {
      @Get("fail")
      public fail(): void {
        throw new Error("handler failed")
      }

      @Get(":id")
      public get(): void {}
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

      it("should still log a request whose handler throws", async () => {
        await request(app.getHttpServer() as App).get("/widgets/fail")

        expect(logs).toContainEqual(
          expect.objectContaining({
            level: LogLevelNumber.error,
            ns: namespace,
            err: expect.objectContaining({ message: "handler failed" }),
          }),
        )
      })
    })

    describe("Given the request logger's namespace is raised to info", () => {
      const id = faker.string.uuid()
      const secret = faker.string.alphanumeric(32)

      beforeEach(async () => {
        logs = []
        const module = await Test.createTestingModule({
          imports: [
            RequestContextModule.forRoot(),
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              defaultLevel: LogLevel.Debug,
              loggers: [{ namespace: LOGGING_NAMESPACE, level: LogLevel.Info }],
            }),
            WidgetsModule,
          ],
        }).compile()
        app = module.createNestApplication({ logger: false })
        await app.init()

        await request(app.getHttpServer() as App)
          .get(`/widgets/${id}?code=${secret}`)
          .set("Cookie", `sid=${secret}`)
          .set("Accept", "application/json")
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
          imports: [LoggingModule.forRoot(), FeatureModule],
        }).compile()

        const feature = module.get(FeatureService)
        const provider = module.get(ApplicationLogger)

        expect(feature.logger).toBe(provider)
      })
    })
  })
})
