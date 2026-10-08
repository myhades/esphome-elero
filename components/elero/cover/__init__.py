"""Static native cover, with explicit RF actions and honest state provenance."""
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import button, cover, sensor, text_sensor
from esphome.const import CONF_ID

from .. import CONF_REGISTRY_ID, DeviceRegistry, OutputAdapter, elero_ns

DEPENDENCIES = ["elero"]
AUTO_LOAD = ["sensor", "text_sensor", "button"]
YamlCover = elero_ns.class_("YamlCover", cover.Cover, cg.Component, OutputAdapter)
TiltStepButton = elero_ns.class_("TiltStepButton", button.Button)
ACTIONS = ("up", "down", "stop", "tilt_up", "tilt_down", "preset", "check")
ADDRESS = cv.hex_int_range(min=1, max=0xFFFFFF)
DURATION = cv.All(cv.positive_time_period_milliseconds, cv.Range(max=cv.TimePeriod(milliseconds=120000)))
def action_header_defaults(config):
    config.setdefault("type2", 0x10 if config["type"] == 0x44 else 0)
    config.setdefault("hop", 0 if config["type"] == 0x44 else 0x0A)
    return config


ACTION_SCHEMA = cv.All(cv.Schema({
    cv.Required("command"): cv.hex_uint8_t,
    cv.Required("type"): cv.All(cv.hex_uint8_t, cv.one_of(0x44, 0x69, 0x6A)),
    cv.Optional("type2"): cv.hex_uint8_t,
    cv.Optional("hop"): cv.hex_uint8_t,
    cv.Optional("payload_1", default=0): cv.hex_uint8_t,
    cv.Optional("payload_2", default=4): cv.hex_uint8_t,
    cv.Optional("destination", default="command"): cv.one_of("command", "status"),
}), action_header_defaults)


def validate_timing(config):
    opening = config["open_duration"].total_milliseconds
    closing = config["close_duration"].total_milliseconds
    if bool(opening) != bool(closing):
        raise cv.Invalid("Set both travel durations, or leave both at 0s")
    if config["state_strategy"] == "timed" and not (opening and closing):
        raise cv.Invalid("timed state strategy requires calibrated open_duration and close_duration")
    return config


def add_tilt_buttons(config):
    config = dict(config)
    if cv.boolean(config.get("tilt", True)):
        for direction in ("up", "down"):
            config.setdefault(f"tilt_{direction}_button", {
                "name": f"{config.get('name', 'Raffstore')} Tilt {direction.title()} Step",
            })
    return config


CONFIG_SCHEMA = cv.All(add_tilt_buttons, cover.cover_schema(YamlCover).extend({
    cv.GenerateID(CONF_REGISTRY_ID): cv.use_id(DeviceRegistry),
    cv.Required("status_address"): ADDRESS,
    cv.Required("remote_address"): ADDRESS,
    cv.Required("command_address"): ADDRESS,
    cv.Required("channel"): cv.int_range(min=0, max=255),
    cv.Optional("open_duration", default="0s"): DURATION,
    cv.Optional("close_duration", default="0s"): DURATION,
    cv.Optional("state_strategy", default="feedback"): cv.one_of("feedback", "timed"),
    cv.Optional("endpoint_margin", default="2s"): cv.All(
        cv.positive_time_period_milliseconds,
        cv.Range(min=cv.TimePeriod(milliseconds=1), max=cv.TimePeriod(milliseconds=30000))),
    cv.Optional("tilt", default=True): cv.boolean,
    cv.Optional("tilt_up_button"): button.button_schema(TiltStepButton),
    cv.Optional("tilt_down_button"): button.button_schema(TiltStepButton),
    cv.Required("commands"): cv.Schema({cv.Required(action): ACTION_SCHEMA for action in ACTIONS}),
    cv.Optional("rssi"): sensor.sensor_schema(unit_of_measurement="dBm", accuracy_decimals=0, entity_category="diagnostic"),
    cv.Optional("status"): text_sensor.text_sensor_schema(entity_category="diagnostic"),
}).extend(cv.COMPONENT_SCHEMA), validate_timing)


def final_validate(config):
    from esphome import final_validate as fv
    covers = fv.full_config.get().get("cover", [])
    peers = [c for c in covers if c.get("platform") == "elero"]
    addresses = [c["status_address"] for c in peers]
    if len(addresses) != len(set(addresses)):
        raise cv.Invalid("Each Elero cover needs a unique status_address")
    if len(peers) > 48:
        raise cv.Invalid("At most 48 Elero covers are supported")
    return config


FINAL_VALIDATE_SCHEMA = final_validate

async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    await cover.register_cover(var, config)
    registry = await cg.get_variable(config[CONF_REGISTRY_ID])
    cg.add(var.set_registry(registry))
    cg.add(registry.add_adapter(var))
    # The ABI-stable NVS struct is also our in-memory configuration; YAML never saves it.
    fields = {
        "dst_address": config["status_address"], "src_address": config["remote_address"],
        "command_address": config["command_address"], "channel": config["channel"],
        "command_profile": 1, "supports_tilt": int(config["tilt"]),
        "open_duration_ms": config["open_duration"].total_milliseconds,
        "close_duration_ms": config["close_duration"].total_milliseconds,
        "endpoint_margin_ms": config["endpoint_margin"].total_milliseconds if config["state_strategy"] == "timed" else 0,
    }
    body = "elero::NvsDeviceConfig cfg; "
    body += " ".join(f"cfg.{key} = {int(value)};" for key, value in fields.items())
    for index, action in enumerate(ACTIONS):
        values = dict(config["commands"][action], enabled=1)
        values["destination"] = int(values["destination"] == "status")
        body += " " + " ".join(f"cfg.actions[{index}].{key} = {int(value)};" for key, value in values.items())
    body += " return cfg;"
    cg.add(var.set_config(cg.RawExpression(f"[]() {{ {body} }}()")))
    if "rssi" in config:
        cg.add(var.set_rssi_sensor(await sensor.new_sensor(config["rssi"])))
    if "status" in config:
        cg.add(var.set_status_sensor(await text_sensor.new_text_sensor(config["status"])))

    if config["tilt"]:
        await button.new_button(config["tilt_up_button"], var, True)
        await button.new_button(config["tilt_down_button"], var, False)
