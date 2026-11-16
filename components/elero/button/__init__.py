import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import button

from .. import elero_ns
from ..cover import YamlCover

DEPENDENCIES = ["elero"]
RefreshButton = elero_ns.class_("RefreshButton", button.Button)
TiltStepButton = elero_ns.class_("TiltStepButton", button.Button)
DebugCommandButton = elero_ns.class_("DebugCommandButton", button.Button)
CoverAction = elero_ns.enum("CoverAction", is_class=True)
DEBUG_ACTIONS = {
    "short_up": CoverAction.TILT_UP,
    "long_up": CoverAction.UP,
    "short_down": CoverAction.TILT_DOWN,
    "long_down": CoverAction.DOWN,
    "stop": CoverAction.STOP,
}
DEBUG_SCHEMA = button.button_schema(DebugCommandButton, entity_category="diagnostic").extend({
    cv.Required("cover_id"): cv.use_id(YamlCover),
    cv.Required("action"): cv.one_of(*DEBUG_ACTIONS),
})
QUERY_SCHEMA = button.button_schema(
    RefreshButton, entity_category="diagnostic", icon="mdi:refresh",
).extend({cv.Required("cover_id"): cv.use_id(YamlCover)})

TILT_SCHEMA = button.button_schema(TiltStepButton).extend({
    cv.Required("cover_id"): cv.use_id(YamlCover),
    cv.Required("action"): cv.one_of("tilt_up", "tilt_down"),
})
CONFIG_SCHEMA = cv.Any(DEBUG_SCHEMA, TILT_SCHEMA, QUERY_SCHEMA)

async def to_code(config):
    cover = await cg.get_variable(config["cover_id"])
    if config.get("action") in DEBUG_ACTIONS:
        await button.new_button(config, cover, DEBUG_ACTIONS[config["action"]])
        return
    if "action" in config:
        await button.new_button(config, cover, config["action"] == "tilt_up")
        return
    cg.add(cover.set_refresh_button(await button.new_button(config)))
