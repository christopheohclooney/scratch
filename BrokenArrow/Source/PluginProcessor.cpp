#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
BrokenArrowAudioProcessor::BrokenArrowAudioProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "Parameters", createParameterLayout())
{
    // Cache the raw parameter pointers once, so the audio thread can read them cheaply.
    inputGainParam  = apvts.getRawParameterValue (inputGainId);
    outputGainParam = apvts.getRawParameterValue (outputGainId);

    jassert (inputGainParam != nullptr && outputGainParam != nullptr);
}

//==============================================================================
juce::AudioProcessorValueTreeState::ParameterLayout BrokenArrowAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    // -24 dB to +12 dB in 0.1 dB steps.
    const juce::NormalisableRange<float> gainRange (-24.0f, 12.0f, 0.1f);

    const auto gainAttributes = juce::AudioParameterFloatAttributes().withLabel ("dB");

    layout.add (std::make_unique<juce::AudioParameterFloat> (juce::ParameterID { inputGainId, 1 },
                                                             "Input Gain",
                                                             gainRange,
                                                             0.0f,
                                                             gainAttributes));

    layout.add (std::make_unique<juce::AudioParameterFloat> (juce::ParameterID { outputGainId, 1 },
                                                             "Output Gain",
                                                             gainRange,
                                                             0.0f,
                                                             gainAttributes));

    return layout;
}

//==============================================================================
void BrokenArrowAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    // Set up the gain smoothers and jump straight to the current values,
    // so there is no fade-in when the plugin loads.
    inputGainSmoothed.reset (sampleRate, gainRampSeconds);
    outputGainSmoothed.reset (sampleRate, gainRampSeconds);

    inputGainSmoothed.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (inputGainParam->load()));
    outputGainSmoothed.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (outputGainParam->load()));

    // Prepare the safety limiter for stereo processing.
    juce::dsp::ProcessSpec spec;
    spec.sampleRate       = sampleRate;
    spec.maximumBlockSize = static_cast<juce::uint32> (juce::jmax (1, samplesPerBlock));
    spec.numChannels      = 2;

    safetyLimiter.prepare (spec);
    safetyLimiter.setThreshold (limiterThresholdDb);
    safetyLimiter.setRelease (limiterReleaseMs);
    safetyLimiter.reset();
}

void BrokenArrowAudioProcessor::releaseResources()
{
    safetyLimiter.reset();
}

//==============================================================================
bool BrokenArrowAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    // Stereo in, stereo out only.
    return layouts.getMainInputChannelSet()  == juce::AudioChannelSet::stereo()
        && layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

//==============================================================================
void BrokenArrowAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused (midiMessages);
    juce::ScopedNoDenormals noDenormals;

    const auto totalNumInputChannels  = getTotalNumInputChannels();
    const auto totalNumOutputChannels = getTotalNumOutputChannels();
    const auto numSamples             = buffer.getNumSamples();

    // Silence any output channels that have no matching input.
    for (auto ch = totalNumInputChannels; ch < totalNumOutputChannels; ++ch)
        buffer.clear (ch, 0, numSamples);

    if (numSamples == 0)
        return;

    // We only ever process up to two channels (the limiter is prepared for two).
    const auto numChannels = juce::jmin (buffer.getNumChannels(), 2);

    // Pick up the latest parameter values as smoothing targets.
    inputGainSmoothed.setTargetValue (juce::Decibels::decibelsToGain (inputGainParam->load()));
    outputGainSmoothed.setTargetValue (juce::Decibels::decibelsToGain (outputGainParam->load()));

    // Gain stage: input gain, then output gain. Both channels share the same
    // smoothed value on each sample so the stereo image stays intact.
    auto* const* channelData = buffer.getArrayOfWritePointers();

    for (int i = 0; i < numSamples; ++i)
    {
        const auto inGain  = inputGainSmoothed.getNextValue();
        const auto outGain = outputGainSmoothed.getNextValue();

        for (int ch = 0; ch < numChannels; ++ch)
        {
            auto sample = channelData[ch][i];
            sample *= inGain;
            sample *= outGain;
            channelData[ch][i] = sample;
        }
    }

    // SAFETY LIMITER - THIS MUST NEVER BE REMOVED.
    // It is the last stage of processing and protects speakers and ears.
    // It is always on and deliberately has no bypass parameter.
    {
        juce::dsp::AudioBlock<float> block (buffer);
        auto limitedBlock = block.getSubsetChannelBlock (0, static_cast<size_t> (numChannels));
        juce::dsp::ProcessContextReplacing<float> context (limitedBlock);
        safetyLimiter.process (context);
    }

    // Last-resort guard: hard clip to +/-1.0, because juce::dsp::Limiter can
    // overshoot slightly on very fast transients.
    for (int ch = 0; ch < numChannels; ++ch)
    {
        auto* data = channelData[ch];

        for (int i = 0; i < numSamples; ++i)
            data[i] = juce::jlimit (-1.0f, 1.0f, data[i]);
    }
}

//==============================================================================
juce::AudioProcessorEditor* BrokenArrowAudioProcessor::createEditor()
{
    return new BrokenArrowAudioProcessorEditor (*this);
}

//==============================================================================
void BrokenArrowAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();

    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void BrokenArrowAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    // Only replace our state if the saved data really belongs to this plugin.
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

//==============================================================================
// This creates new instances of the plugin.
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new BrokenArrowAudioProcessor();
}
