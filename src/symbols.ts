/**
 * Token used to inject LoggingModule options
 */
export const LOGGING_MODULE_OPTIONS = Symbol("LOGGING_MODULE_OPTIONS")

/**
 * Namespace the package's own request logger emits under. Raise it via
 * `forRoot({ loggers: [{ namespace: "neomaventures:logging", level }] })`.
 */
export const LOGGING_NAMESPACE = "neomaventures:logging"
