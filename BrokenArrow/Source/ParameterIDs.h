#pragma once

//==============================================================================
// Parameter IDs. These are PERMANENT once committed: saved DAW sessions and
// automation depend on them. Never rename or reuse one; add new IDs instead.
namespace ParamIDs
{
    // Input and output (Stage 0)
    inline constexpr const char* inputGain  = "inputGain";
    inline constexpr const char* outputGain = "outputGain";

    // Granulator (Stage 1)
    inline constexpr const char* density = "density";
    inline constexpr const char* size    = "size";
    inline constexpr const char* count   = "count";
    inline constexpr const char* offset  = "offset";
    inline constexpr const char* pitch   = "pitch";
    inline constexpr const char* pan     = "pan";
    inline constexpr const char* shape   = "shape";
    inline constexpr const char* reverse = "reverse";

    // Grain delay (Stage 1)
    inline constexpr const char* delayTime  = "delayTime";
    inline constexpr const char* feedback   = "feedback";
    inline constexpr const char* feedbackHP = "feedbackHP";
    inline constexpr const char* feedbackLP = "feedbackLP";

    // Granulator dry/wet (Stage 1)
    inline constexpr const char* grainMix = "grainMix";
}
