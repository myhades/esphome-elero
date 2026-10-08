import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import text_sensor

from ..cover import YamlCover

DEPENDENCIES = ["elero"]
FIELDS = ("rf_state", "position_source", "transition_reason")
CONFIG_SCHEMA = cv.Schema({
    cv.Required("cover_id"): cv.use_id(YamlCover),
    **{cv.Optional(field): text_sensor.text_sensor_schema(entity_category="diagnostic") for field in FIELDS},
})

async def to_code(config):
    cover = await cg.get_variable(config["cover_id"])
    for field in FIELDS:
        if field in config:
            cg.add(getattr(cover, f"set_{field}_sensor")(await text_sensor.new_text_sensor(config[field])))
