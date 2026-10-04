import { type Logger } from "../interfaces/logger.interface"

/**
 * Test double implementing the canonical {@link Logger} contract from
 * `@neomaventures/logging`.
 *
 * Each method is a `jest.Mock` matching the `Logger` signature
 * `(message: string, context?: LogContext) => void`.
 *
 * Import from the `/testing` sub-path to keep the production barrel free of
 * `jest`:
 *
 * @example
 * ```ts
 * import { MockLogger } from "@neomaventures/logging/testing"
 *
 * const logger = new MockLogger()
 * service = new MyService(logger)
 *
 * expect(logger.error).toHaveBeenCalledWith(
 *   "charge failed",
 *   expect.objectContaining({ err: expect.any(Error) }),
 * )
 * ```
 *
 * @property trace A jest function that mocks the trace method from Logger.
 * @property debug A jest function that mocks the debug method from Logger.
 * @property info A jest function that mocks the info method from Logger.
 * @property warn A jest function that mocks the warn method from Logger.
 * @property error A jest function that mocks the error method from Logger.
 * @property fatal A jest function that mocks the fatal method from Logger.
 */
export class MockLogger implements Logger {
  public trace = jest.fn()
  public debug = jest.fn()
  public info = jest.fn()
  public warn = jest.fn()
  public error = jest.fn()
  public fatal = jest.fn()
}
