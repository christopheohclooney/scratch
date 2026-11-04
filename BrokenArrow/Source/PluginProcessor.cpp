#include "PluginProcessor.h"
#include "PluginEditor.h"

#include <cmath>

//==============================================================================
namespace
{
    // An exactly logarithmic range, for frequencies.
    juce::NormalisableRange<float> logRange (float minValue, float maxValue)
    {
        return { minValue, maxValue,
                 [] (float start, float end, float normalised) { return start * std::pow (end / start, normalised); },
                 [] (float start, float end, float value)      { return std::log (value / start) / std::log (end / start); },
                 [] (float start, float end, float value)      { return juce::jlimit (start, end, value); } };
    }

    juce::NormalisableRange<float> skewedRange (float minValue, float maxValue, float interval, float centre)
    {
        juce::NormalisableRange<float> range (minValue, maxValue, interval);
        range.setSkewForCentre (centre);
        return range;
    }

    juce::AudioParameterFloatAttributes floatAttributes (const juce::String& label, int decimals)
    {
        return juce::AudioParameterFloatAttributes()
            .withLabel (label)
            .withStringFromValueFunction ([decimals] (float v, int) { return juce::String (v, decimals); });
    }

    juce::AudioParameterFloatAttributes frequencyAttributes()
    {
        return juce::AudioParameterFloatAttributes()
            .withLabel ("Hz")
            .withStringFromValueFunction ([] (float v, int) { return juce::String (v, v < 100.0f ? 1 : 0); });
    }

    float load (const std::atomic<float>* p) noexcept { return p->load (std::memory_order_relaxed); }
}

//==============================================================================
BrokenArrowAudioProcessor::BrokenArrowAudioProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "Parameters", createParameterLayout())
{
    // Cache the raw parameter pointers once, so the audio thread can read them cheaply.
    inputGainParam  = apvts.getRawParameterValue (ParamIDs::inputGain);
    outputGainParam = apvts.getRawParameterValue (ParamIDs::outputGain);
    densityParam    = apvts.getRawParameterValue (ParamIDs::density);
    sizeParam       = apvts.getRawParameterValue (ParamIDs::size);
    countParam      = apvts.getRawParameterValue (ParamIDs::count);
    offsetParam     = apvts.getRawParameterValue (ParamIDs::offset);
    pitchParam      = apvts.getRawParameterValue (ParamIDs::pitch);
    panParam        = apvts.getRawParameterValue (ParamIDs::pan);
    shapeParam      = apvts.getRawParameterValue (ParamIDs::shape);
    reverseParam    = apvts.getRawParameterValue (ParamIDs::reverse);
    delayTimeParam  = apvts.getRawParameterValue (ParamIDs::delayTime);
    feedbackParam   = apvts.getRawParameterValue (ParamIDs::feedback);
    feedbackHPParam = apvts.getRawParameterValue (ParamIDs::feedbackHP);
    feedbackLPParam = apvts.getRawParameterValue (ParamIDs::feedbackLP);
    grainMixParam   = apvts.getRawParameterValue (ParamIDs::grainMix);

    for (auto* p : { inputGainParam, outputGainParam, densityParam, sizeParam, countParam, offsetParam,
                     pitchParam, panParam, shapeParam, reverseParam, delayTimeParam, feedbackParam,
                     feedbackHPParam, feedbackLPParam, grainMixParam })
    {
        jassert (p != nullptr);
        juce::ignoreUnused (p);
    }
}

