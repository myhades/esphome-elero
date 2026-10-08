#pragma once
#if defined(USE_COVER) && defined(USE_BUTTON)
#include "esphome/components/button/button.h"
#include "yaml_cover.h"
namespace esphome::elero {
class TiltStepButton final : public button::Button {
 public:
  TiltStepButton(YamlCover *cover, bool up) : cover_(cover), up_(up) {}
 protected:
  void press_action() override { cover_->tilt_step(up_); }
  YamlCover *cover_;
  bool up_;
};
}  // namespace esphome::elero
#endif
