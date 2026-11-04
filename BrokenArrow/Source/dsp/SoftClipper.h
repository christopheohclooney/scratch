#pragma once

#include <cmath>

namespace brokenarrow
{

//==============================================================================
// Soft clipper for the grain delay feedback loop.
//
// Fully transparent (y = x) below `threshold`, so normal-level repeats pass
// untouched. Above it, a tanh knee bends the signal smoothly towards `ceiling`
// and can never exceed it. The knee starts with slope 1, so there is no kink.
//
// THIS CLIPPER IS WHAT KEEPS THE FEEDBACK LOOP BOUNDED AT HIGH FEEDBACK.
// IT MUST NEVER BE REMOVED OR BYPASSED.
struct SoftClipper
{
    static constexpr float threshold = 0.7f; // about -3 dBFS
    static constexpr float ceiling   = 1.0f;

    static float process (float x) noexcept
    {
        const auto ax = std::abs (x);

        if (ax <= threshold)
            return x;

        constexpr auto range = ceiling - threshold;
        const auto shaped = threshold + range * std::tanh ((ax - threshold) / range);
        return x < 0.0f ? -shaped : shaped;
    }
};

} // namespace brokenarrow
