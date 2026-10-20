import { faker } from "@faker-js/faker"
import { express } from "@neomaventures/mocks"
import { getRequest } from "@neomaventures/request-context"
import { Test, type TestingModule } from "@nestjs/testing"
import { type Request } from "express"
import { LogLevelNumber, LogMethodTests, ArrayStream } from "fixtures/logging"

import {
  ApplicationLogger,
  type LoggingModuleOptions,
  LoggingModule,
} from "../index"
import { LOGGING_MODULE_OPTIONS } from "../symbols"

jest.mock("@neomaventures/request-context", () => ({
  getRequest: jest.fn(),
}))

const mockedGetRequest = jest.mocked(getRequest)

describe("ApplicationLogger", () => {
  const message = faker.hacker.phrase()
  const context = { ctx: faker.lorem.word() }

  let service: ApplicationLogger
  let logOptions: LoggingModuleOptions & { destination: ArrayStream }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggingModule.forRoot()],
    })
      .overrideProvider(LOGGING_MODULE_OPTIONS)
      .useValue({ destination: new ArrayStream(), defaultLevel: "trace" })
      .compile()

    service = module.get(ApplicationLogger)
    logOptions = module.get(LOGGING_MODULE_OPTIONS)

    mockedGetRequest.mockReturnValue(undefined)
  })

  afterEach(() => {
    mockedGetRequest.mockReset()
  })

  describe("Default Configuration", () => {
    it("should default to 'info' level when using forRoot() with no options", async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggingModule.forRoot()],
      })
        .overrideProvider(LOGGING_MODULE_OPTIONS)
        .useValue({ destination: new ArrayStream() })
        .compile()

      const service = module.get(ApplicationLogger)

      // Level-filtering behaviour is exhaustively covered in
      // create-logger.spec.ts; this test asserts only that the *default*
      // (no options) resolves to 'info' on the ApplicationLogger's underlying
      // pino instance.
      expect((service as any).pino.level).toBe("info")
    })

    it("should default to 'info' level when using forRoot() with no defaultLevel", async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [LoggingModule.forRoot({ destination: new ArrayStream() })],
      }).compile()

      const service = module.get(ApplicationLogger)

      // See sibling test: level filtering is covered by create-logger.spec.ts;
      // this test only asserts the default-level resolution when the caller
      // passes options without a defaultLevel.
      expect((service as any).pino.level).toBe("info")
    })
  })

  describe("Logging Methods", () => {
    LogMethodTests.forEach(({ method: methodName, level }) => {
      const method = methodName as keyof Pick<
        ApplicationLogger,
        "trace" | "debug" | "info" | "warn" | "error" | "fatal"
      >
      describe(method, () => {
        describe("When it's called outside a request context", () => {
          describe("When it's called with just a message", () => {
            it(`It should log the message at the ${method} level`, () => {
              service[method](message)
              expect(
                (logOptions.destination as ArrayStream).logs,
              ).toContainEqual(expect.objectContaining({ level, msg: message }))
            })
          })

          describe("When it's called with a context object", () => {
            it(`It should log the message and merge the context's properties at the ${method} level`, () => {
              service[method](message, context)
              expect(
                (logOptions.destination as ArrayStream).logs,
              ).toContainEqual(
                expect.objectContaining({ level, msg: message, ...context }),
              )
            })
          })
        })

        describe("When it's called inside a request context", () => {
          const path = `/${faker.lorem.slug()}`
          const request = { ...express.request(), originalUrl: path }
          beforeEach(() => {
            mockedGetRequest.mockReturnValue(request as unknown as Request)
          })

          describe("When it's called with just a message", () => {
            it(`It should log the message and the request at the ${method} level`, () => {
              service[method](message)
              expect(
                (logOptions.destination as ArrayStream).logs,
              ).toContainEqual(
                expect.objectContaining({
                  level,
                  msg: message,
                  req: expect.objectContaining({
                    method: request.method,
                    path,
                  }),
                }),
              )
            })
          })

          describe("When it's called with a context object", () => {
            it(`It should log the message, merge the context, and include the request at the ${method} level`, () => {
              service[method](message, context)
              expect(
                (logOptions.destination as ArrayStream).logs,
              ).toContainEqual(
                expect.objectContaining({
                  level,
                  msg: message,
                  req: expect.objectContaining({
                    method: request.method,
                    path,
                  }),
                  ...context,
                }),
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

        expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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

        expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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
      expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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
      expect((logOptions.destination as ArrayStream).logs).toContainEqual(
        expect.objectContaining({
          level: LogLevelNumber.error,
          msg: message,
          err: expect.objectContaining({ message: err.message }),
        }),
      )
    })

    it("should include the request when the static delegate is called inside a request context", () => {
      const path = `/${faker.lorem.slug()}`
      const request = { ...express.request(), originalUrl: path }
      mockedGetRequest.mockReturnValue(request as unknown as Request)

      ApplicationLogger.warn(message)

      expect((logOptions.destination as ArrayStream).logs).toContainEqual(
        expect.objectContaining({
          level: LogLevelNumber.warn,
          msg: message,
          req: expect.objectContaining({
            method: request.method,
            path,
          }),
        }),
      )
    })
  })

  describe("Log Level Filtering (defaultLevel)", () => {
    const cases: Array<{ defaultLevel: any; expected: LogLevelNumber[] }> = [
      {
        defaultLevel: "trace",
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
        defaultLevel: "debug",
        expected: [
          LogLevelNumber.debug,
          LogLevelNumber.info,
          LogLevelNumber.warn,
          LogLevelNumber.error,
          LogLevelNumber.fatal,
        ],
      },
      {
        defaultLevel: "info",
        expected: [
          LogLevelNumber.info,
          LogLevelNumber.warn,
          LogLevelNumber.error,
          LogLevelNumber.fatal,
        ],
      },
      {
        defaultLevel: "warn",
        expected: [
          LogLevelNumber.warn,
          LogLevelNumber.error,
          LogLevelNumber.fatal,
        ],
      },
      {
        defaultLevel: "error",
        expected: [LogLevelNumber.error, LogLevelNumber.fatal],
      },
      { defaultLevel: "fatal", expected: [LogLevelNumber.fatal] },
    ]

    cases.forEach(({ defaultLevel, expected }) => {
      it(`It should log at '${defaultLevel}' level and above when defaultLevel is '${defaultLevel}'`, async () => {
        const logs: any[] = []
        const module: TestingModule = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(logs),
              defaultLevel,
            }),
          ],
        }).compile()

        const service = module.get(ApplicationLogger)

        service.trace(message)
        service.debug(message)
        service.info(message)
        service.warn(message)
        service.error(message)
        service.fatal(message)

        expect(logs.map((l: any) => l.level)).toEqual(expected)
      })
    })
  })

  describe("Static context configuration", () => {
    const logs: any[] = []
    const message = faker.hacker.phrase()
    const staticContext = {
      service: "test-service",
      version: "1.0.0",
      environment: "test",
    }

    let service: ApplicationLogger
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          LoggingModule.forRoot({
            destination: new ArrayStream(logs),
            defaultLevel: "trace",
            context: staticContext,
          }),
        ],
      }).compile()

      service = module.get(ApplicationLogger)
    })

    LogMethodTests.forEach(({ method: methodName, level }) => {
      const method = methodName as keyof Pick<
        ApplicationLogger,
        "trace" | "debug" | "info" | "warn" | "error" | "fatal"
      >
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
        const module: TestingModule = await Test.createTestingModule({
          imports: [
            LoggingModule.forRoot({
              destination: new ArrayStream(),
              redact: REDACTED_PATHS,
            }),
          ],
        }).compile()

        service = module.get(ApplicationLogger)
        logOptions = module.get(LOGGING_MODULE_OPTIONS)
      })

      it("should redact the top level password field (password)", () => {
        const message = faker.hacker.phrase()
        const event = {
          username: faker.internet.username(),
          password: faker.internet.password(),
          email: faker.internet.email(),
        }

        service.info(message, event)

        expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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

        expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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

        expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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

        expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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

        expect((logOptions.destination as ArrayStream).logs).toContainEqual(
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
