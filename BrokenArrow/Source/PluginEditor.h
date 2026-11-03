#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>

class BrokenArrowAudioProcessor;

//==============================================================================
// Stage 0 editor: a thin wrapper around JUCE's generic editor, which shows a
// slider for every parameter. A custom UI will replace this in a later stage.
class BrokenArrowAudioProcessorEditor : public juce::GenericAudioProcessorEditor
{
public:
    explicit BrokenArrowAudioProcessorEditor (BrokenArrowAudioProcessor& p);
    ~BrokenArrowAudioProcessorEditor() override = default;

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BrokenArrowAudioProcessorEditor)
};
