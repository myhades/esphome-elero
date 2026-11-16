#pragma once
#if defined(USE_COVER) && defined(USE_BUTTON)
#include "esphome/components/button/button.h"
#include "yaml_cover.h"

namespace esphome::elero {
class DebugCommandButton final : public button::Button {
 public:
  DebugCommandButton(YamlCover *cover, CoverAction action) : cover_(cover), action_(action) {}
 protected:
  void press_action() override { cover_->debug_action(action_); }
  YamlCover *cover_;
  CoverAction action_;
};
}  // namespace esphome::elero
#endif
