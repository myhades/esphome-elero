#pragma once
#include <optional>
namespace esphome::cover {
constexpr float COVER_OPEN = 1.0f;
constexpr float COVER_CLOSED = 0.0f;
enum CoverOperation { COVER_OPERATION_IDLE, COVER_OPERATION_OPENING, COVER_OPERATION_CLOSING };
class CoverTraits {
 public:
  void set_supports_position(bool v) { position_ = v; }
  void set_supports_tilt(bool v) { tilt_ = v; }
  void set_supports_stop(bool) {}
  void set_supports_toggle(bool) {}
  void set_is_assumed_state(bool v) { assumed_ = v; }
  bool get_supports_position() const { return position_; }
  bool get_supports_tilt() const { return tilt_; }
  bool get_is_assumed_state() const { return assumed_; }
 private:
  bool position_{false}, tilt_{false}, assumed_{false};
};
class CoverCall {
 public:
  bool get_stop() const { return false; }
  const std::optional<float> &get_position() const { return value_; }
  const std::optional<float> &get_tilt() const { return value_; }
  const std::optional<bool> &get_toggle() const { return toggle_; }
 private:
  std::optional<float> value_;
  std::optional<bool> toggle_;
};
class Cover {
 public:
  virtual ~Cover() = default;
  virtual CoverTraits get_traits() = 0;
  void publish_state(bool = true) { ++publishes; }
  float position{1.0f}, tilt{0.0f};
  CoverOperation current_operation{COVER_OPERATION_IDLE};
  unsigned publishes{0};
 protected:
  virtual void control(const CoverCall &) = 0;
};
}  // namespace esphome::cover
