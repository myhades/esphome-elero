import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import sensor

from .. import elero

DEPENDENCIES = ["elero"]
STATS = {
    "tx_success": "set_stats_tx_success_sensor",
    "tx_fail": "set_stats_tx_fail_sensor",
    "rx_packets": "set_stats_rx_packets_sensor",
    "rx_drops": "set_stats_rx_drops_sensor",
    "last_rx_age": "set_stats_last_rx_age_sensor",
}
CONFIG_SCHEMA = cv.Schema({
    cv.GenerateID("elero_id"): cv.use_id(elero),
    **{cv.Optional(key): sensor.sensor_schema(
        accuracy_decimals=0, entity_category="diagnostic",
        **({"unit_of_measurement": "ms"} if key == "last_rx_age" else {"state_class": "total_increasing"})
    ) for key in STATS},
})

async def to_code(config):
    hub = await cg.get_variable(config["elero_id"])
    for key, setter in STATS.items():
        if key in config:
            cg.add(getattr(hub, setter)(await sensor.new_sensor(config[key])))
