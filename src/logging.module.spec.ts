import { faker } from "@faker-js/faker"
import { Injectable, Module } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { ArrayStream, LogLevelNumber } from "fixtures/logging"

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
