import {DeviceType} from './DeviceType';
import {AnonymousSchema_102} from './AnonymousSchema_102';
import {HaCoverState} from './HaCoverState';
import {ProblemType} from './ProblemType';
import {RfStateName} from './RfStateName';
import {CommandSource} from './CommandSource';
/**
 * Snapshot of a device's derived state at the moment of change.
 * Sent on user commands (optimistic), RF status responses (confirmed),
 * FSM timeouts (recovery), and throttled position updates during movement.
 * Fields vary by device_type — covers include position/ha_state/tilted/device_class,
 * lights include is_on/brightness.
 */
interface StateChangedData {
  /**
   * 3-byte device address (hex string)
   * @example 0xa831e5
   */
  'address': string;
  /**
   * Type of device (cover, light, or remote control)
   */
  'device_type': DeviceType;
  'position_source'?: AnonymousSchema_102;
  'transition_reason'?: string;
  'response_age_ms'?: number;
  /**
   * Cover position (0.0 = closed, 1.0 = open). Cover only.
   */
  'position'?: number | null;
  /**
   * HA-compatible cover state. Cover only.
   */
  'ha_state'?: HaCoverState;
  /**
   * Whether the cover is tilted. Cover only.
   */
  'tilted'?: boolean;
  /**
   * HA device class (shutter, blind, awning, etc.). Cover only.
   * @example shutter
   */
  'device_class'?: string;
  /**
   * Whether the light is on. Light only.
   */
  'is_on'?: boolean;
  /**
   * Light brightness (0.0–1.0). Light only.
   */
  'brightness'?: number;
  /**
   * Whether the device is in a problem state (blocking, overheated, timeout)
   */
  'is_problem'?: boolean;
  /**
   * Problem classification or "none"
   */
  'problem_type'?: ProblemType;
  /**
   * Last RSSI in dBm
   * @example -65.5
   */
  'rssi'?: number;
  /**
   * RF state name as returned by elero_state_to_string().
   * Maps 1:1 to the protocol state bytes:
   *   0x00=unknown, 0x01=top, 0x02=bottom, 0x03=intermediate,
   *   0x04=tilt, 0x05=blocking, 0x06=overheated, 0x07=timeout,
   *   0x08=start_moving_up, 0x09=start_moving_down, 0x0a=moving_up,
   *   0x0b=moving_down, 0x0d=stopped, 0x0e=top_tilt,
   *   0x0f=bottom_tilt, 0x10=light_on
   */
  'state'?: RfStateName;
  /**
   * Who issued the last command
   */
  'command_source'?: CommandSource;
  /**
   * Timestamp (millis()) of last RF packet from this device
   * @example 1234567
   */
  'last_seen'?: number;
}
export { StateChangedData };