#pragma once

#include <juce_audio_basics/juce_audio_basics.h>

#include "GrainDelay.h"
#include "GrainEngine.h"
#include "RecordBuffer.h"

#include <array>

namespace brokenarrow
{

//==============================================================================
// The granular delay core (spec steps 2 to 5):
//
//   dry (post input gain) --+--> record buffer (8 s, always recording) <--+
//                           |          |                                  |
//                           |     grain engine --> wet                    |
//                           |          |                                  |
//                           |     grain delay (delay, HP, LP, soft clip)  |
//                           |          +---------- x feedback ------------+
//                           |
//                           +--> granulator dry/wet (dry vs wet) --> out
//
// WET PATH CHOICE: the wet signal is the granulator output only. The grain
// delay's output is not mixed in directly; it is only heard after it has been
// recorded back into the buffer and picked up again by new grains. So you
// hear grains, then delayed repeats of them that are themselves re-granulated
// on every pass (Feedback 0 = plain grains, no echoes). This keeps each repeat
// from being heard twice (once dry-echoed, once re-granulated) and matches
// the Feedback HP / LP names: they shape the repeats only.
class GranularSection
{
public:
    struct Parameters
    {
        GrainEngine::Settings grains;
        float delayMs    = 375.0f;
        float feedback   = 0.3f;     // 0 .. 0.95
        float highPassHz = 80.0f;
        float lowPassHz  = 8000.0f;
        float mix        = 0.5f;     // 0 = dry .. 1 = wet
    };

    static constexpr double recordBufferSeconds = 8.0;

    // Allocates everything (message thread). Starts smoothers at `initial`.
    void prepare (double sampleRate, const Parameters& initial);

    // Clears all audio history and stops all grains. No allocation.
    void reset();

    // Audio thread, once per host block.
    void setParameters (const Parameters& p) noexcept;

    // In place: left/right hold the dry signal on entry and the granulator
    // dry/wet mix on return. Any block size.
    void process (float* left, float* right, int numSamples) noexcept;

    int getNumActiveGrains() const noexcept { return engine.getNumActiveGrains(); }

private:
    static constexpr int blockSize = GrainEngine::maxBlockSize;

    RecordBuffer record;
    GrainEngine  engine;
    GrainDelay   delay;

    juce::SmoothedValue<float> feedbackSmoothed, mixSmoothed;

    std::array<float, blockSize> wetL {}, wetR {}, sendL {}, sendR {}, loopSafety {}, fbL {}, fbR {};

    bool prepared = false;
};

} // namespace brokenarrow
