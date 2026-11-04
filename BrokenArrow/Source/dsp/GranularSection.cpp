#include "GranularSection.h"

#include <cmath>

namespace brokenarrow
{

void GranularSection::prepare (double sampleRate, const Parameters& initial)
{
    record.prepare (sampleRate, recordBufferSeconds);
    engine.prepare (sampleRate);
    delay.prepare (sampleRate);

    feedbackSmoothed.reset (sampleRate, 0.05);
    mixSmoothed.reset (sampleRate, 0.05);

    prepared = true;

    setParameters (initial);
    reset();
}

void GranularSection::reset()
{
    record.clear();
    engine.reset();
    delay.reset();

    feedbackSmoothed.setCurrentAndTargetValue (feedbackSmoothed.getTargetValue());
    mixSmoothed.setCurrentAndTargetValue (mixSmoothed.getTargetValue());
}

void GranularSection::setParameters (const Parameters& p) noexcept
{
    engine.setSettings (p.grains);
    delay.setParameters (p.delayMs, p.highPassHz, p.lowPassHz);

    feedbackSmoothed.setTargetValue (juce::jlimit (0.0f, 0.95f, p.feedback));
    mixSmoothed.setTargetValue (juce::jlimit (0.0f, 1.0f, p.mix));
}

void GranularSection::process (float* left, float* right, int numSamples) noexcept
{
    if (! prepared)
        return;

    // Work in small blocks. The grain engine reads only audio recorded before
    // the current small block, and the block is recorded after the grains
    // (and the feedback they produce) have been computed. That is what makes
    // the record -> grains -> delay -> record loop work for any host block size.
    for (int start = 0; start < numSamples; start += blockSize)
    {
        const auto n = juce::jmin (blockSize, numSamples - start);
        auto* dryL = left + start;
        auto* dryR = right + start;

        std::fill (wetL.begin(), wetL.begin() + n, 0.0f);
        std::fill (wetR.begin(), wetR.begin() + n, 0.0f);

        engine.render (record, wetL.data(), wetR.data(), loopSafety.data(), n);

        // The grains go into the grain delay scaled by the loop-safety gain
        // (see GrainEngine::render), so the loop can never ring on forever.
        for (size_t i = 0; i < static_cast<size_t> (n); ++i)
        {
            sendL[i] = wetL[i] * loopSafety[i];
            sendR[i] = wetR[i] * loopSafety[i];
        }

        delay.process (sendL.data(), sendR.data(), fbL.data(), fbR.data(), n);

        for (int i = 0; i < n; ++i)
        {
            // Record: input plus feedback from the grain delay.
            const auto fb = feedbackSmoothed.getNextValue();
            record.write (dryL[i] + fb * fbL[static_cast<size_t> (i)],
                          dryR[i] + fb * fbR[static_cast<size_t> (i)]);

            // Granulator dry/wet, equal-power so the middle doesn't dip.
            const auto angle   = mixSmoothed.getNextValue() * juce::MathConstants<float>::halfPi;
            const auto dryGain = std::cos (angle);
            const auto wetGain = std::sin (angle);

            dryL[i] = dryGain * dryL[i] + wetGain * wetL[static_cast<size_t> (i)];
            dryR[i] = dryGain * dryR[i] + wetGain * wetR[static_cast<size_t> (i)];
        }
    }
}

} // namespace brokenarrow
