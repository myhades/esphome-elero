/// @file test_state_snapshot.cpp
/// @brief Unit tests for state_snapshot — CoverStateSnapshot and LightStateSnapshot.

#include <gtest/gtest.h>
#include "elero/state_snapshot.h"
#include "elero/elero_packet.h"

namespace elero = esphome::elero;
namespace sm = esphome::elero::cover_sm;
namespace lsm = esphome::elero::light_sm;
namespace pkt = esphome::elero::packet;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

static void make_cover_device(elero::Device &dev, float position = sm::POSITION_CLOSED,
                                        uint8_t last_state_raw = 0,
                                        float rssi = -50.0f) {
    dev.active = true;
    dev.config.type = elero::DeviceType::COVER;
    dev.config.open_duration_ms = 10000;
    dev.config.close_duration_ms = 10000;
    dev.config.ha_device_class = 0;  // shutter
    dev.logic = elero::CoverDevice{};
    auto &cover = std::get<elero::CoverDevice>(dev.logic);
    cover.state = sm::Idle{position};
    cover.position_known = true;
    cover.position_confirmed = true;
    dev.rf.last_state_raw = last_state_raw;
    dev.rf.last_rssi = rssi;
    dev.rf.last_seen_ms = 1000;
}

static void make_light_device(elero::Device &dev, bool on = false,
                                        float brightness = 0.0f,
                                        uint8_t last_state_raw = 0) {
    dev.active = true;
    dev.config.type = elero::DeviceType::LIGHT;
    dev.config.dim_duration_ms = 5000;
    dev.logic = elero::LightDevice{};
    auto &light = std::get<elero::LightDevice>(dev.logic);
    if (on) {
        light.state = lsm::On{brightness};
    } else {
        light.state = lsm::Off{};
    }
    dev.rf.last_state_raw = last_state_raw;
    dev.rf.last_rssi = -60.0f;
    dev.rf.last_seen_ms = 2000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVER SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════════

TEST(CoverSnapshot, IdleOpenPositionReportsOpen) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_OPEN, pkt::state::TOP);
    auto snap = elero::compute_cover_snapshot(dev, 5000);

    EXPECT_FLOAT_EQ(snap.position, sm::POSITION_OPEN);
    EXPECT_STREQ(snap.ha_state, "open");
    EXPECT_EQ(snap.operation, sm::Operation::IDLE);
}

TEST(CoverSnapshot, IdleClosedPositionReportsClosed) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_CLOSED, pkt::state::BOTTOM);
    auto snap = elero::compute_cover_snapshot(dev, 5000);

    EXPECT_FLOAT_EQ(snap.position, sm::POSITION_CLOSED);
    EXPECT_STREQ(snap.ha_state, "closed");
}

TEST(CoverSnapshot, IdleIntermediatePositionReportsOpen) {
    elero::Device dev;
    make_cover_device(dev, 0.5f, pkt::state::INTERMEDIATE);
    auto snap = elero::compute_cover_snapshot(dev, 5000);

    EXPECT_FLOAT_EQ(snap.position, 0.5f);
    EXPECT_STREQ(snap.ha_state, "open");
}

TEST(CoverSnapshot, OpeningReportsOpening) {
    elero::Device dev;
    make_cover_device(dev);
    auto &cover = std::get<elero::CoverDevice>(dev.logic);
    cover.state = sm::Opening{sm::POSITION_CLOSED, 1000};

    auto snap = elero::compute_cover_snapshot(dev, 6000);

    EXPECT_STREQ(snap.ha_state, "opening");
    EXPECT_EQ(snap.operation, sm::Operation::OPENING);
    EXPECT_FLOAT_EQ(snap.position, 0.5f);
}

