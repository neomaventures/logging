import os from "node:os"

import { faker } from "@faker-js/faker"
import { ArrayStream, LogLevelNumber } from "fixtures/logging"

import { type LoggingModuleOptions } from "../interfaces/logging-module-options.interface"

import { createLogger } from "./create-logger"

describe("createLogger()", () => {
  describe("namespaced precedence", () => {
    describe("Given an app override and a package default", () => {
      it("should resolve to the app override level", () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const options: LoggingModuleOptions = {
          destination: new ArrayStream(logs),
          loggers: [{ namespace, level: "debug" }],
        }

        const logger = createLogger(options, { namespace, level: "warn" })

        logger.debug(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.debug }),
        ])
      })
    })

    describe("Given only a package default level", () => {
      it("should resolve to the package default", () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const options: LoggingModuleOptions = {
          destination: new ArrayStream(logs),
        }

        const logger = createLogger(options, { namespace, level: "warn" })

        logger.info(faker.hacker.phrase())
        logger.warn(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.warn }),
        ])
      })
    })

    describe("Given no overrides and no package level", () => {
      it("should floor at error", () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const options: LoggingModuleOptions = {
          destination: new ArrayStream(logs),
        }

        const logger = createLogger(options, { namespace })

        logger.info(faker.hacker.phrase())
        logger.warn(faker.hacker.phrase())
        logger.error(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.error }),
        ])
      })
    })

    describe("Given defaultLevel is set on the root", () => {
      it("should NOT leak defaultLevel into namespaced loggers (regression)", () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const options: LoggingModuleOptions = {
          destination: new ArrayStream(logs),
          defaultLevel: "debug",
        }

        const logger = createLogger(options, { namespace })

        logger.debug(faker.hacker.phrase())
        logger.info(faker.hacker.phrase())
        logger.warn(faker.hacker.phrase())
        logger.error(faker.hacker.phrase())

        expect(logs).toEqual([
          expect.objectContaining({ level: LogLevelNumber.error }),
        ])
      })
    })

    describe("Given a namespace", () => {
      it("should stamp the namespace as `ns` on every entry", () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const options: LoggingModuleOptions = {
          destination: new ArrayStream(logs),
          loggers: [{ namespace, level: "info" }],
        }

        const logger = createLogger(options, { namespace })

        logger.info(faker.hacker.phrase())

        expect(logs[0]).toMatchObject({ ns: namespace })
      })
    })
  })

  describe("pino root base fields", () => {
    describe("Given no `context` option", () => {
      it("should preserve pino's default pid and hostname fields", () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const options: LoggingModuleOptions = {
          destination: new ArrayStream(logs),
          loggers: [{ namespace, level: "info" }],
        }

        const logger = createLogger(options, { namespace })

        logger.info(faker.hacker.phrase())

        expect(logs[0]).toMatchObject({
          pid: process.pid,
          hostname: os.hostname(),
        })
      })
    })

    describe("Given a `context` option", () => {
      it("should merge context with pino's default pid and hostname", () => {
        const logs: any[] = []
        const namespace = `neomaventures:${faker.lorem.word()}`
        const service = faker.lorem.word()
        const options: LoggingModuleOptions = {
          destination: new ArrayStream(logs),
          context: { service },
          loggers: [{ namespace, level: "info" }],
        }

        const logger = createLogger(options, { namespace })

        logger.info(faker.hacker.phrase())

        expect(logs[0]).toMatchObject({
          pid: process.pid,
          hostname: os.hostname(),
          service,
        })
      })
    })
  })
})
