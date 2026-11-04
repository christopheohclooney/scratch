#pragma once

#include <juce_audio_basics/juce_audio_basics.h>

#include "FastRandom.h"
#include "RecordBuffer.h"

#include <array>

namespace brokenarrow
{

//==============================================================================
// One grain voice. All fields are plain data so the pool is a fixed array that
// never allocates. Stage 2 randomisation only changes the values a grain is
// spawned with (see GrainSpawnParams), so this struct does not need to change.
struct Grain
{
    bool   active      = false;
    int    waitSamples = 0;     // silent countdown before the grain starts (Count spreading)
    int    age         = 0;     // samples played so far
    int    length      = 0;     // grain length in output samples

    double readPos   = 0.0;     // current read position in the record buffer, in [0, size)
    double increment = 1.0;     // read speed per output sample: +rate forwards, -rate reversed

    float  rampLength  = 1.0f;  // window taper length per side, in samples
    float  rampToTable = 0.0f;  // converts "samples into the taper" to a window-table index

    // 2x2 stereo pan matrix: outL = ll*inL + rl*inR, outR = lr*inL + rr*inR.
    float  ll = 1.0f, rl = 0.0f, lr = 0.0f, rr = 1.0f;

    float  amplitude = 1.0f;    // per-grain level (Stage 2 can randomise this)
};

//==============================================================================
// Everything one grain is spawned with, fully resolved. This is the hook for
// Stage 2: per-grain randomisation (size, pitch, pan) is applied when this is
// built in GrainEngine::makeSpawnParams(), before the grain is started.
struct GrainSpawnParams
{
    double lengthSamples = 0.0;
    double rate          = 1.0;   // pitch ratio = 2^(semitones / 12)
    float  pan           = 0.0f;  // -1 (left) .. +1 (right)
    float  shape         = 0.7f;  // 0 = hard edges .. 1 = full Hann
    bool   reverse       = false;
    double offsetSamples = 0.0;   // extra distance behind the record point
    int    waitSamples   = 0;     // start delay inside the trigger (Count spreading)
    float  amplitude     = 1.0f;
};

//==============================================================================
// Granulator: schedules grains, reads them from the record buffer with pitch
// (resampling + Hermite interpolation), windows, pans and sums them, and
// normalises the sum by the expected overlap.
//
// render() never reads samples that have not been written yet, so it must be
// called BEFORE the same block is written into the record buffer, with at most
// maxBlockSize samples at a time.
class GrainEngine
{
public:
    static constexpr int maxGrains    = 64;
    static constexpr int maxCount     = 8;
    static constexpr int maxBlockSize = 32;

    // Minimum distance (samples) between the write head and any sample a grain
    // reads: one render block, plus the Hermite look-ahead (+2), plus margin.
    static constexpr int safetyGapSamples = maxBlockSize + 8;

    // Shortest window taper per side at Shape 0: short enough to sound hard and
    // glitchy, long enough to stay click-free.
    static constexpr double minRampSeconds = 0.0015;

    // Per-block settings from the plugin parameters.
    struct Settings
    {
        float densityHz      = 8.0f;
        float sizeMs         = 120.0f;
        int   count          = 1;
        float offsetMs       = 0.0f;
        float pitchSemitones = 0.0f;
        float pan            = 0.0f;  // -1 .. +1
        float shape          = 0.7f;  // 0 .. 1
        bool  reverse        = false;
    };

    GrainEngine();

    void prepare (double sampleRate);
    void reset();

    // Audio thread, once per host block.
    void setSettings (const Settings& newSettings) noexcept;

    // Adds the grain output for numSamples (<= maxBlockSize) into outL/outR,
    // and writes a per-sample gain for the feedback send into loopSafety (see
    // the comment in render()).
    void render (const RecordBuffer& buffer, float* outL, float* outR, float* loopSafety, int numSamples) noexcept;

    int getNumActiveGrains() const noexcept;

private:
    void triggerCluster (const RecordBuffer& buffer, int sampleInBlock) noexcept;
    GrainSpawnParams makeSpawnParams (int memberIndex) noexcept;
    void spawnGrain (const RecordBuffer& buffer, int sampleInBlock, const GrainSpawnParams& p) noexcept;
    float computeNormalisationGain() const noexcept;
    float windowAt (const Grain& g) const noexcept;

    static constexpr int windowTableSize = 1024;
    std::array<float, windowTableSize + 2> rampTable {}; // raised-cosine rise, 0 -> 1

    std::array<Grain, maxGrains> grains {};
    std::array<float, maxBlockSize> windowSum {};

    Settings settings;
    double   sampleRate     = 44100.0;
    double   pitchRate      = 1.0;
    double   triggerPhase   = 1.0;  // 0..1; a grain cluster fires each time it wraps
    float    currentPan     = 0.0f;
    int      blockWritePos  = 0;    // record write position at the start of render()

    juce::SmoothedValue<float> panSmoothed;
    juce::SmoothedValue<float> normGainSmoothed;

    FastRandom random; // seeded; for Stage 2 per-grain randomisation

    JUCE_DECLARE_NON_COPYABLE (GrainEngine)
};

} // namespace brokenarrow