TEST(CoverSnapshot, ClosingReportsClosing) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_OPEN);
    auto &cover = std::get<elero::CoverDevice>(dev.logic);
    cover.state = sm::Closing{sm::POSITION_OPEN, 1000};

    auto snap = elero::compute_cover_snapshot(dev, 6000);

    EXPECT_STREQ(snap.ha_state, "closing");
    EXPECT_EQ(snap.operation, sm::Operation::CLOSING);
    EXPECT_FLOAT_EQ(snap.position, 0.5f);
}

// Stopping with stale raw_state: user hit STOP before RF responded,
// so last_state_raw still says TOP/BOTTOM from before movement started.
// ha_state must be "open" (not "closed" from stale BOTTOM).
TEST(CoverSnapshot, StoppingWithStaleTopRawReportsOpen) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_OPEN, pkt::state::TOP);
    auto &cover = std::get<elero::CoverDevice>(dev.logic);
    cover.state = sm::Stopping{0.8f, 5000};

    auto snap = elero::compute_cover_snapshot(dev, 6000);
    EXPECT_STREQ(snap.ha_state, "open");
    EXPECT_EQ(snap.operation, sm::Operation::IDLE);
}

TEST(CoverSnapshot, StoppingWithStaleBottomRawReportsOpen) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_CLOSED, pkt::state::BOTTOM);
    auto &cover = std::get<elero::CoverDevice>(dev.logic);
    cover.state = sm::Stopping{0.2f, 5000};

    auto snap = elero::compute_cover_snapshot(dev, 6000);
    EXPECT_STREQ(snap.ha_state, "open");
}

TEST(CoverSnapshot, ProblemStateDetected) {
    elero::Device dev;
    make_cover_device(dev, 0.5f, pkt::state::BLOCKING);
    auto snap = elero::compute_cover_snapshot(dev, 5000);

    EXPECT_TRUE(snap.is_problem);
    EXPECT_STREQ(snap.problem_type, "blocking");
}

TEST(CoverSnapshot, OverheatedProblem) {
    elero::Device dev;
    make_cover_device(dev, 0.5f, pkt::state::OVERHEATED);
    auto snap = elero::compute_cover_snapshot(dev, 5000);

    EXPECT_TRUE(snap.is_problem);
    EXPECT_STREQ(snap.problem_type, "overheated");
}

TEST(CoverSnapshot, TimeoutProblem) {
    elero::Device dev;
    make_cover_device(dev, 0.5f, pkt::state::TIMEOUT);
    auto snap = elero::compute_cover_snapshot(dev, 5000);

    EXPECT_TRUE(snap.is_problem);
    EXPECT_STREQ(snap.problem_type, "timeout");
}

TEST(CoverSnapshot, NoProblemForNormalState) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_OPEN, pkt::state::TOP);
    auto snap = elero::compute_cover_snapshot(dev, 5000);

    EXPECT_FALSE(snap.is_problem);
    EXPECT_STREQ(snap.problem_type, elero::PROBLEM_TYPE_NONE);
}

TEST(CoverSnapshot, TiltedFlag) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_OPEN, pkt::state::TOP_TILT);
    auto &cover = std::get<elero::CoverDevice>(dev.logic);
    cover.tilted = true;

    auto snap = elero::compute_cover_snapshot(dev, 5000);
    EXPECT_TRUE(snap.tilted);
}

TEST(CoverSnapshot, DeviceClassDefault) {
    elero::Device dev;
    make_cover_device(dev);
    auto snap = elero::compute_cover_snapshot(dev, 5000);
    EXPECT_STREQ(snap.device_class, "shutter");
}

TEST(CoverSnapshot, DeviceClassBlind) {
    elero::Device dev;
    make_cover_device(dev);
    dev.config.ha_device_class = 1;  // blind
    auto snap = elero::compute_cover_snapshot(dev, 5000);
    EXPECT_STREQ(snap.device_class, "blind");
}

TEST(CoverSnapshot, StateStringFromRf) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_OPEN, pkt::state::TOP);
    auto snap = elero::compute_cover_snapshot(dev, 5000);
    EXPECT_STREQ(snap.state_string, "top");
}

