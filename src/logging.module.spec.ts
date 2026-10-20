import { faker } from "@faker-js/faker"
import { RequestContextModule } from "@neomaventures/request-context"
import {
  Controller,
  Get,
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

  describe("request serialization", () => {
    describe("Given a request to a route with a path parameter", () => {
      const id = faker.string.uuid()
      const secret = faker.string.alphanumeric(32)
      let logs: any[]

      beforeEach(async () => {
        logs = []

        @Controller("widgets")
        class WidgetsController {
          @Get(":id")
          public get(): void {}
        }

        @Module({
          imports: [
            RequestContextModule.forRoot(),
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              defaultLevel: LogLevel.Debug,
            }),
          ],
          controllers: [WidgetsController],
        })
        class AppModule implements NestModule {
          public configure(consumer: MiddlewareConsumer): void {
            consumer
              .apply((_req: unknown, _res: unknown, next: () => void) => {
                ApplicationLogger.debug("middleware")
                next()
              })
              .forRoutes("*")
          }
        }

        const module = await Test.createTestingModule({
          imports: [AppModule],
        }).compile()
        const app = module.createNestApplication()
        await app.init()

        await request(app.getHttpServer() as App)
          .get(`/widgets/${id}?code=${secret}`)
          .set("Cookie", `sid=${secret}`)
          .set("Accept", "application/json")

        await app.close()
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

      it("should log the response status code", () => {
        expect(logs).toContainEqual(
          expect.objectContaining({
            res: expect.objectContaining({ statusCode: 200 }),
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
