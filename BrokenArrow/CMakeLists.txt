cmake_minimum_required(VERSION 3.22)

# Only meaningful on Apple platforms; must be set before project().
set(CMAKE_OSX_ARCHITECTURES "arm64" CACHE STRING "Target architectures")
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")

project(BrokenArrow VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        8.0.4
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(BrokenArrow
    PRODUCT_NAME "Broken Arrow"
    COMPANY_NAME "Audio Warfare Technologies"
    BUNDLE_ID com.audiowarfaretechnologies.brokenarrow
    PLUGIN_MANUFACTURER_CODE Awtx
    PLUGIN_CODE Bkar
    FORMATS AU VST3 Standalone
    AU_MAIN_TYPE kAudioUnitType_Effect
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
)

# Plugin sources, shared by the plugin and the offline test app.
set(BROKENARROW_SOURCES
    Source/PluginProcessor.cpp
    Source/PluginProcessor.h
    Source/PluginEditor.cpp
    Source/PluginEditor.h
    Source/ParameterIDs.h
    Source/dsp/FastRandom.h
    Source/dsp/RecordBuffer.h
    Source/dsp/SoftClipper.h
    Source/dsp/SafetyLimiter.h
    Source/dsp/GrainEngine.cpp
    Source/dsp/GrainEngine.h
    Source/dsp/GrainDelay.cpp
    Source/dsp/GrainDelay.h
    Source/dsp/GranularSection.cpp
    Source/dsp/GranularSection.h
)

target_sources(BrokenArrow PRIVATE ${BROKENARROW_SOURCES})

target_compile_definitions(BrokenArrow
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(BrokenArrow
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# Offline render tests (Linux by default; off on Apple so the macOS CI build
# and auval run are unaffected). Build: cmake --build build --target BrokenArrowOfflineRender
if(APPLE)
    set(_brokenarrow_tests_default OFF)
else()
    set(_brokenarrow_tests_default ON)
endif()
option(BROKENARROW_BUILD_TESTS "Build the offline render test app" ${_brokenarrow_tests_default})

if(BROKENARROW_BUILD_TESTS)
    juce_add_console_app(BrokenArrowOfflineRender PRODUCT_NAME "BrokenArrowOfflineRender")

    target_sources(BrokenArrowOfflineRender
        PRIVATE
            Tests/OfflineRender.cpp
            ${BROKENARROW_SOURCES}
    )

    # The processor code expects the plugin's name macro.
    target_compile_definitions(BrokenArrowOfflineRender
        PRIVATE
            JucePlugin_Name="Broken Arrow"
            JUCE_WEB_BROWSER=0
            JUCE_USE_CURL=0
    )

    target_link_libraries(BrokenArrowOfflineRender
        PRIVATE
            juce::juce_audio_utils
            juce::juce_dsp
        PUBLIC
            juce::juce_recommended_config_flags
            juce::juce_recommended_warning_flags
    )
endif()