TEST(CoverSnapshot, RssiPassthrough) {
    elero::Device dev;
    make_cover_device(dev, sm::POSITION_CLOSED, 0, -75.5f);
    auto snap = elero::compute_cover_snapshot(dev, 5000);
    EXPECT_FLOAT_EQ(snap.rssi, -75.5f);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIGHT SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════════

TEST(LightSnapshot, OffState) {
    elero::Device dev;
    make_light_device(dev, false);
    auto snap = elero::compute_light_snapshot(dev, 5000);

    EXPECT_FALSE(snap.is_on);
    EXPECT_FLOAT_EQ(snap.brightness, 0.0f);
}

TEST(LightSnapshot, OnState) {
    elero::Device dev;
    make_light_device(dev, true, 0.75f);
    auto snap = elero::compute_light_snapshot(dev, 5000);

    EXPECT_TRUE(snap.is_on);
    EXPECT_FLOAT_EQ(snap.brightness, 0.75f);
}

TEST(LightSnapshot, ProblemDetected) {
    elero::Device dev;
    make_light_device(dev, true, 1.0f, pkt::state::OVERHEATED);
    auto snap = elero::compute_light_snapshot(dev, 5000);

    EXPECT_TRUE(snap.is_problem);
    EXPECT_STREQ(snap.problem_type, "overheated");
}

TEST(LightSnapshot, NoProblem) {
    elero::Device dev;
    make_light_device(dev, true, 1.0f, pkt::state::LIGHT_ON);
    auto snap = elero::compute_light_snapshot(dev, 5000);

    EXPECT_FALSE(snap.is_problem);
    EXPECT_STREQ(snap.problem_type, elero::PROBLEM_TYPE_NONE);
}

TEST(LightSnapshot, RssiPassthrough) {
    elero::Device dev;
    make_light_device(dev);
    auto snap = elero::compute_light_snapshot(dev, 5000);
    EXPECT_FLOAT_EQ(snap.rssi, -60.0f);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// FSM IDLE + RF state byte → HA state
TEST(HaCoverState, IdleTopIsOpen) {
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::IDLE, pkt::state::TOP), "open");
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::IDLE, pkt::state::TOP_TILT), "open");
}

TEST(HaCoverState, IdleBottomIsClosed) {
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::IDLE, pkt::state::BOTTOM), "closed");
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::IDLE, pkt::state::BOTTOM_TILT), "closed");
}

TEST(HaCoverState, IdleNonEndpointIsOpen) {
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::IDLE, pkt::state::STOPPED), "open");
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::IDLE, pkt::state::INTERMEDIATE), "open");
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::IDLE, pkt::state::UNKNOWN), "open");
}

// FSM OPENING/CLOSING → HA state (optimistic, regardless of raw state)
TEST(HaCoverState, FsmOpeningIsOpening) {
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::OPENING, pkt::state::STOPPED), "opening");
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::OPENING, pkt::state::MOVING_UP), "opening");
}

TEST(HaCoverState, FsmClosingIsClosing) {
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::CLOSING, pkt::state::STOPPED), "closing");
    EXPECT_STREQ(elero::ha_cover_state_str(sm::Operation::CLOSING, pkt::state::MOVING_DOWN), "closing");
}

TEST(ProblemState, BlockingIsProblem) {
    EXPECT_TRUE(elero::is_problem_state(pkt::state::BLOCKING));
}

TEST(ProblemState, OverheatedIsProblem) {
    EXPECT_TRUE(elero::is_problem_state(pkt::state::OVERHEATED));
}

TEST(ProblemState, TimeoutIsProblem) {
    EXPECT_TRUE(elero::is_problem_state(pkt::state::TIMEOUT));
}

TEST(ProblemState, TopIsNotProblem) {
    EXPECT_FALSE(elero::is_problem_state(pkt::state::TOP));
}

TEST(ProblemState, MovingUpIsNotProblem) {
    EXPECT_FALSE(elero::is_problem_state(pkt::state::MOVING_UP));
}
