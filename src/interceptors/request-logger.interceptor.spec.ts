/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { executionContext, express } from "@neomaventures/mocks"
import {
  Controller,
  type ExecutionContext,
  Get,
  HttpStatus,
} from "@nestjs/common"
import { Test, type TestingModule } from "@nestjs/testing"
import { lastValueFrom, type Observable, of, throwError } from "rxjs"

import { LOGGING_MODULE_OPTIONS, LOGGING_NAMESPACE } from "../symbols"
import { MockLogger } from "../testing"

import { RequestLoggerInterceptor } from "./request-logger.interceptor"

@Controller("test")
class TestController {
  @Get()
  getTest() {
    return { message: "success" }
  }
}

const routeMetaData = {
  controller: { name: "TestController", path: "test" },
  handler: { name: "getTest", path: "/" },
}

const invocation = ({
  response = of({ message: "success" }) as Observable<unknown>,
}: { response?: Observable<unknown> } = {}) => {
  const req = express.request()
  const ctx = executionContext(req, undefined, {
    controller: TestController,
    method: "getTest",
  }) as ExecutionContext
  const handler = { handle: () => response }
  return { req, ctx, handler }
}

describe("RequestLoggerInterceptor", () => {
  describe("intercept()", () => {
    describe("Given the handler succeeds", () => {
      let interceptor: RequestLoggerInterceptor
      let logger: MockLogger

      beforeEach(async () => {
        logger = new MockLogger()
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            RequestLoggerInterceptor,
            { provide: LOGGING_MODULE_OPTIONS, useValue: {} },
            { provide: LOGGING_NAMESPACE, useValue: logger },
          ],
        }).compile()
        interceptor = module.get(RequestLoggerInterceptor)
      })

      it("logs the dispatch with controller and handler metadata", async () => {
        const { ctx, handler } = invocation()

        await lastValueFrom(interceptor.intercept(ctx, handler))

        expect(logger.info).toHaveBeenNthCalledWith(
          1,
          "Processing an incoming request and dispatching it to a route handler.",
          expect.objectContaining(routeMetaData),
        )
      })

      it("logs the completion with res, duration, and metadata", async () => {
        const { ctx, handler } = invocation()

        await lastValueFrom(interceptor.intercept(ctx, handler))

        expect(logger.info).toHaveBeenNthCalledWith(
          2,
          "Processed an incoming request that was successfully handled by a route handler.",
          expect.objectContaining({
            ...routeMetaData,
            res: expect.any(Object),
            duration: expect.stringMatching(/^\d+ms$/),
          }),
        )
      })

      it("preserves the handler response unchanged", async () => {
        const handlerResponse = { message: "ok", code: HttpStatus.OK }
        const { ctx, handler } = invocation({ response: of(handlerResponse) })

        const received = await lastValueFrom(
          interceptor.intercept(ctx, handler),
        )

        expect(received).toEqual(handlerResponse)
      })
    })

    describe("Given the handler throws and logErrors is unset (defaults to true)", () => {
      let interceptor: RequestLoggerInterceptor
      let logger: MockLogger

      beforeEach(async () => {
        logger = new MockLogger()
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            RequestLoggerInterceptor,
            { provide: LOGGING_MODULE_OPTIONS, useValue: {} },
            { provide: LOGGING_NAMESPACE, useValue: logger },
          ],
        }).compile()
        interceptor = module.get(RequestLoggerInterceptor)
      })

      it("logs the error with metadata, duration, and the error", async () => {
        const { ctx, handler } = invocation({
          response: throwError(() => new Error("Test error")),
        })

        try {
          await lastValueFrom(interceptor.intercept(ctx, handler))
        } catch {
          // propagation is covered by the sibling "propagates" test below;
          // this test focuses on the error-log side-effect.
        }

        expect(logger.error).toHaveBeenCalledWith(
          "Error processing an incoming request in the route handler.",
          expect.objectContaining({
            ...routeMetaData,
            duration: expect.stringMatching(/^\d+ms$/),
            err: expect.objectContaining({ message: "Test error" }),
          }),
        )
      })

      it("propagates the error to the caller", async () => {
        const { ctx, handler } = invocation({
          response: throwError(() => new Error("Test error")),
        })

        await expect(
          lastValueFrom(interceptor.intercept(ctx, handler)),
        ).rejects.toThrow("Test error")
      })
    })

    describe("Given the handler throws and logErrors is true", () => {
      let interceptor: RequestLoggerInterceptor
      let logger: MockLogger

      beforeEach(async () => {
        logger = new MockLogger()
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            RequestLoggerInterceptor,
            { provide: LOGGING_MODULE_OPTIONS, useValue: { logErrors: true } },
            { provide: LOGGING_NAMESPACE, useValue: logger },
          ],
        }).compile()
        interceptor = module.get(RequestLoggerInterceptor)
      })

      it("logs the error with metadata, duration, and the error", async () => {
        const { ctx, handler } = invocation({
          response: throwError(() => new Error("Test error")),
        })

        try {
          await lastValueFrom(interceptor.intercept(ctx, handler))
        } catch {
          // propagation is covered by the sibling "propagates" test below.
        }

        expect(logger.error).toHaveBeenCalledWith(
          "Error processing an incoming request in the route handler.",
          expect.objectContaining({
            ...routeMetaData,
            duration: expect.stringMatching(/^\d+ms$/),
            err: expect.objectContaining({ message: "Test error" }),
          }),
        )
      })

      it("propagates the error to the caller", async () => {
        const { ctx, handler } = invocation({
          response: throwError(() => new Error("Test error")),
        })

        await expect(
          lastValueFrom(interceptor.intercept(ctx, handler)),
        ).rejects.toThrow("Test error")
      })
    })

    describe("Given the handler throws and logErrors is false", () => {
      let interceptor: RequestLoggerInterceptor
      let logger: MockLogger

      beforeEach(async () => {
        logger = new MockLogger()
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            RequestLoggerInterceptor,
            { provide: LOGGING_MODULE_OPTIONS, useValue: { logErrors: false } },
            { provide: LOGGING_NAMESPACE, useValue: logger },
          ],
        }).compile()
        interceptor = module.get(RequestLoggerInterceptor)
      })

      it("does not log the error", async () => {
        const { ctx, handler } = invocation({
          response: throwError(() => new Error("Test error")),
        })

        try {
          await lastValueFrom(interceptor.intercept(ctx, handler))
        } catch {
          // propagation is covered by the sibling "propagates" test below.
        }

        expect(logger.error).not.toHaveBeenCalled()
      })

      it("propagates the error to the caller", async () => {
        const { ctx, handler } = invocation({
          response: throwError(() => new Error("Test error")),
        })

        await expect(
          lastValueFrom(interceptor.intercept(ctx, handler)),
        ).rejects.toThrow("Test error")
      })
    })
  })
})
