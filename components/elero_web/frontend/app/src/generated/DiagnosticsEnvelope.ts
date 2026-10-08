import {DiagnosticsData} from './DiagnosticsData';
interface DiagnosticsEnvelope {
  'event': 'diagnostics';
  'data': DiagnosticsData;
  'additionalProperties'?: Map<string, any>;
}
export { DiagnosticsEnvelope };