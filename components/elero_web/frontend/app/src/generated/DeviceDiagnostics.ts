
interface DeviceDiagnostics {
  'address'?: string;
  'queued'?: number;
  'current_tx_retries'?: number;
  /**
   * Last radio completion timestamp (0 if not yet available).
   */
  'last_tx_ms'?: number;
  /**
   * Last CHECK enqueue timestamp, not proof of transmission or response.
   */
  'last_check_queued_ms'?: number;
  /**
   * Age of last received status, omitted before the first response.
   */
  'response_age_ms'?: number;
  'additionalProperties'?: Map<string, any>;
}
export { DeviceDiagnostics };