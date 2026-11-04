#include "GrainDelay.h"
#include "SoftClipper.h"

#include <cmath>

namespace brokenarrow
{

void GrainDelay::prepare (double newSampleRate)
{
    sampleRate = newSampleRate;

    const auto size = juce::nextPowerOfTwo (static_cast<int> (std::ceil (maxDelaySeconds * sampleRate)) + 64);
    lineL.assign (static_cast<size_t> (size), 0.0f);
    lineR.assign (static_cast<size_t> (size), 0.0f);
    mask = size - 1;

    crossfadeLen = juce::jmax (1, static_cast<int> (crossfadeSeconds * sampleRate));
    maxCutoffHz  = static_cast<float> (0.45 * sampleRate);

    juce::dsp::ProcessSpec spec { sampleRate, static_cast<juce::uint32> (64), 2 };

    highPass.prepare (spec);
    highPass.setType (juce::dsp::StateVariableTPTFilterType::highpass);
    highPass.setResonance (juce::MathConstants<float>::sqrt2 * 0.5f); // Butterworth Q

    lowPass.prepare (spec);
    lowPass.setType (juce::dsp::StateVariableTPTFilterType::lowpass);
    lowPass.setResonance (juce::MathConstants<float>::sqrt2 * 0.5f);

    highPassHz.reset (sampleRate, 0.05);
    lowPassHz.reset (sampleRate, 0.05);

    reset();
}

void GrainDelay::reset()
{
    std::fill (lineL.begin(), lineL.end(), 0.0f);
    std::fill (lineR.begin(), lineR.end(), 0.0f);
    writePos = 0;

    currentDelay = nextDelay = targetDelay;
    crossfadePos = 0;
    crossfading  = false;

    highPassHz.setCurrentAndTargetValue (highPassHz.getTargetValue());
    lowPassHz.setCurrentAndTargetValue (lowPassHz.getTargetValue());
    highPass.setCutoffFrequency (juce::jlimit (20.0f, maxCutoffHz, highPassHz.getCurrentValue()));
    lowPass.setCutoffFrequency (juce::jlimit (20.0f, maxCutoffHz, lowPassHz.getCurrentValue()));
    highPass.reset();
    lowPass.reset();
}

int GrainDelay::msToSamples (float ms) const noexcept
{
    const auto maxSamples = mask > 0 ? mask - 4 : 1;
    return juce::jlimit (1, juce::jmax (1, maxSamples), static_cast<int> (std::lround (static_cast<double> (ms) * 0.001 * sampleRate)));
}

void GrainDelay::setParameters (float delayMs, float highPassFreq, float lowPassFreq) noexcept
{
    targetDelay = msToSamples (delayMs);
    highPassHz.setTargetValue (juce::jlimit (20.0f, maxCutoffHz, highPassFreq));
    lowPassHz.setTargetValue (juce::jlimit (20.0f, maxCutoffHz, lowPassFreq));
}

float GrainDelay::read (const std::vector<float>& line, int delaySamples) const noexcept
{
    return line[static_cast<size_t> ((writePos - delaySamples) & mask)];
}

void GrainDelay::updateFilterCutoffs (int numSamples) noexcept
{
    // Cutoffs glide per sample in the smoother; the filter coefficients are
    // refreshed once per (small) block, which is smooth enough to be inaudible.
    if (highPassHz.isSmoothing())
        highPass.setCutoffFrequency (highPassHz.skip (numSamples));

    if (lowPassHz.isSmoothing())
        lowPass.setCutoffFrequency (lowPassHz.skip (numSamples));
}

void GrainDelay::process (const float* inL, const float* inR, float* outL, float* outR, int numSamples) noexcept
{
    if (mask == 0)
    {
        std::fill (outL, outL + numSamples, 0.0f);
        std::fill (outR, outR + numSamples, 0.0f);
        return;
    }

    updateFilterCutoffs (numSamples);

    for (int i = 0; i < numSamples; ++i)
    {
        // Start a new crossfade whenever the time knob has moved and the
        // previous crossfade has finished.
        if (! crossfading && targetDelay != currentDelay)
        {
            nextDelay    = targetDelay;
            crossfadePos = 0;
            crossfading  = true;
        }

        // Delay (read before write, so the delay is exactly N samples).
        auto yL = read (lineL, currentDelay);
        auto yR = read (lineR, currentDelay);

        if (crossfading)
        {
            const auto t  = static_cast<float> (crossfadePos) / static_cast<float> (crossfadeLen);
            const auto gB = 0.5f - 0.5f * std::cos (juce::MathConstants<float>::pi * t);
            const auto gA = 1.0f - gB;

            yL = gA * yL + gB * read (lineL, nextDelay);
            yR = gA * yR + gB * read (lineR, nextDelay);

            if (++crossfadePos >= crossfadeLen)
            {
                currentDelay = nextDelay;
                crossfading  = false;
            }
        }

        lineL[static_cast<size_t> (writePos)] = inL[i];
        lineR[static_cast<size_t> (writePos)] = inR[i];
        writePos = (writePos + 1) & mask;

        // Feedback HP then LP.
        yL = lowPass.processSample (0, highPass.processSample (0, yL));
        yR = lowPass.processSample (1, highPass.processSample (1, yR));

        // SOFT CLIPPER - MANDATORY, NEVER REMOVE, KEEP IT LAST. It bounds the
        // feedback loop so even 95 % feedback with huge, dense grains cannot
        // run away.
        outL[i] = SoftClipper::process (yL);
        outR[i] = SoftClipper::process (yR);
    }
}

} // namespace brokenarrow
