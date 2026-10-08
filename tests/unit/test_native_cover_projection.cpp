#include <gtest/gtest.h>
#include <cmath>
#include "elero/native_cover_projection.h"
using namespace esphome::elero;

TEST(NativeCoverProjection, UnknownHeightIsFiniteWithoutClaimingEndpoint) {
  const float wire = native_cover_position(false, -1);
  EXPECT_TRUE(std::isfinite(wire));
  EXPECT_FLOAT_EQ(wire, 0.5f);
  EXPECT_EQ(std::lround(wire * 100), 50);
}
TEST(NativeCoverProjection, ValidHeightsKeepTheirValue) {
  for (int percent = 0; percent <= 100; ++percent) {
    EXPECT_EQ(std::lround(native_cover_position(true, percent) * 100), percent);
  }
}
TEST(NativeCoverProjection, InvalidCacheCannotReachNativeApiAsNonFiniteOrOutOfRange) {
  EXPECT_FLOAT_EQ(native_cover_position(true, -1), 0.5f);
  EXPECT_FLOAT_EQ(native_cover_position(true, 101), 0.5f);
}
TEST(NativeCoverProjection, RaffstoreStepsNeverAdvertiseAbsoluteTilt) {
  EXPECT_FALSE(native_cover_has_tilt(true, 1));
  EXPECT_FALSE(native_cover_has_tilt(false, 1));
  EXPECT_FALSE(native_cover_has_tilt(false, 0));
  EXPECT_TRUE(native_cover_has_tilt(true, 0));
}
