import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import button

from .. import elero_ns
from ..cover import YamlCover

DEPENDENCIES = ["elero"]
RefreshButton = elero_ns.class_("RefreshButton", button.Button)
TiltStepButton = elero_ns.class_("TiltStepButton", button.Button)
QUERY_SCHEMA = button.button_schema(
    RefreshButton, entity_category="diagnostic", icon="mdi:refresh",
).extend({cv.Required("cover_id"): cv.use_id(YamlCover)})

TILT_SCHEMA = button.button_schema(TiltStepButton).extend({
    cv.Required("cover_id"): cv.use_id(YamlCover),
    cv.Required("action"): cv.one_of("tilt_up", "tilt_down"),
})
CONFIG_SCHEMA = cv.Any(TILT_SCHEMA, QUERY_SCHEMA)

async def to_code(config):
    cover = await cg.get_variable(config["cover_id"])
    if "action" in config:
        await button.new_button(config, cover, config["action"] == "tilt_up")
        return
    cg.add(cover.set_refresh_button(await button.new_button(config)))
