import { faker } from "@faker-js/faker"
import { RequestContextModule } from "@neomaventures/request-context"
import {
  Controller,
  Get,
  type INestApplication,
  Param,
  Query,
} from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { LogLevelNumber, LogMethodTests, ArrayStream } from "fixtures/logging"
import request from "supertest"
import { type App } from "supertest/types"

import { ApplicationLogger, LoggingModule, LogLevel } from "../index"

type LogMethod = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

describe("ApplicationLogger", () => {
  const message = faker.hacker.phrase()
  const context = { ctx: faker.lorem.word() }

  let service: ApplicationLogger
  let logs: any[]

  beforeEach(async () => {
    logs = []
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggingModule.forRoot({
          destination: new ArrayStream(logs),
          defaultLevel: LogLevel.Trace,
        }),
      ],
    }).compile()

    service = module.get(ApplicationLogger)
  })

  describe("Default Configuration", () => {
    describe("Given forRoot without a defaultLevel", () => {
      it("should log at 'info' and above", async () => {
        const defaultLogs: any[] = []
        const module: TestingModule = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(defaultLogs),
            }),
          ],
        }).compile()

        const defaultService = module.get(ApplicationLogger)
        defaultService.debug(message)
        defaultService.info(message)

        expect(defaultLogs.map(({ level }) => level)).toEqual([
          LogLevelNumber.info,
        ])
      })
    })
  })

  describe("Logging Methods", () => {
    LogMethodTests.forEach(({ method: methodName, level }) => {
      const method = methodName as LogMethod
      describe(method, () => {
        describe("When it's called outside a request context", () => {
          describe("When it's called with just a message", () => {
            it(`It should log the message at the ${method} level`, () => {
              service[method](message)
              expect(logs).toContainEqual(
                expect.objectContaining({ level, msg: message }),
              )
            })
          })

          describe("When it's called with a context object", () => {
            it(`It should log the message and merge the context's properties at the ${method} level`, () => {
              service[method](message, context)
              expect(logs).toContainEqual(
                expect.objectContaining({ level, msg: message, ...context }),
              )
            })
          })
        })
      })
    })

    describe("When called with an err in the context", () => {
      it("should let pino serialize Error fields as { type, message, stack }", () => {
        const err = new Error(faker.hacker.phrase())

        service.error(message, { err })

        expect(logs).toContainEqual(
          expect.objectContaining({
            level: LogLevelNumber.error,
            msg: message,
            err: expect.objectContaining({
              type: "Error",
              message: err.message,
              stack: expect.any(String),
            }),
          }),
        )
      })

      it("should preserve other fields alongside the serialized err", () => {
        const err = new Error(faker.hacker.phrase())
        const extra = { chargeId: faker.string.uuid() }

        service.error(message, { err, ...extra })

        expect(logs).toContainEqual(
          expect.objectContaining({
            level: LogLevelNumber.error,
            msg: message,
            chargeId: extra.chargeId,
            err: expect.objectContaining({ message: err.message }),
          }),
        )
      })
    })
  })

  describe("Static delegates", () => {
    it("should route ApplicationLogger.info(...) through the constructed instance", () => {
      ApplicationLogger.info(message, context)
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: LogLevelNumber.info,
          msg: message,
          ...context,
        }),
      )
    })

    it("should route ApplicationLogger.error(...) through the constructed instance", () => {
      const err = new Error(faker.hacker.phrase())
      ApplicationLogger.error(message, { err })
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: LogLevelNumber.error,
          msg: message,
          err: expect.objectContaining({ message: err.message }),
        }),
      )
    })
  })

  describe("When it's called inside a request", () => {
    // Logs via the injected instance (`/log/:method`, with `?context` to pass
    // the context object) or via the static delegate (`/static`).
    @Controller()
    class LogController {
      public constructor(private readonly logger: ApplicationLogger) {}

      @Get("static")
      public static(): void {
        ApplicationLogger.warn(message)
      }

      @Get("log/:method")
      public log(
        @Param("method") method: LogMethod,
        @Query("context") withContext?: string,
      ): void {
        this.logger[method](message, withContext ? context : undefined)
      }
    }

    let app: INestApplication
    let requestLogs: any[]

    beforeEach(async () => {
      requestLogs = []
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          RequestContextModule.forRoot(),
          LoggingModule.forRoot({
            destination: new ArrayStream(requestLogs),
            defaultLevel: LogLevel.Trace,
          }),
        ],
        controllers: [LogController],
      }).compile()
      app = module.createNestApplication({ logger: false })
      await app.init()
    })

    afterEach(async () => {
      await app.close()
    })

    LogMethodTests.forEach(({ method, level }) => {
      describe(method, () => {
        it(`It should log the message and the request at the ${method} level`, async () => {
          await request(app.getHttpServer() as App).get(`/log/${method}`)

          expect(requestLogs).toContainEqual(
            expect.objectContaining({
              level,
              msg: message,
              req: expect.objectContaining({
                method: "GET",
                path: `/log/${method}`,
              }),
            }),
          )
        })

        it(`It should log the message, merge the context, and include the request at the ${method} level`, async () => {
          await request(app.getHttpServer() as App).get(
            `/log/${method}?context=1`,
          )

          expect(requestLogs).toContainEqual(
            expect.objectContaining({
              level,
              msg: message,
              req: expect.objectContaining({ path: `/log/${method}` }),
              ...context,
            }),
          )
        })
      })
    })

    it("should include the request when the static delegate is called", async () => {
      await request(app.getHttpServer() as App).get("/static")

      expect(requestLogs).toContainEqual(
        expect.objectContaining({
          level: LogLevelNumber.warn,
          msg: message,
          req: expect.objectContaining({ method: "GET", path: "/static" }),
        }),
      )
    })
  })

  describe("Log Level Filtering (defaultLevel)", () => {
    const cases: Array<{ defaultLevel: LogLevel; expected: LogLevelNumber[] }> =
      [
        {
          defaultLevel: LogLevel.Trace,
          expected: [
            LogLevelNumber.trace,
            LogLevelNumber.debug,
            LogLevelNumber.info,
            LogLevelNumber.warn,
            LogLevelNumber.error,
            LogLevelNumber.fatal,
          ],
        },
        {
          defaultLevel: LogLevel.Debug,
          expected: [
            LogLevelNumber.debug,
            LogLevelNumber.info,
            LogLevelNumber.warn,
            LogLevelNumber.error,
            LogLevelNumber.fatal,
          ],
        },
        {
          defaultLevel: LogLevel.Info,
          expected: [
            LogLevelNumber.info,
            LogLevelNumber.warn,
            LogLevelNumber.error,
            LogLevelNumber.fatal,
          ],
        },
        {
          defaultLevel: LogLevel.Warn,
          expected: [
            LogLevelNumber.warn,
            LogLevelNumber.error,
            LogLevelNumber.fatal,
          ],
        },
        {
          defaultLevel: LogLevel.Error,
          expected: [LogLevelNumber.error, LogLevelNumber.fatal],
        },
        { defaultLevel: LogLevel.Fatal, expected: [LogLevelNumber.fatal] },
      ]

    cases.forEach(({ defaultLevel, expected }) => {
      it(`It should log at '${defaultLevel}' level and above when defaultLevel is '${defaultLevel}'`, async () => {
        const levelLogs: any[] = []
        const module: TestingModule = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(levelLogs),
              defaultLevel,
            }),
          ],
        }).compile()

        const levelService = module.get(ApplicationLogger)

        levelService.trace(message)
        levelService.debug(message)
        levelService.info(message)
        levelService.warn(message)
        levelService.error(message)
        levelService.fatal(message)

        expect(levelLogs.map((l: any) => l.level)).toEqual(expected)
      })
    })
  })

  describe("Static context configuration", () => {
    const staticContext = {
      service: "test-service",
      version: "1.0.0",
      environment: "test",
    }

    beforeEach(async () => {
      logs = []
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          LoggingModule.forRoot({
            destination: new ArrayStream(logs),
            defaultLevel: LogLevel.Trace,
            context: staticContext,
          }),
        ],
      }).compile()

      service = module.get(ApplicationLogger)
    })

    LogMethodTests.forEach(({ method: methodName, level }) => {
      const method = methodName as LogMethod
      describe(method, () => {
        it(`It should include the configured context when logging a bare message at ${method} level`, () => {
          service[method](message)

          expect(logs).toContainEqual(
            expect.objectContaining({
              level,
              msg: message,
              ...staticContext,
            }),
          )
        })

        it(`It should merge call-time context alongside the configured context at ${method} level`, () => {
          const contextParam = { userId: "user123", action: "login" }

          service[method](message, contextParam)

          expect(logs).toContainEqual(
            expect.objectContaining({
              level,
              msg: message,
              ...staticContext,
              ...contextParam,
            }),
          )
        })
      })
    })
  })

  describe("Redaction", () => {
    const REDACTED_VALUE = "[REDACTED]"
    const REDACTED_PATHS = [
      "password",
      "*.password",
      "job.salary",
      "tokens.*.secretKey",
      "medicalRecords.*",
    ]

    describe(`Given redaction is configured for the fields ${REDACTED_PATHS.join(", ")}`, () => {
      beforeEach(async () => {
        logs = []
        const module: TestingModule = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              redact: REDACTED_PATHS,
            }),
          ],
        }).compile()

        service = module.get(ApplicationLogger)
      })

      it("should redact the top level password field (password)", () => {
        const message = faker.hacker.phrase()
        const event = {
          username: faker.internet.username(),
          password: faker.internet.password(),
          email: faker.internet.email(),
        }

        service.info(message, event)

        expect(logs).toContainEqual(
          expect.objectContaining({
            username: event.username,
            email: event.email,
            password: REDACTED_VALUE,
          }),
        )
      })

      it("should redact single-level nested password (*.password)", () => {
        const message = faker.hacker.phrase()
        const event = {
          username: faker.internet.username(),
          googleCredentials: {
            password: faker.internet.password(),
            email: faker.internet.email(),
          },
        }

        service.info(message, event)

        expect(logs).toContainEqual(
          expect.objectContaining({
            username: event.username,
            googleCredentials: {
              email: event.googleCredentials.email,
              password: REDACTED_VALUE,
            },
          }),
        )
      })

      it("should redact job.salary (job.salary)", () => {
        const message = faker.hacker.phrase()
        const event = {
          name: faker.person.fullName(),
          job: {
            title: faker.person.jobTitle(),
            salary: faker.number.float({ min: 50000, max: 200000 }),
          },
        }

        service.info(message, event)

        expect(logs).toContainEqual(
          expect.objectContaining({
            name: event.name,
            job: {
              title: event.job.title,
              salary: REDACTED_VALUE,
            },
          }),
        )
      })

      it("should redact tokens.*.secretKey across object children", () => {
        const message = faker.hacker.phrase()
        const event = {
          username: faker.internet.username(),
          tokens: {
            github: {
              secretKey: faker.internet.password(),
              expires: faker.date.future().toString(),
            },
            aws: {
              secretKey: faker.internet.password(),
              region: faker.location.country(),
            },
          },
        }

        service.info(message, event)

        expect(logs).toContainEqual(
          expect.objectContaining({
            username: event.username,
            tokens: {
              github: {
                expires: event.tokens.github.expires,
                secretKey: REDACTED_VALUE,
              },
              aws: {
                region: event.tokens.aws.region,
                secretKey: REDACTED_VALUE,
              },
            },
          }),
        )
      })

      it("should redact all nested properties within medicalRecords (medicalRecords.*)", () => {
        const message = faker.hacker.phrase()
        const event = {
          name: faker.person.fullName(),
          medicalRecords: {
            bloodType: "O+",
            allergies: ["peanuts"],
            conditions: ["diabetes"],
            medications: ["insulin"],
          },
        }

        service.info(message, event)

        expect(logs).toContainEqual(
          expect.objectContaining({
            name: event.name,
            medicalRecords: {
              bloodType: REDACTED_VALUE,
              allergies: REDACTED_VALUE,
              conditions: REDACTED_VALUE,
              medications: REDACTED_VALUE,
            },
          }),
        )
      })
    })
  })
})
