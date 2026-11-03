#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_dsp/juce_dsp.h>

#include <atomic>

//==============================================================================
// Broken Arrow - Stage 0.
// A stereo effect with input gain, output gain and an always-on safety limiter.
class BrokenArrowAudioProcessor : public juce::AudioProcessor
{
public:
    BrokenArrowAudioProcessor();
    ~BrokenArrowAudioProcessor() override = default;

    //==============================================================================
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

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
    double getTailLengthSeconds() const override { return 0.0; }

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
    // Parameter IDs. These are permanent: saved DAW sessions depend on them.
    static constexpr const char* inputGainId  = "inputGain";
    static constexpr const char* outputGainId = "outputGain";

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    juce::AudioProcessorValueTreeState apvts;

private:
    //==============================================================================
    // Raw parameter values (in dB), cached once so processBlock never looks them up.
    std::atomic<float>* inputGainParam  = nullptr;
    std::atomic<float>* outputGainParam = nullptr;

    // Gains are smoothed in linear terms so knob moves do not click.
    using GainSmoother = juce::SmoothedValue<float, juce::ValueSmoothingTypes::Multiplicative>;
    GainSmoother inputGainSmoothed;
    GainSmoother outputGainSmoothed;

    static constexpr double gainRampSeconds = 0.05; // 50 ms

    // Safety limiter at the end of the chain. Always on, no bypass.
    juce::dsp::Limiter<float> safetyLimiter;

    static constexpr float limiterThresholdDb = -0.3f;
    static constexpr float limiterReleaseMs   = 50.0f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BrokenArrowAudioProcessor)
};
