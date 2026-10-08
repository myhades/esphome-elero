import {DeviceDiagnostics} from './DeviceDiagnostics';
interface DiagnosticsData {
  'uptime_ms'?: number;
  'tx_success'?: number;
  'tx_fail'?: number;
  'rx_packets'?: number;
  'rx_drops'?: number;
  'fifo_overflows'?: number;
  'watchdog_recoveries'?: number;
  'device_commands_queued'?: number;
  'devices'?: DeviceDiagnostics[];
  'additionalProperties'?: Map<string, any>;
}
export { DiagnosticsData };