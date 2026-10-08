#pragma once

namespace esphome::elero {
// Native cover API floats have no nullable representation. HA rounds them to int.
// Keep unknownness in the registry/status diagnostic; never feed NaN to that API.
inline float native_cover_position(bool known, int percent) {
  return known && percent >= 0 && percent <= 100 ? percent / 100.0f : 0.5f;
}
inline bool native_cover_has_tilt(bool configured, unsigned profile) {
  // Raffstore steps cannot truthfully advertise an absolute angle/slider.
  return configured && profile != 1;
}
}  // namespace esphome::elero