//==============================================================================
// Parameters, in the order the generic editor shows them: input, grains,
// grain delay, dry/wet, output. IDs are permanent (see ParameterIDs.h).
juce::AudioProcessorValueTreeState::ParameterLayout BrokenArrowAudioProcessor::createParameterLayout()
{
    using Float = juce::AudioParameterFloat;
    using Int   = juce::AudioParameterInt;
    using Bool  = juce::AudioParameterBool;
    using PID   = juce::ParameterID;

    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    // -24 dB to +12 dB in 0.1 dB steps.
    const juce::NormalisableRange<float> gainRange (-24.0f, 12.0f, 0.1f);
    const auto gainAttributes = juce::AudioParameterFloatAttributes().withLabel ("dB");

    layout.add (std::make_unique<Float> (PID { ParamIDs::inputGain, 1 }, "Input Gain", gainRange, 0.0f, gainAttributes));

    // Granulator
    layout.add (std::make_unique<Float> (PID { ParamIDs::density, 1 }, "Density",
                                         skewedRange (1.0f, 50.0f, 0.01f, 8.0f), 8.0f, floatAttributes ("/s", 2)));
    layout.add (std::make_unique<Float> (PID { ParamIDs::size, 1 }, "Size",
                                         skewedRange (10.0f, 1000.0f, 0.1f, 150.0f), 120.0f, floatAttributes ("ms", 1)));
    layout.add (std::make_unique<Int>   (PID { ParamIDs::count, 1 }, "Count", 1, 8, 1));
    layout.add (std::make_unique<Float> (PID { ParamIDs::offset, 1 }, "Offset",
                                         skewedRange (0.0f, 500.0f, 0.1f, 100.0f), 0.0f, floatAttributes ("ms", 1)));
    layout.add (std::make_unique<Int>   (PID { ParamIDs::pitch, 1 }, "Pitch", -24, 24, 0,
                                         juce::AudioParameterIntAttributes().withLabel ("steps")));
    layout.add (std::make_unique<Float> (PID { ParamIDs::pan, 1 }, "Pan",
                                         juce::NormalisableRange<float> (-100.0f, 100.0f, 0.1f), 0.0f, floatAttributes ("", 1)));
    layout.add (std::make_unique<Float> (PID { ParamIDs::shape, 1 }, "Shape",
                                         juce::NormalisableRange<float> (0.0f, 100.0f, 0.1f), 70.0f, floatAttributes ("%", 1)));
    layout.add (std::make_unique<Bool>  (PID { ParamIDs::reverse, 1 }, "Reverse", false));

    // Grain delay
    layout.add (std::make_unique<Float> (PID { ParamIDs::delayTime, 1 }, "Delay Time",
                                         skewedRange (10.0f, 2000.0f, 0.1f, 400.0f), 375.0f, floatAttributes ("ms", 1)));
    layout.add (std::make_unique<Float> (PID { ParamIDs::feedback, 1 }, "Feedback",
                                         juce::NormalisableRange<float> (0.0f, 95.0f, 0.1f), 30.0f, floatAttributes ("%", 1)));
    layout.add (std::make_unique<Float> (PID { ParamIDs::feedbackHP, 1 }, "Feedback HP",
                                         logRange (20.0f, 2000.0f), 80.0f, frequencyAttributes()));
    layout.add (std::make_unique<Float> (PID { ParamIDs::feedbackLP, 1 }, "Feedback LP",
                                         logRange (500.0f, 20000.0f), 8000.0f, frequencyAttributes()));

    // Granulator dry/wet
    layout.add (std::make_unique<Float> (PID { ParamIDs::grainMix, 1 }, "Granulator Dry/Wet",
                                         juce::NormalisableRange<float> (0.0f, 100.0f, 0.1f), 50.0f, floatAttributes ("%", 1)));

    layout.add (std::make_unique<Float> (PID { ParamIDs::outputGain, 1 }, "Output Gain", gainRange, 0.0f, gainAttributes));

    return layout;
}

//==============================================================================
brokenarrow::GranularSection::Parameters BrokenArrowAudioProcessor::readParameters() const noexcept
{
    brokenarrow::GranularSection::Parameters p;

    p.grains.densityHz      = load (densityParam);
    p.grains.sizeMs         = load (sizeParam);
    p.grains.count          = static_cast<int> (std::lround (load (countParam)));
    p.grains.offsetMs       = load (offsetParam);
    p.grains.pitchSemitones = std::round (load (pitchParam));
    p.grains.pan            = load (panParam) * 0.01f;
    p.grains.shape          = load (shapeParam) * 0.01f;
    p.grains.reverse        = load (reverseParam) >= 0.5f;

    p.delayMs    = load (delayTimeParam);
    p.feedback   = load (feedbackParam) * 0.01f;
    p.highPassHz = load (feedbackHPParam);
    p.lowPassHz  = load (feedbackLPParam);
    p.mix        = load (grainMixParam) * 0.01f;

    return p;
}

//==============================================================================
void BrokenArrowAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    juce::ignoreUnused (samplesPerBlock); // everything below works with any block size

    // Set up the gain smoothers and jump straight to the current values,
    // so there is no fade-in when the plugin loads.
    inputGainSmoothed.reset (sampleRate, gainRampSeconds);
    outputGainSmoothed.reset (sampleRate, gainRampSeconds);

    inputGainSmoothed.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (load (inputGainParam)));
    outputGainSmoothed.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (load (outputGainParam)));

    // Allocates the 8 s record buffer, the delay lines and the grain pool for
    // this sample rate, and clears them so no stale audio is heard.
    granular.prepare (sampleRate, readParameters());

    safetyLimiter.prepare (sampleRate, limiterThresholdDb, limiterReleaseMs);
}

void BrokenArrowAudioProcessor::releaseResources()
{
    safetyLimiter.reset();
}

