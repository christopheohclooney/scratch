#pragma once

#include <juce_audio_basics/juce_audio_basics.h>

#include <cmath>

namespace brokenarrow
{

//==============================================================================
// Stereo-linked safety peak limiter. Always on, no bypass.
//
// Exactly unity gain below the threshold, so it is transparent at normal
// levels. (juce::dsp::Limiter, used in Stage 0, is not: it adds about +4 dB of
// fixed make-up gain and compresses everything above -10 dBFS at 4:1.)
// Attack is instant: on any sample that would exceed the threshold the gain
// drops so that sample lands exactly on it. The gain then recovers towards
// unity with an exponential release. There is no look-ahead, so it adds no
// latency. A hard clip at +/-1.0 still follows it in the processor.
class SafetyLimiter
{
public:
    void prepare (double sampleRate, float thresholdDb, float releaseMs) noexcept
    {
        threshold   = juce::Decibels::decibelsToGain (thresholdDb);
        releaseCoef = static_cast<float> (std::exp (-1.0 / (0.001 * static_cast<double> (releaseMs) * sampleRate)));
        reset();
    }

    void reset() noexcept { gain = 1.0f; }

    void process (float* left, float* right, int numSamples) noexcept
    {
        for (int i = 0; i < numSamples; ++i)
        {
            const auto peak   = juce::jmax (std::abs (left[i]), std::abs (right[i]));
            const auto needed = peak > threshold ? threshold / peak : 1.0f;

            if (needed < gain)
                gain = needed;                                  // instant attack
            else
                gain = needed + (gain - needed) * releaseCoef;  // smooth release

            left[i]  *= gain;
            right[i] *= gain;
        }
    }

private:
    float threshold   = 1.0f;
    float releaseCoef = 0.999f;
    float gain        = 1.0f;
};

} // namespace brokenarrow
