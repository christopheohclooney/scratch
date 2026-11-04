#include "GrainEngine.h"

#include <cmath>

namespace brokenarrow
{

namespace
{
    // Count spreading. Each extra grain in a trigger starts a little later than
    // the one before (a quick "strum" of up to ~39 ms) and, because its start
    // point is fixed at trigger time, it plays the same moment of audio slightly
    // later. That turns Count into a thicker, flammed cluster rather than the
    // same grain stacked louder. The spacing is deliberately irregular so the
    // copies don't form an obvious comb filter. It is deterministic (no
    // randomness) so each member index forms a stable stream, which keeps the
    // level normalisation below accurate; Stage 2's random amounts add variety.
    constexpr std::array<double, GrainEngine::maxCount> clusterSpreadMs { 0.0, 4.7, 10.3, 15.1, 21.9, 26.3, 33.7, 38.9 };

    constexpr float halfPi = juce::MathConstants<float>::halfPi;
}

//==============================================================================
GrainEngine::GrainEngine()
{
    // Raised-cosine rise from 0 to 1. Both window tapers are read from this
    // table, so a Tukey window of any taper length costs one table lookup.
    for (int i = 0; i <= windowTableSize; ++i)
        rampTable[static_cast<size_t> (i)] = 0.5f - 0.5f * std::cos (juce::MathConstants<float>::pi
                                                                     * static_cast<float> (i) / static_cast<float> (windowTableSize));

    rampTable[windowTableSize + 1] = 1.0f; // guard for interpolation
}

void GrainEngine::prepare (double newSampleRate)
{
    sampleRate = newSampleRate;

    panSmoothed.reset (sampleRate, 0.05);
    normGainSmoothed.reset (sampleRate, 0.15);

    reset();
}

void GrainEngine::reset()
{
    for (auto& g : grains)
        g = Grain {};

    triggerPhase = 1.0; // fire the first cluster straight away
    random.setSeed (0x5eed1234u);

    panSmoothed.setCurrentAndTargetValue (settings.pan);
    currentPan = settings.pan;
    normGainSmoothed.setCurrentAndTargetValue (computeNormalisationGain());
}

//==============================================================================
void GrainEngine::setSettings (const Settings& s) noexcept
{
    settings       = s;
    settings.count = juce::jlimit (1, maxCount, s.count);
    settings.densityHz = juce::jmax (0.01f, s.densityHz);
    settings.sizeMs    = juce::jmax (1.0f, s.sizeMs);

    pitchRate = std::pow (2.0, static_cast<double> (settings.pitchSemitones) / 12.0);

    panSmoothed.setTargetValue (juce::jlimit (-1.0f, 1.0f, settings.pan));
    normGainSmoothed.setTargetValue (computeNormalisationGain());
}

//==============================================================================
// Level normalisation.
//
// More grains overlapping means more energy, so the sum is scaled down by the
// expected overlap. With N = density * size grains overlapping per Count
// "stream" (Count streams in total, capped by the 64 voices):
//
//  - Uncorrelated grains add in power: power ~ N * P, where P is the window's
//    mean power (Tukey: 1 - 5a/8 for taper fraction a; 3/8 for a full Hann).
//  - Grains that read the SAME audio add in amplitude: power ~ (N * M)^2, where
//    M is the window's mean (1 - a/2). This happens at pitch 0 going forwards:
//    every grain sits the same distance behind the record point, so overlapping
//    grains are exact copies and a 1/sqrt(N) rule would leave them far too loud
//    (and push more energy into the feedback loop).
//
// We blend the two by an estimated correlation rho, from how far apart in the
// source neighbouring grains read (|1 - rate| / density forwards, (1 + rate) /
// density reversed): rho = exp(-separation / 3 ms). The Count streams start at
// different points (see clusterSpreadMs) so they are treated as uncorrelated.
// The gain is 1 / sqrt(max(1, total power)): it only ever turns grains down,
// never boosts sparse grains above the input level. It is smoothed over 150 ms.
float GrainEngine::computeNormalisationGain() const noexcept
{
    const auto lenSamples = juce::jmax (1.0, static_cast<double> (settings.sizeMs) * 0.001 * sampleRate);
    const auto minRamp    = minRampSeconds * sampleRate;
    const auto ramp       = juce::jlimit (1.0, juce::jmax (1.0, lenSamples * 0.5),
                                          juce::jmax (minRamp, static_cast<double> (settings.shape) * lenSamples * 0.5));

    const auto taper     = juce::jlimit (0.0, 1.0, 2.0 * ramp / lenSamples);
    const auto meanWin   = 1.0 - 0.5 * taper;
    const auto meanPower = 1.0 - 0.625 * taper;

    const auto count  = static_cast<double> (settings.count);
    const auto perStream = juce::jmin (static_cast<double> (settings.densityHz) * lenSamples / sampleRate,
                                       static_cast<double> (maxGrains) / count);

    const auto speedDiff = settings.reverse ? (1.0 + pitchRate) : std::abs (1.0 - pitchRate);
    const auto separationSeconds = speedDiff / static_cast<double> (settings.densityHz);
    const auto rho = std::exp (-separationSeconds / 0.003);

    const auto incoherent   = perStream * meanPower;
    const auto coherent     = perStream * perStream * meanWin * meanWin;
    const auto streamPower  = incoherent + rho * juce::jmax (0.0, coherent - incoherent);
    const auto totalPower   = count * streamPower;

    return static_cast<float> (1.0 / std::sqrt (juce::jmax (1.0, totalPower)));
}

//==============================================================================
GrainSpawnParams GrainEngine::makeSpawnParams (int memberIndex) noexcept
{
    GrainSpawnParams p;
    p.lengthSamples = static_cast<double> (settings.sizeMs) * 0.001 * sampleRate;
    p.rate          = pitchRate;
    p.pan           = currentPan;
    p.shape         = settings.shape;
    p.reverse       = settings.reverse;
    p.offsetSamples = static_cast<double> (settings.offsetMs) * 0.001 * sampleRate;
    p.waitSamples   = static_cast<int> (std::lround (clusterSpreadMs[static_cast<size_t> (memberIndex)] * 0.001 * sampleRate));
    p.amplitude     = 1.0f;

    // Stage 2: apply Size / Pitch / Pan random amounts here using `random`
    // (and scale-quantise the pitch), before the grain is spawned.
    return p;
}

void GrainEngine::triggerCluster (const RecordBuffer& buffer, int sampleInBlock) noexcept
{
    for (int j = 0; j < settings.count; ++j)
        spawnGrain (buffer, sampleInBlock, makeSpawnParams (j));
}

//==============================================================================
// Voice policy: if all 64 voices are busy, the new grain is SKIPPED rather than
// stealing a playing one. Stealing would cut a grain off mid-window (a click)
// or need an extra fade-out voice; and since every grain in Stage 1 has the
// same length, the oldest grain is about to finish anyway. The level
// normalisation already caps its overlap estimate at 64 voices.
void GrainEngine::spawnGrain (const RecordBuffer& buffer, int sampleInBlock, const GrainSpawnParams& p) noexcept
{
    Grain* voice = nullptr;

    for (auto& g : grains)
    {
        if (! g.active)
        {
            voice = &g;
            break;
        }
    }

    if (voice == nullptr)
        return;

    const auto rate = juce::jlimit (1.0 / 16.0, 16.0, p.rate);
    const auto wait = static_cast<double> (juce::jmax (0, p.waitSamples));
    const auto base = static_cast<double> (safetyGapSamples) + juce::jmax (0.0, p.offsetSamples);

    // Read-start safety. "Distance" = how far behind the write head the read
    // point is. It must stay >= safetyGapSamples for the whole grain (never
    // read audio that hasn't been recorded yet) and below the buffer size
    // (never read audio that has already been overwritten).
    //  - Forwards, pitch up: the grain reads faster than we record, so the
    //    distance shrinks by (rate - 1) per sample. We start it len*(rate-1)
    //    further back, so it lands exactly on the safety gap at its end.
    //  - Forwards, pitch down: the distance grows by (1 - rate) per sample.
    //  - Reversed: the distance grows by (1 + rate) per sample.
    // While the grain waits (Count spreading) the distance also grows.
    const auto growth = p.reverse ? (1.0 + rate) : std::abs (rate - 1.0);
    auto lenSamples   = juce::jmax (1.0, std::round (p.lengthSamples));

    const auto maxDistance = static_cast<double> (buffer.getSize() - 2 * safetyGapSamples);

    if (growth > 0.0 && base + wait + lenSamples * growth > maxDistance)
        lenSamples = juce::jmax (1.0, std::floor ((maxDistance - base - wait) / growth));

    const auto startDistance = base + ((! p.reverse && rate > 1.0) ? lenSamples * (rate - 1.0) : 0.0);
    const auto virtualWritePos = static_cast<double> (blockWritePos + sampleInBlock);

    auto& g       = *voice;
    g.active      = true;
    g.waitSamples = sampleInBlock + static_cast<int> (wait);
    g.age         = 0;
    g.length      = static_cast<int> (lenSamples);
    g.readPos     = buffer.wrap (virtualWritePos - startDistance);
    g.increment   = p.reverse ? -rate : rate;

    // Tukey window: raised-cosine tapers of `ramp` samples each side, flat in
    // between. Shape 0 gives the minimum (1.5 ms) tapers, Shape 1 a full Hann.
    const auto halfLen = static_cast<float> (lenSamples) * 0.5f;
    const auto minRamp = static_cast<float> (minRampSeconds * sampleRate);
    g.rampLength  = juce::jlimit (1.0f, juce::jmax (1.0f, halfLen), juce::jmax (minRamp, juce::jlimit (0.0f, 1.0f, p.shape) * halfLen));
    g.rampToTable = static_cast<float> (windowTableSize) / g.rampLength;

    // Pan. At the centre the grain keeps its stereo image (identity matrix).
    // Panning one way folds the far channel into the near one with a sine
    // law, then scales by 1/sqrt(1 + s) so mono sources keep constant power.
    const auto panValue = juce::jlimit (-1.0f, 1.0f, p.pan);
    const auto angle    = std::abs (panValue) * halfPi;
    const auto s        = std::sin (angle);
    const auto c        = std::cos (angle);
    const auto comp     = 1.0f / std::sqrt (1.0f + s);

    if (panValue <= 0.0f)
    {
        g.ll = comp;     g.rl = s * comp;
        g.lr = 0.0f;     g.rr = c * comp;
    }
    else
    {
        g.ll = c * comp; g.rl = 0.0f;
        g.lr = s * comp; g.rr = comp;
    }

    g.amplitude = p.amplitude;
}

//==============================================================================
float GrainEngine::windowAt (const Grain& g) const noexcept
{
    const auto k = static_cast<float> (juce::jmin (g.age, g.length - 1 - g.age));

    if (k >= g.rampLength)
        return 1.0f;

    const auto x    = k * g.rampToTable;
    const auto idx  = static_cast<int> (x);
    const auto frac = x - static_cast<float> (idx);
    const auto a    = rampTable[static_cast<size_t> (idx)];
    const auto b    = rampTable[static_cast<size_t> (idx + 1)];
    return a + frac * (b - a);
}

void GrainEngine::render (const RecordBuffer& buffer, float* outL, float* outR, float* loopSafety, int numSamples) noexcept
{
    jassert (numSamples <= maxBlockSize);
    numSamples = juce::jmin (numSamples, maxBlockSize);

    blockWritePos = buffer.getWritePos();

    // Scheduler: a phase accumulator that wraps `density` times per second.
    // It runs per sample and persists between blocks, so triggers are sample
    // accurate whatever the host block size, and density changes take effect
    // immediately. Stage 2: density jitter would scale the increment per trigger.
    const auto phaseIncrement = static_cast<double> (settings.densityHz) / sampleRate;

    for (int i = 0; i < numSamples; ++i)
    {
        currentPan = panSmoothed.getNextValue();
        triggerPhase += phaseIncrement;

        if (triggerPhase >= 1.0)
        {
            triggerPhase -= std::floor (triggerPhase);
            triggerCluster (buffer, i);
        }
    }

    // Render every active grain into the block.
    const auto bufferSize = static_cast<double> (buffer.getSize());
    std::fill (windowSum.begin(), windowSum.begin() + numSamples, 0.0f);

    for (auto& g : grains)
    {
        if (! g.active)
            continue;

        int i = 0;

        if (g.waitSamples > 0)
        {
            if (g.waitSamples >= numSamples)
            {
                g.waitSamples -= numSamples;
                continue;
            }

            i = g.waitSamples;
            g.waitSamples = 0;
        }

        const auto end = juce::jmin (numSamples, i + (g.length - g.age));

        for (; i < end; ++i)
        {
            const auto w = windowAt (g) * g.amplitude;

            float sL, sR;
            buffer.readHermite (g.readPos, sL, sR);

            outL[i] += w * (g.ll * sL + g.rl * sR);
            outR[i] += w * (g.lr * sL + g.rr * sR);
            windowSum[static_cast<size_t> (i)] += w;

            g.readPos += g.increment;

            if (g.readPos >= bufferSize)
                g.readPos -= bufferSize;
            else if (g.readPos < 0.0)
                g.readPos += bufferSize;

            ++g.age;
        }

        if (g.age >= g.length)
            g.active = false;
    }

    // Overlap normalisation (smoothed), and the feedback-loop safety gain.
    //
    // The normalisation sets the TYPICAL loudness of overlapping grains, which
    // add up roughly in power. But at some frequencies overlapping grains line
    // up in phase and add in amplitude instead: reversed grains at pitch 0,
    // octave-up grains, and Count's copies all form comb-like patterns. There
    // the grains' gain is normGain * (sum of all window values), which can be
    // well above 1, and inside the feedback loop that makes those frequencies
    // ring forever (held up only by the soft clipper).
    //
    // So the copy of the grains sent into the grain delay is scaled per sample
    // by 1 / max(1, normGain * windowSum). Then the grain engine can never
    // amplify what goes round the loop, and with Feedback <= 95 % and filters
    // that never boost, every repeat is quieter than the last. The heard wet
    // signal is unchanged. Sparse grains and dense pitch-0 forward grains
    // (which are already normalised as exact copies) get a factor of ~1.
    for (int i = 0; i < numSamples; ++i)
    {
        const auto gain = normGainSmoothed.getNextValue();
        outL[i] *= gain;
        outR[i] *= gain;
        loopSafety[i] = 1.0f / juce::jmax (1.0f, gain * windowSum[static_cast<size_t> (i)]);
    }
}

int GrainEngine::getNumActiveGrains() const noexcept
{
    int n = 0;

    for (const auto& g : grains)
        if (g.active)
            ++n;

    return n;
}

} // namespace brokenarrow
