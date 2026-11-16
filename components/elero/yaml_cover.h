#pragma once
#ifdef USE_COVER
#include "esp_cover_shell.h"
#include "output_adapter.h"

namespace esphome::elero {
// Native entity identity belongs to ESPHome YAML. RF state belongs to the registry.
class YamlCover final : public EspCoverShell, public OutputAdapter {
 public:
  void set_config(const NvsDeviceConfig &config) { config_ = config; }
  void setup(DeviceRegistry &registry) override { registry_ = &registry; }
  void setup() override {
    if (!registry_ || !(device_ = registry_->upsert(config_))) {
      ESP_LOGE("elero.cover", "Could not bind YAML cover 0x%06x", config_.dst_address);
      mark_failed();
      return;
    }
    EspCoverShell::setup();
  }
  void loop() override {}
  void on_device_added(const Device &) override {}
  void on_device_removed(const Device &) override {}
  void on_state_changed(const Device &device, uint16_t changes) override {
    if (&device == device_) sync_and_publish(changes);
  }
  void tilt_step(bool up) {
    if (device_) registry_->command_cover_tilt_step(*device_, up);
  }
  bool debug_send(int command, int type, int type2, int hop, int destination,
                  int payload_1, int payload_2, int packets) {
    if (!device_ || !registry_) {
      ESP_LOGW("elero.debug", "Rejected: YAML cover not bound");
      return false;
    }
    return registry_->debug_send(*device_, command, type, type2, hop, destination,
                                 payload_1, payload_2, packets);
  }
  void query_status() {
    if (device_) registry_->request_check(*device_);
  }
 private:
  NvsDeviceConfig config_{};
};
}  // namespace esphome::elero
#endif
