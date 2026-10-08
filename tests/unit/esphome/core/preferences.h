// Stub for unit tests
#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include <map>
#include <cstring>

namespace esphome {

inline std::map<uint32_t, std::vector<uint8_t>> preference_data;
inline bool preference_save_fails = false;

class ESPPreferenceObject {
 public:
  ESPPreferenceObject() = default;
  explicit ESPPreferenceObject(uint32_t key) : key_(key) {}
  template<typename T> bool save(const T *value) {
    if (preference_save_fails) return false;
    const auto *bytes = reinterpret_cast<const uint8_t *>(value);
    preference_data[key_] = std::vector<uint8_t>(bytes, bytes + sizeof(T));
    return true;
  }
  template<typename T> bool load(T *value) {
    auto it = preference_data.find(key_);
    if (it == preference_data.end() || it->second.size() != sizeof(T)) return false;
    std::memcpy(value, it->second.data(), sizeof(T));
    return true;
  }
 private:
  uint32_t key_{0};
};

class ESPPreferences {
 public:
  template<typename T>
  ESPPreferenceObject make_preference(uint32_t key) { return ESPPreferenceObject(key); }
  bool sync() { return true; }
};

extern ESPPreferences *global_preferences;

}  // namespace esphome
