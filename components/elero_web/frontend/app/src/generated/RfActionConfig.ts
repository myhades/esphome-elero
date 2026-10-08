
interface RfActionConfig {
  'enabled': boolean;
  'command': number;
  'type': number;
  'type2': number;
  'hop': number;
  'payload_1': number;
  'payload_2': number;
  'destination': number;
  'additionalProperties'?: Map<string, any>;
}
export { RfActionConfig };