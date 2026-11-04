#pragma once

#include <cstdint>

namespace brokenarrow
{

//==============================================================================
// Tiny seeded random generator for the audio thread (xorshift32).
// No allocation, no locks, no system entropy: the same seed always gives the
// same sequence, which keeps offline renders and tests repeatable.
class FastRandom
{
public:
    explicit FastRandom (std::uint32_t seed = 0x9e3779b9u) noexcept { setSeed (seed); }

    void setSeed (std::uint32_t seed) noexcept { state = (seed != 0) ? seed : 0x9e3779b9u; }

    std::uint32_t nextUInt() noexcept
    {
        auto x = state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        state = x;
        return x;
    }

    // Uniform in [0, 1).
    float nextFloat() noexcept { return static_cast<float> (nextUInt() >> 8) * (1.0f / 16777216.0f); }

    // Uniform in [-1, 1).
    float nextBipolar() noexcept { return nextFloat() * 2.0f - 1.0f; }

private:
    std::uint32_t state = 0x9e3779b9u;
};

} // namespace brokenarrow
