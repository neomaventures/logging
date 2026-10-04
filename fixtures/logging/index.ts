import { type LogLevel } from "../../src/index"

/**
 * Complete mapping of pino log levels to their numeric equivalents.
 */
export enum LogLevelNumber {
  trace = 10,
  debug = 20,
  info = 30,
  warn = 40,
  error = 50,
  fatal = 60,
}

/**
 * Complete list of log methods and their corresponding log levels.
 */
export const LogMethodTests: Array<{
  method: LogLevel
  level: LogLevelNumber
}> = [
  { method: "trace", level: LogLevelNumber.trace },
  { method: "debug", level: LogLevelNumber.debug },
  { method: "info", level: LogLevelNumber.info },
  { method: "warn", level: LogLevelNumber.warn },
  { method: "error", level: LogLevelNumber.error },
  { method: "fatal", level: LogLevelNumber.fatal },
] as const

/**
 * A simple writable stream implementation that stores log entries in an array.
 * Designed for testing logger output by capturing logged objects in memory.
 *
 * @example
 * ```typescript
 * const stream = new ArrayStream()
 * const module = await Test.createTestingModule({
 *   imports: [LoggingModule.forRoot({ destination: stream })]
 * }).compile()
 *
 * const logger = module.get(ApplicationLogger)
 * logger.info('test message')
 * expect(stream.logs[0]).toMatchObject({
 *   level: LogLevelNumber.info,
 *   msg: 'test message'
 * })
 * ```
 */
export class ArrayStream {
  /**
   * Creates a new ArrayStream instance.
   *
   * @param arr - Optional initial array to store log entries. Defaults to empty array.
   */
  public constructor(public readonly arr: Array<any> = []) {}

  /**
   * Writes a log entry to the internal array.
   *
   * @param chunk - The log object to store
   */
  public write(chunk: string): void {
    this.arr.push(JSON.parse(chunk))
  }

  /**
   * Returns a copy of all logged entries.
   *
   * @returns A copy of the internal log array
   */
  public get logs(): Array<any> {
    return [...this.arr]
  }
}
