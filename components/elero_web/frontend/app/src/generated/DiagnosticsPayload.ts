
/**
 * Read-only counters and queue state; never issues RF CHECK.
 */
interface DiagnosticsPayload {
  'type': 'diagnostics';
  'additionalProperties'?: Map<string, any>;
}
export { DiagnosticsPayload };