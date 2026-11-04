#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_dsp/juce_dsp.h>

#include "ParameterIDs.h"
#include "dsp/GranularSection.h"
#include "dsp/SafetyLimiter.h"

#include <atomic>

//==============================================================================
// Broken Arrow - Stage 1.
// A stereo-out effect (mono or stereo in):
//   input gain -> granular section (record buffer, grains, grain delay
//   feedback, granulator dry/wet) -> [Stage 5 FX + master] -> output gain
//   -> safety limiter -> hard clip.
class BrokenArrowAudioProcessor : public juce::AudioProcessor
{
public:
    BrokenArrowAudioProcessor();
    ~BrokenArrowAudioProcessor() override = default;

    //==============================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void reset() override;

    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;

    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock; // keep the double-precision overload visible

    //==============================================================================
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    //==============================================================================
    const juce::String getName() const override { return JucePlugin_Name; }

    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }

    // Repeats keep sounding after the input stops (feedback loop + grains read
    // up to several seconds behind), so tell the host to keep processing.
    double getTailLengthSeconds() const override;

    //==============================================================================
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int index) override { juce::ignoreUnused (index); }
    const juce::String getProgramName (int index) override { juce::ignoreUnused (index); return {}; }
    void changeProgramName (int index, const juce::String& newName) override { juce::ignoreUnused (index, newName); }

    //==============================================================================
    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    //==============================================================================
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    juce::AudioProcessorValueTreeState apvts;

    static constexpr double minTailSeconds = 2.0;
    static constexpr double maxTailSeconds = 30.0;

    // Number of grains currently playing (updated once per block). Safe to
    // read from any thread; for tests now, and the grain visual in Stage 6.
    int getNumActiveGrains() const noexcept { return activeGrainCount.load (std::memory_order_relaxed); }

private:
    //==============================================================================
    brokenarrow::GranularSection::Parameters readParameters() const noexcept;

    // Raw parameter values, cached once so processBlock never looks them up.
    std::atomic<float>* inputGainParam  = nullptr;
    std::atomic<float>* outputGainParam = nullptr;

    std::atomic<float>* densityParam    = nullptr;
    std::atomic<float>* sizeParam       = nullptr;
    std::atomic<float>* countParam      = nullptr;
    std::atomic<float>* offsetParam     = nullptr;
    std::atomic<float>* pitchParam      = nullptr;
    std::atomic<float>* panParam        = nullptr;
    std::atomic<float>* shapeParam      = nullptr;
    std::atomic<float>* reverseParam    = nullptr;
    std::atomic<float>* delayTimeParam  = nullptr;
    std::atomic<float>* feedbackParam   = nullptr;
    std::atomic<float>* feedbackHPParam = nullptr;
    std::atomic<float>* feedbackLPParam = nullptr;
    std::atomic<float>* grainMixParam   = nullptr;

    // Gains are smoothed in linear terms so knob moves do not click.
    using GainSmoother = juce::SmoothedValue<float, juce::ValueSmoothingTypes::Multiplicative>;
    GainSmoother inputGainSmoothed;
    GainSmoother outputGainSmoothed;

    static constexpr double gainRampSeconds = 0.05; // 50 ms

    // Buffer, grain engine, grain delay and granulator dry/wet.
    brokenarrow::GranularSection granular;
    std::atomic<int> activeGrainCount { 0 };

    // Safety limiter at the end of the chain. Always on, no bypass.
    brokenarrow::SafetyLimiter safetyLimiter;

    static constexpr float limiterThresholdDb = -0.3f;
    static constexpr float limiterReleaseMs   = 50.0f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BrokenArrowAudioProcessor)
};