void BrokenArrowAudioProcessor::reset()
{
    // Called by the host e.g. when the transport jumps: forget all history.
    granular.reset();
    safetyLimiter.reset();
    inputGainSmoothed.setCurrentAndTargetValue (inputGainSmoothed.getTargetValue());
    outputGainSmoothed.setCurrentAndTargetValue (outputGainSmoothed.getTargetValue());
}

//==============================================================================
double BrokenArrowAudioProcessor::getTailLengthSeconds() const
{
    // Roughly how long until the repeats have fallen by 60 dB: the grains can
    // lag the input by a few grain lengths (pitch up starts grains further
    // back), then each pass round the loop takes about delay + grain size and
    // is scaled by at most Feedback. Clamped to 2 .. 30 s.
    const auto sizeSec   = static_cast<double> (load (sizeParam)) * 0.001;
    const auto offsetSec = static_cast<double> (load (offsetParam)) * 0.001;
    const auto delaySec  = static_cast<double> (load (delayTimeParam)) * 0.001;
    const auto fb        = juce::jlimit (0.0, 0.95, static_cast<double> (load (feedbackParam)) * 0.01);

    const auto grainLag = 4.0 * sizeSec + offsetSec;
    const auto passes   = fb > 0.001 ? std::log (0.001) / std::log (fb) : 0.0;
    return juce::jlimit (minTailSeconds, maxTailSeconds, grainLag + passes * (delaySec + sizeSec));
}

//==============================================================================
bool BrokenArrowAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    // Output must be stereo. Input may be mono (mono tracks, e.g. in Logic) or stereo.
    const auto& in  = layouts.getMainInputChannelSet();
    const auto& out = layouts.getMainOutputChannelSet();

    if (out != juce::AudioChannelSet::stereo())
        return false;

    return in == juce::AudioChannelSet::mono() || in == juce::AudioChannelSet::stereo();
}

//==============================================================================
void BrokenArrowAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ignoreUnused (midiMessages);
    juce::ScopedNoDenormals noDenormals;

    const auto totalNumInputChannels  = getTotalNumInputChannels();
    const auto totalNumOutputChannels = getTotalNumOutputChannels();
    const auto numSamples             = buffer.getNumSamples();

    // Mono in, stereo out: duplicate the mono input into channel 1 so that
    // everything downstream always sees a stereo signal.
    auto numValidChannels = totalNumInputChannels;

    if (totalNumInputChannels == 1 && totalNumOutputChannels >= 2 && buffer.getNumChannels() >= 2)
    {
        buffer.copyFrom (1, 0, buffer, 0, 0, numSamples);
        numValidChannels = 2;
    }

    // Silence any output channels that have no matching input.
    for (auto ch = numValidChannels; ch < totalNumOutputChannels; ++ch)
        buffer.clear (ch, 0, numSamples);

    if (numSamples == 0)
        return;

    // After the mono copy above there are always two valid channels when the
    // output is stereo (the only supported layout).
    if (buffer.getNumChannels() < 2)
        return;

    auto* left  = buffer.getWritePointer (0);
    auto* right = buffer.getWritePointer (1);

    // Pick up the latest parameter values as smoothing targets.
    inputGainSmoothed.setTargetValue (juce::Decibels::decibelsToGain (load (inputGainParam)));
    outputGainSmoothed.setTargetValue (juce::Decibels::decibelsToGain (load (outputGainParam)));
    granular.setParameters (readParameters());

    // 1. Input gain.
    for (int i = 0; i < numSamples; ++i)
    {
        const auto g = inputGainSmoothed.getNextValue();
        left[i]  *= g;
        right[i] *= g;
    }

    // 2-5. Record buffer, grains, grain delay feedback, granulator dry/wet.
    granular.process (left, right, numSamples);
    activeGrainCount.store (granular.getNumActiveGrains(), std::memory_order_relaxed);

    // 6-7. STAGE 5 SEAM: FX slot 1 -> FX slot 2 -> master section (HP/LP,
    // compressor, master dry/wet) go here, processing `left` / `right` in place.

    // 8. Output gain.
    for (int i = 0; i < numSamples; ++i)
    {
        const auto g = outputGainSmoothed.getNextValue();
        left[i]  *= g;
        right[i] *= g;
    }

    // SAFETY LIMITER - THIS MUST NEVER BE REMOVED.
    // It is the last stage of processing and protects speakers and ears.
    // It is always on and deliberately has no bypass parameter.
    safetyLimiter.process (left, right, numSamples);

    // Last-resort guard: hard clip to +/-1.0, and turn any NaN into silence,
    // so a bad value can never reach the host or the speakers.
    for (auto* data : { left, right })
    {
        for (int i = 0; i < numSamples; ++i)
        {
            const auto x = data[i];
            data[i] = std::isnan (x) ? 0.0f : juce::jlimit (-1.0f, 1.0f, x);
        }
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
