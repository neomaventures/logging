import { faker } from "@faker-js/faker"
import { Injectable } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { ArrayStream, LogLevelNumber } from "fixtures/logging"

import {
  ApplicationLogger,
  InjectLogger,
  type Logger,
  LoggingModule,
} from "../index"

describe("@InjectLogger", () => {
  describe("Given the parameterless form @InjectLogger()", () => {
    @Injectable()
    class SUT {
      public constructor(
        @InjectLogger() public readonly logger: ApplicationLogger,
      ) {}
    }

    it("should inject the same ApplicationLogger instance the module provides", async () => {
      const module = await Test.createTestingModule({
        imports: [LoggingModule.forRoot()],
        providers: [SUT],
      }).compile()

      const sut = module.get(SUT)
      const provider = module.get(ApplicationLogger)

      expect(sut.logger).toBe(provider)
    })
  })

  describe("Given the namespaced form @InjectLogger(ns)", () => {
    const namespace = `neomaventures:${faker.lorem.word()}`

    @Injectable()
    class SUT {
      public constructor(
        @InjectLogger(namespace) public readonly logger: Logger,
      ) {}
    }

    it("should inject the logger registered for that namespace", async () => {
      const module = await Test.createTestingModule({
        imports: [
          LoggingModule.forRoot({
            destination: new ArrayStream(),
            loggers: [{ namespace, level: "info" }],
          }),
          LoggingModule.forFeature([{ namespace }]),
        ],
        providers: [SUT],
      }).compile()

      const sut = module.get(SUT)
      const provider = module.get<Logger>(namespace)

      expect(sut.logger).toBe(provider)
    })

    it("should apply the configured namespace and level to the resolved logger", async () => {
      const logs: any[] = []
      const module = await Test.createTestingModule({
        imports: [
          LoggingModule.forRoot({
            destination: new ArrayStream(logs),
            loggers: [{ namespace, level: "info" }],
          }),
          LoggingModule.forFeature([{ namespace }]),
        ],
        providers: [SUT],
      }).compile()

      const sut = module.get(SUT)
      sut.logger.info(faker.hacker.phrase())

      expect(logs).toEqual([
        expect.objectContaining({
          ns: namespace,
          level: LogLevelNumber.info,
        }),
      ])
    })
  })
})
