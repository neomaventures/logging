/**
 * Token used to inject LoggingModule options
 */
export const LOGGING_MODULE_OPTIONS = Symbol("LOGGING_MODULE_OPTIONS")

/**
 * Namespace the package's own request logger emits under. Internal code
 * imports it from here; consumers use `LoggingModule.LogNamespace`, as
 * importing the module from inside the package would be circular.
 */
export const LOGGING_NAMESPACE = "neomaventures:logging"
