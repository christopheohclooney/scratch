#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_dsp/juce_dsp.h>

#include <vector>

namespace brokenarrow
{

//==============================================================================
// The grain delay: the feedback path of the granulator.
//
//   granulator output -> delay -> high-pass -> low-pass -> soft clipper
//                     -> (x feedback, in GranularSection) -> record buffer
//
// The soft clipper is deliberately the LAST stage, so the feedback signal can
// never exceed its ceiling. The 2nd-order high-pass (never below 20 Hz) is
// always in the loop and doubles as the DC blocker: any DC the clipper makes
// is removed on the next pass, so DC can never build up.
//
// Delay time changes crossfade between two fixed read taps (about 80 ms)
// instead of sliding one tap, so moving the Time knob never warbles the pitch.
// Memory is allocated in prepare() only.
class GrainDelay
{
public:
    static constexpr double maxDelaySeconds = 2.0;
    static constexpr double crossfadeSeconds = 0.08;

    void prepare (double sampleRate);
    void reset();

    // Audio thread, once per host block.
    void setParameters (float delayMs, float highPassHz, float lowPassHz) noexcept;

    // Delays, filters and soft-clips numSamples of granulator output into
    // outL/outR (the feedback signal before the Feedback amount is applied).
    void process (const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept;

private:
    int msToSamples (float ms) const noexcept;
    float read (const std::vector<float>& line, int delaySamples) const noexcept;
    void updateFilterCutoffs (int numSamples) noexcept;

    double sampleRate = 44100.0;

    std::vector<float> lineL, lineR;
    int mask     = 0;
    int writePos = 0;

    // Two-tap crossfading delay.
    int  currentDelay   = 1;
    int  nextDelay      = 1;
    int  targetDelay    = 1;
    int  crossfadeLen   = 1;
    int  crossfadePos   = 0;
    bool crossfading    = false;

    juce::dsp::StateVariableTPTFilter<float> highPass, lowPass;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Multiplicative> highPassHz, lowPassHz;
    float maxCutoffHz = 20000.0f;
};

} // namespace brokenarrow
