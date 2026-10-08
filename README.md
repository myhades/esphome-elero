# Elero Raffstore for ESPHome

ESP32-S3 N16R8 + CC1101，ESPHome 2026.9.1。通过原生 API 接入 Home Assistant，无需 Web UI、Node 或 pnpm。

## 使用

```yaml
external_components:
  - source: github://myhades/esphome-elero@release
    components: [elero]
    refresh: 0s
```

`release` 跟随最新正式发布；固定版本用 `@v0.1.0`。更新组件后需要重新编译并 OTA。

参考 [完整配置](configs/raffstore.yaml)，填入自己的 Wi-Fi、API/OTA 凭据、电机地址、遥控器地址和频道。

- `state_strategy: timed`：按方向、当前位置和全程时间计算剩余行程，加上 `endpoint_margin` 后结束估算；未知位置使用完整行程。终点 RF 反馈仍优先生效。
- `state_strategy: feedback`：等待电机反馈，未收到时有运动超时保护。
- HA 的 100% 是全开，0% 是全关；百分比来自时间估算。启动位置未知时显示 50% 占位。
- 不用 Tilt 时省略 `tilt` 和两条 Tilt 命令。需要时设置 `tilt: true`、`commands.tilt_up/tilt_down`，用按钮的 `action: tilt_up/tilt_down` 控制。
- RSSI 放在 `sensor`，查询按钮放在 `button`，均用 `platform: elero` 和 `cover_id` 关联窗帘。
- `text_sensor` 可分别暴露 `rf_state`、`position_source`、`transition_reason`；合并为 RSSI 属性可用 [HA 模板](configs/ha-rssi-attributes.yaml)。

设备配置以 YAML 为准，旧 NVS 数据保留。已实机确认上下和 STOP；Tilt 尚未确认。
