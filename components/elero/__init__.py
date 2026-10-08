"""CC1101 hub for statically configured Raffstore covers."""
import hashlib
from pathlib import Path

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome import pins
from esphome.components import spi
from esphome.const import CONF_ID

DEPENDENCIES = ["spi", "esp32"]
elero_ns = cg.esphome_ns.namespace("elero")
elero = elero_ns.class_("Elero", cg.Component)
CC1101Driver = elero_ns.class_("CC1101Driver", spi.SPIDevice)
DeviceRegistry = elero_ns.class_("DeviceRegistry")
OutputAdapter = elero_ns.class_("OutputAdapter")
CONF_REGISTRY_ID = "registry_id"

CONFIG_SCHEMA = cv.All(
    cv.require_esphome_version(2026, 9, 1),
    cv.Schema({
        cv.GenerateID(): cv.declare_id(elero),
        cv.GenerateID(CONF_REGISTRY_ID): cv.declare_id(DeviceRegistry),
        cv.GenerateID("driver_id"): cv.declare_id(CC1101Driver),
        cv.Required("gdo0_pin"): pins.gpio_input_pin_schema,
        cv.Optional("freq0", default=0x7A): cv.hex_uint8_t,
        cv.Optional("freq1", default=0x71): cv.hex_uint8_t,
        cv.Optional("freq2", default=0x21): cv.hex_uint8_t,
    }).extend(cv.COMPONENT_SCHEMA).extend(spi.spi_device_schema(cs_pin_required=True)),
)

async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
    driver = cg.new_Pvariable(config["driver_id"])
    await spi.register_spi_device(driver, config)
    for key in ("freq0", "freq1", "freq2"):
        cg.add(getattr(driver, f"set_{key}")(config[key]))
        cg.add(getattr(var, f"set_{key}")(config[key]))
    cg.add(var.set_driver(driver))
    cg.add(var.set_irq_pin(await cg.gpio_pin_expression(config["gdo0_pin"])))
    digest = hashlib.sha256()
    root = Path(__file__).resolve().parent
    for source in sorted(root.rglob("*")):
        if source.is_file() and source.suffix in {".cpp", ".h", ".py"}:
            digest.update(source.relative_to(root).as_posix().encode())
            digest.update(source.read_bytes().replace(b"\r\n", b"\n"))
    cg.add(var.set_version(f"raffstore-0.1.0+{digest.hexdigest()[:12]}"))
    registry = cg.new_Pvariable(config[CONF_REGISTRY_ID])
    cg.add(registry.set_yaml_mode(True))
    cg.add(registry.set_hub(var))
    cg.add(var.set_registry(registry))
