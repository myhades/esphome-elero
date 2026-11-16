// Offline regression against MonoTel 2 captures, using the production codec.
#include "elero_packet.h"
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

namespace p = esphome::elero::packet;
namespace protocol = esphome::elero::protocol;

int main(int argc, char **argv) {
  assert(argc == 8);
  const std::string hex = argv[1];
  assert(hex.size() == 64);
  uint8_t captured[32]{};
  for (size_t i = 0; i < sizeof(captured); ++i)
    captured[i] = static_cast<uint8_t>(std::stoul(hex.substr(i * 2, 2), nullptr, 16));
  const auto observed = p::parse_packet(captured, sizeof(captured));
  assert(observed.valid && observed.crc_ok && observed.type == 0x69);

  p::TxParams params;
  params.command = static_cast<uint8_t>(std::stoul(argv[2]));
  params.type = static_cast<uint8_t>(std::stoul(argv[3]));
  params.type2 = static_cast<uint8_t>(std::stoul(argv[4]));
  params.hop = static_cast<uint8_t>(std::stoul(argv[5]));
  params.payload_1 = static_cast<uint8_t>(std::stoul(argv[6]));
  params.payload_2 = static_cast<uint8_t>(std::stoul(argv[7]));
  params.src_addr = observed.src_addr;
  params.dst_addr = observed.dst_addr;
  params.channel = observed.channel;
  params.counter = 43;  // Fresh counter; captured ciphertext must not be replayed.

  assert(params.command == observed.command);
  assert(params.type == observed.type);
  assert(params.payload_1 == captured[20] && params.payload_2 == captured[21]);
  // Intended origin reconstruction, not a claim that a direct frame was captured.
  assert(params.type2 == (observed.type2 & 0xFE));
  assert(params.hop == (observed.hop & 0x0F));

  uint8_t built[32]{};
  assert(p::build_tx_packet(params, built) == 30);
  assert(built[0] == captured[0] && built[1] == 43);
  assert(std::memcmp(built + 5, captured + 5, 5) == 0); // system/channel/source
  assert(std::memcmp(built + 16, captured + 16, 6) == 0); // destination/prefix
  assert(p::extract_addr(built + 10) == params.src_addr);
  assert(p::extract_addr(built + 13) == params.src_addr);
  built[30] = captured[30];  // Synthetic RX metadata to exercise the production parser.
  built[31] = captured[31];
  const auto decoded = p::parse_packet(built, sizeof(built));
  assert(decoded.valid && decoded.command == observed.command);
  assert(std::memcmp(decoded.payload + 2, observed.payload + 2, 5) == 0);

  // Captured seeds differ from our counter-derived seeds. Verify exact codec
  // round-trip with the recovered seed, rather than labelling ciphertext unequal.
  uint8_t body[8];
  std::memcpy(body, captured + 22, 8);
  protocol::decode_nibbles(body, 8);
  protocol::sub_r20_from_nibbles(body, 0xFE, 0, 2);
  const uint8_t seed0 = body[0], seed1 = body[1];
  protocol::xor_2byte_in_array_decode(body, seed0, seed1);
  protocol::sub_r20_from_nibbles(body, 0xBA, 2, 8);
  body[0] = seed0;
  body[1] = seed1;
  body[7] = 0;  // Encoder input excludes the captured parity byte.
  protocol::msg_encode(body);
  assert(std::memcmp(body, captured + 22, 8) == 0);
  std::puts("Captured payload and reconstructed origin packet verified offline.");
}
