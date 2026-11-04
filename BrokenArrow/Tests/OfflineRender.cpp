// Broken Arrow offline render tests.
//
// Instantiates the processor directly (no host, no editor), renders test
// signals at several sample rates and block sizes, and checks the safety and
// level-behaviour requirements of Stage 1. Prints the numbers and returns a
// non-zero exit code if any check fails.

#include "../Source/PluginProcessor.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace
{
using Processor = BrokenArrowAudioProcessor;
using Values    = std::map<std::string, float>;

int failures = 0;

void check (bool ok, const std::string& what)
{
    if (! ok)
    {
        ++failures;
        std::printf ("  FAIL: %s\n", what.c_str());
    }
}

double toDb (double x) { return 20.0 * std::log10 (std::max (x, 1.0e-12)); }

//==============================================================================
// Test signals. `t` in seconds; returns the sample for channel `ch`.
struct Signal
{
    std::string name;
    std::function<float (double t, int ch, juce::Random& rng)> fn;
};

float sineBursts (double t, int, juce::Random&)
{
    const auto phase = std::fmod (t, 0.5);
    if (phase > 0.2) return 0.0f;
    const auto env = std::min (1.0, std::min (phase, 0.2 - phase) / 0.005); // 5 ms ramps
    return static_cast<float> (0.5 * env * std::sin (2.0 * juce::MathConstants<double>::pi * 440.0 * t));
}

float noiseBursts (double t, int, juce::Random& rng)
{
    return std::fmod (t, 0.5) < 0.25 ? 0.5f * (rng.nextFloat() * 2.0f - 1.0f) : 0.0f;
}

// Drum-like: a click + decaying noise + a 60 Hz thump every 250 ms.
float drums (double t, int, juce::Random& rng)
{
    const auto local = std::fmod (t, 0.25);
    const auto noise = (rng.nextFloat() * 2.0f - 1.0f) * static_cast<float> (std::exp (-local / 0.03));
    const auto thump = static_cast<float> (std::sin (2.0 * juce::MathConstants<double>::pi * 60.0 * local) * std::exp (-local / 0.08));
    const auto click = local < 0.0005 ? 1.0f : 0.0f;
    return juce::jlimit (-1.0f, 1.0f, 0.45f * noise + 0.45f * thump + 0.1f * click);
}

float silence (double, int, juce::Random&) { return 0.0f; }

float continuousNoise (double, int, juce::Random& rng) { return 0.3f * (rng.nextFloat() * 2.0f - 1.0f); }

//==============================================================================
void setParam (Processor& proc, const std::string& id, float value)
{
    auto* p = proc.apvts.getParameter (id);
    jassert (p != nullptr);
    if (p != nullptr)
        p->setValueNotifyingHost (p->convertTo0to1 (value));
}

void setParams (Processor& proc, const Values& values)
{
    for (const auto& [id, v] : values)
        setParam (proc, id, v);
}

struct RenderResult
{
    std::vector<float> inL, outL, outR;
    double sampleRate = 48000.0;
    float  peak = 0.0f;
    bool   finite = true;
    int    maxActiveGrains = 0;
    double processSeconds = 0.0;

    double rms (double fromSec, double toSec) const
    {
        const auto a = static_cast<size_t> (fromSec * sampleRate);
        const auto b = std::min (outL.size(), static_cast<size_t> (toSec * sampleRate));
        double sum = 0.0;
        for (auto i = a; i < b; ++i)
            sum += 0.5 * (static_cast<double> (outL[i]) * outL[i] + static_cast<double> (outR[i]) * outR[i]);
        return b > a ? std::sqrt (sum / static_cast<double> (b - a)) : 0.0;
    }
};

// Renders `seconds` of audio. Input is `signal` until `inputStopSec`, then
// silence. blockSize <= 0 means random block sizes in [1, 1024].
RenderResult render (Processor& proc, double sampleRate, int blockSize, double seconds,
                     const Signal& signal, double inputStopSec = 1.0e9, bool keepInput = false,
                     const std::function<void (Processor&, juce::Random&)>& perBlock = {})
{
    const auto maxBlock = blockSize > 0 ? blockSize : 1024;
    proc.setRateAndBufferSizeDetails (sampleRate, maxBlock);
    proc.prepareToPlay (sampleRate, maxBlock);

    RenderResult r;
    r.sampleRate = sampleRate;

    const auto total = static_cast<int> (seconds * sampleRate);
    r.outL.reserve (static_cast<size_t> (total));
    r.outR.reserve (static_cast<size_t> (total));
    if (keepInput)
        r.inL.reserve (static_cast<size_t> (total));

    juce::AudioBuffer<float> buffer (2, maxBlock);
    juce::MidiBuffer midi;
    juce::Random rng (1234);
    juce::Random blockRng (99);
    juce::Random autoRng (7);

    const auto numInputs = proc.getTotalNumInputChannels();

    for (int pos = 0; pos < total;)
    {
        const auto n = std::min (total - pos, blockSize > 0 ? blockSize : 1 + blockRng.nextInt (1024));
        buffer.setSize (2, n, false, false, true);
        buffer.clear();

        for (int i = 0; i < n; ++i)
        {
            const auto t = static_cast<double> (pos + i) / sampleRate;
            const auto live = t < inputStopSec;
            const auto l = live ? signal.fn (t, 0, rng) : 0.0f;
            const auto rr = live ? (numInputs > 1 ? signal.fn (t, 1, rng) : 0.0f) : 0.0f;
            buffer.setSample (0, i, l);
            if (numInputs > 1)
                buffer.setSample (1, i, rr);
            if (keepInput)
                r.inL.push_back (l);
        }

        if (perBlock)
            perBlock (proc, autoRng);

        const auto t0 = std::chrono::steady_clock::now();
        proc.processBlock (buffer, midi);
        const auto t1 = std::chrono::steady_clock::now();
        r.processSeconds += std::chrono::duration<double> (t1 - t0).count();
        r.maxActiveGrains = std::max (r.maxActiveGrains, proc.getNumActiveGrains());

        for (int i = 0; i < n; ++i)
        {
            const auto l = buffer.getSample (0, i);
            const auto rr = buffer.getSample (1, i);
            if (! std::isfinite (l) || ! std::isfinite (rr))
                r.finite = false;
            r.peak = std::max (r.peak, std::max (std::abs (l), std::abs (rr)));
            r.outL.push_back (l);
            r.outR.push_back (rr);
        }

        pos += n;
    }

    return r;
}

// Runs the granular core directly (no output limiter or hard clip, which would
// hide a NaN or a runaway) and reports finiteness and raw peak.
struct RawResult { bool finite = true; float peak = 0.0f; };

RawResult renderRaw (const brokenarrow::GranularSection::Parameters& params, double sampleRate, int blockSize,
                     double seconds, const Signal& signal)
{
    auto section = std::make_unique<brokenarrow::GranularSection>();
    section->prepare (sampleRate, params);

    std::vector<float> l (static_cast<size_t> (blockSize)), r (static_cast<size_t> (blockSize));
    juce::Random rng (1234);
    RawResult res;
    const auto total = static_cast<int> (seconds * sampleRate);

    for (int pos = 0; pos < total; pos += blockSize)
    {
        const auto n = std::min (blockSize, total - pos);
        for (int i = 0; i < n; ++i)
        {
            const auto t = static_cast<double> (pos + i) / sampleRate;
            l[static_cast<size_t> (i)] = signal.fn (t, 0, rng);
            r[static_cast<size_t> (i)] = signal.fn (t, 1, rng);
        }

        section->setParameters (params);
        section->process (l.data(), r.data(), n);

        for (int i = 0; i < n; ++i)
        {
            if (! std::isfinite (l[static_cast<size_t> (i)]) || ! std::isfinite (r[static_cast<size_t> (i)]))
                res.finite = false;
            res.peak = std::max ({ res.peak, std::abs (l[static_cast<size_t> (i)]), std::abs (r[static_cast<size_t> (i)]) });
        }
    }

    return res;
}

brokenarrow::GranularSection::Parameters toSectionParams (const Values& v)
{
    brokenarrow::GranularSection::Parameters p;
    auto get = [&] (const char* id, float def) { auto it = v.find (id); return it != v.end() ? it->second : def; };
    p.grains.densityHz      = get (ParamIDs::density, 8.0f);
    p.grains.sizeMs         = get (ParamIDs::size, 120.0f);
    p.grains.count          = static_cast<int> (get (ParamIDs::count, 1.0f));
    p.grains.offsetMs       = get (ParamIDs::offset, 0.0f);
    p.grains.pitchSemitones = get (ParamIDs::pitch, 0.0f);
    p.grains.pan            = get (ParamIDs::pan, 0.0f) * 0.01f;
    p.grains.shape          = get (ParamIDs::shape, 70.0f) * 0.01f;
    p.grains.reverse        = get (ParamIDs::reverse, 0.0f) > 0.5f;
    p.delayMs    = get (ParamIDs::delayTime, 375.0f);
    p.feedback   = get (ParamIDs::feedback, 30.0f) * 0.01f;
    p.highPassHz = get (ParamIDs::feedbackHP, 80.0f);
    p.lowPassHz  = get (ParamIDs::feedbackLP, 8000.0f);
    p.mix        = get (ParamIDs::grainMix, 50.0f) * 0.01f;
    return p;
}

std::unique_ptr<Processor> makeProcessor (const Values& values, bool monoInput = false)
{
    auto proc = std::make_unique<Processor>();

    if (monoInput)
    {
        Processor::BusesLayout layout;
        layout.inputBuses.add (juce::AudioChannelSet::mono());
        layout.outputBuses.add (juce::AudioChannelSet::stereo());
        const auto ok = proc->setBusesLayout (layout);
        check (ok, "mono input layout accepted");
    }

    setParams (*proc, values);
    return proc;
}

//==============================================================================
void testMatrix()
{
    std::printf ("\n[1] Safety matrix: 3 rates x 3 block sizes x 4 signals x 4 settings (3 s each; output and raw granular section)\n");

    const std::vector<Signal> signals { { "sine", sineBursts }, { "noise", noiseBursts }, { "drums", drums }, { "silence", silence } };

    const std::vector<std::pair<std::string, Values>> presets {
        { "default", {} },
        { "glitch",  { { ParamIDs::density, 50 }, { ParamIDs::count, 8 }, { ParamIDs::size, 10 }, { ParamIDs::shape, 0 },
                       { ParamIDs::pitch, 24 }, { ParamIDs::feedback, 95 }, { ParamIDs::grainMix, 100 }, { ParamIDs::inputGain, 12 } } },
        { "wash",    { { ParamIDs::density, 50 }, { ParamIDs::count, 8 }, { ParamIDs::size, 1000 }, { ParamIDs::pitch, -24 },
                       { ParamIDs::reverse, 1 }, { ParamIDs::feedback, 95 }, { ParamIDs::delayTime, 2000 }, { ParamIDs::offset, 500 },
                       { ParamIDs::feedbackHP, 20 }, { ParamIDs::feedbackLP, 20000 }, { ParamIDs::grainMix, 100 }, { ParamIDs::inputGain, 12 },
                       { ParamIDs::outputGain, 12 } } },
        { "panned",  { { ParamIDs::pan, -100 }, { ParamIDs::density, 20 }, { ParamIDs::count, 3 }, { ParamIDs::size, 300 },
                       { ParamIDs::pitch, 12 }, { ParamIDs::feedback, 80 }, { ParamIDs::delayTime, 10 } } },
    };

    int runs = 0;
    float worstPeak = 0.0f, worstRawPeak = 0.0f;
    bool allFinite = true;

    for (const auto sr : { 44100.0, 48000.0, 96000.0 })
        for (const auto bs : { 64, 333, 1024 })
            for (const auto& sig : signals)
                for (const auto& [name, values] : presets)
                {
                    auto proc = makeProcessor (values);
                    const auto r = render (*proc, sr, bs, 3.0, sig);
                    const auto raw = renderRaw (toSectionParams (values), sr, bs, 3.0, sig);
                    ++runs;
                    worstPeak = std::max (worstPeak, r.peak);
                    worstRawPeak = std::max (worstRawPeak, raw.peak);
                    allFinite = allFinite && r.finite && raw.finite;

                    const auto label = name + " " + sig.name + " @" + std::to_string ((int) sr) + "/" + std::to_string (bs);
                    check (r.finite && raw.finite, "finite output: " + label);
                    check (r.peak <= 1.0f, "peak <= 1.0: " + label);
                }

    std::printf ("  %d runs, all finite: %s, worst output peak %.4f (%.2f dBFS), worst raw granular-section peak (before limiter) %.3f\n",
                 runs, allFinite ? "yes" : "NO", worstPeak, toDb (worstPeak), worstRawPeak);

    // Variable block sizes (1..1024) and a mono input bus.
    {
        auto proc = makeProcessor ({ { ParamIDs::density, 30 }, { ParamIDs::count, 4 }, { ParamIDs::feedback, 90 } });
        const auto r = render (*proc, 44100.0, 0, 10.0, { "drums", drums });
        std::printf ("  random block sizes 1..1024 @44.1k, 10 s: finite %s, peak %.4f\n", r.finite ? "yes" : "NO", r.peak);
        check (r.finite && r.peak <= 1.0f, "random block sizes");
    }
    // Random automation of every parameter on every block.
    {
        auto proc = makeProcessor ({});
        const auto r = render (*proc, 48000.0, 128, 20.0, { "drums", drums }, 1.0e9, false,
                               [] (Processor& p, juce::Random& rng)
                               {
                                   if (rng.nextInt (4) != 0) return;
                                   for (auto* param : p.getParameters())
                                       param->setValueNotifyingHost (rng.nextFloat());
                               });
        std::printf ("  random automation of all parameters, 20 s: finite %s, peak %.4f\n", r.finite ? "yes" : "NO", r.peak);
        check (r.finite && r.peak <= 1.0f, "random automation");
    }

    // Sample rate change and reset() on the same instance.
    {
        auto proc = makeProcessor ({ { ParamIDs::feedback, 95 }, { ParamIDs::size, 1000 } });
        render (*proc, 44100.0, 512, 3.0, { "noise", noiseBursts });
        const auto r96 = render (*proc, 96000.0, 64, 0.5, { "silence", silence });
        proc->reset();
        const auto r48 = render (*proc, 48000.0, 1024, 3.0, { "noise", noiseBursts });
        std::printf ("  re-prepare 44.1k -> 96k: first 0.5 s after re-prepare (silent input) peak %.6f (should be 0: buffers cleared); then 48k finite %s\n",
                     r96.peak, r48.finite ? "yes" : "NO");
        check (r96.peak <= 0.0f, "prepareToPlay clears stale audio");
        check (r48.finite && r48.peak <= 1.0f, "sample rate change");
    }
}

//==============================================================================
void testFeedbackStability()
{
    std::printf ("\n[2] Feedback stability: feedback 95%%, density 1, size 1000 ms, wet 100%%, input +12 dB.\n"
                 "    5 s of loud drums+noise then 25 s of silence (48 kHz, 512 blocks).\n");
    std::printf ("    %-22s %8s %10s %10s %10s %10s %12s\n", "case", "peak", "rms 0-5s", "rms 10s", "rms 20s", "last 1s", "drop(dB)");

    const Signal loud { "loud", [] (double t, int ch, juce::Random& rng) { return juce::jlimit (-1.0f, 1.0f, drums (t, ch, rng) + noiseBursts (t, ch, rng)); } };

    auto runCase = [&] (const std::string& name, const Values& extra, bool strict)
    {
        Values v { { ParamIDs::feedback, 95 }, { ParamIDs::density, 1 }, { ParamIDs::size, 1000 }, { ParamIDs::grainMix, 100 },
                   { ParamIDs::inputGain, 12 } };
        for (const auto& [k, x] : extra) v[k] = x;

        auto proc = makeProcessor (v);
        const auto r = render (*proc, 48000.0, 512, 30.0, loud, 5.0);
        const auto during = r.rms (0.0, 5.0), at10 = r.rms (10.0, 11.0), at20 = r.rms (20.0, 21.0), last = r.rms (29.0, 30.0);
        std::printf ("    %-22s %8.4f %10.1f %10.1f %10.1f %10.1f %12.1f\n", name.c_str(), r.peak, toDb (during), toDb (at10), toDb (at20), toDb (last),
                     toDb (during) - toDb (last));
        check (r.finite && r.peak <= 1.0f, "bounded: " + name);
        // "Not latched": either effectively silent, or still falling steadily
        // (each later measurement at least 3 dB lower) and well below the
        // level while the input was playing.
        const auto decaying = toDb (last) < -90.0
                           || (toDb (at20) < toDb (at10) - 3.0 && toDb (last) < toDb (at20) - 3.0 && toDb (during) - toDb (last) > 20.0);
        if (strict)
            check (decaying, "decays after input stops: " + name);
    };

    for (const auto pitch : { 24, -24, 0 })
        for (const auto rev : { 0, 1 })
            runCase ("pitch " + std::to_string (pitch) + (rev ? " rev" : " fwd"),
                     { { ParamIDs::pitch, (float) pitch }, { ParamIDs::reverse, (float) rev } }, true);

    std::printf ("    Harsher cases (informational):\n");
    runCase ("dens50 cnt8 p0 fwd", { { ParamIDs::density, 50 }, { ParamIDs::count, 8 } }, false);
    runCase ("dens50 cnt8 p+12 rev", { { ParamIDs::density, 50 }, { ParamIDs::count, 8 }, { ParamIDs::pitch, 12 }, { ParamIDs::reverse, 1 } }, false);
    runCase ("dens50 cnt1 HP20 LP20k", { { ParamIDs::density, 50 }, { ParamIDs::feedbackHP, 20 }, { ParamIDs::feedbackLP, 20000 } }, false);
    runCase ("shape0 delay10ms", { { ParamIDs::density, 8 }, { ParamIDs::shape, 0 }, { ParamIDs::delayTime, 10 } }, false);
}

//==============================================================================
// Dense settings at 95 % feedback: does the loop sustain on its own forever?
void testLatchSurvey()
{
    std::printf ("\n[2b] Dense feedback survey: feedback 95%%, size 1000 ms, wet 100%%, input +12 dB, 5 s input then 25 s silence.\n");
    std::printf ("    %-30s %8s %10s %10s %10s %10s\n", "case", "peak", "rms 0-5s", "rms 10s", "rms 20s", "last 1s");

    const Signal loud { "loud", [] (double t, int ch, juce::Random& rng) { return juce::jlimit (-1.0f, 1.0f, drums (t, ch, rng) + noiseBursts (t, ch, rng)); } };
    int latched = 0;

    for (const auto density : { 8.0f, 50.0f })
        for (const auto count : { 1, 8 })
            for (const auto pitch : { -12, 0, 7, 12 })
                for (const auto rev : { 0, 1 })
                {
                    Values v { { ParamIDs::feedback, 95 }, { ParamIDs::density, density }, { ParamIDs::count, (float) count },
                               { ParamIDs::size, 1000 }, { ParamIDs::pitch, (float) pitch }, { ParamIDs::reverse, (float) rev },
                               { ParamIDs::grainMix, 100 }, { ParamIDs::inputGain, 12 } };
                    auto proc = makeProcessor (v);
                    const auto r = render (*proc, 48000.0, 512, 30.0, loud, 5.0);
                    const auto last = toDb (r.rms (29.0, 30.0));
                    const auto name = "d" + std::to_string ((int) density) + " c" + std::to_string (count) + " p" + std::to_string (pitch) + (rev ? " rev" : " fwd");
                    const auto isLatched = last > -40.0 && last > toDb (r.rms (20.0, 21.0)) - 3.0;
                    latched += isLatched ? 1 : 0;
                    std::printf ("    %-30s %8.4f %10.1f %10.1f %10.1f %10.1f%s\n", name.c_str(), r.peak, toDb (r.rms (0.0, 5.0)),
                                 toDb (r.rms (10.0, 11.0)), toDb (r.rms (20.0, 21.0)), last, isLatched ? "  LATCHED" : "");
                    check (r.finite && r.peak <= 1.0f, "bounded: " + name);
                    check (! isLatched, "no self-sustaining feedback: " + name);
                }

    std::printf ("    %d of 32 dense cases sustain on their own\n", latched);
}

//==============================================================================
void testDryNull()
{
    std::printf ("\n[3] Granulator Dry/Wet 0%%: output vs input (48 kHz, 256 blocks, feedback 95%%, dense grains)\n");

    for (const auto& sig : { Signal { "noise -10 dBFS", [] (double, int, juce::Random& rng) { return 0.316f * (rng.nextFloat() * 2.0f - 1.0f); } },
                             Signal { "sine bursts", sineBursts }, Signal { "drums", drums } })
    {
        auto proc = makeProcessor ({ { ParamIDs::grainMix, 0 }, { ParamIDs::feedback, 95 }, { ParamIDs::density, 50 }, { ParamIDs::count, 8 } });
        const auto r = render (*proc, 48000.0, 256, 5.0, sig, 1.0e9, true);

        double maxDiff = 0.0, peakIn = 0.0;
        for (size_t i = 0; i < r.inL.size(); ++i)
        {
            maxDiff = std::max (maxDiff, (double) std::abs (r.outL[i] - r.inL[i]));
            peakIn  = std::max (peakIn, (double) std::abs (r.inL[i]));
        }

        std::printf ("  %-16s input peak %.3f, max |out - in| = %.2e (%.1f dBFS)\n", sig.name.c_str(), peakIn, maxDiff, toDb (maxDiff));
        check (maxDiff < 1.0e-5, "dry null: " + sig.name);
    }
}

//==============================================================================
void testLevelNormalisation()
{
    std::printf ("\n[4] Level normalisation: continuous white noise, wet 100%%, feedback 0, 48 kHz.\n"
                 "    Wet RMS relative to input RMS, measured 2-6 s.\n");

    auto measure = [] (const Values& v)
    {
        Values all { { ParamIDs::grainMix, 100 }, { ParamIDs::feedback, 0 } };
        for (const auto& [k, x] : v) all[k] = x;
        auto proc = makeProcessor (all);
        const auto r = render (*proc, 48000.0, 512, 6.0, { "noise", continuousNoise });
        const auto inRms = 0.3 / std::sqrt (3.0);
        return std::pair<double, int> { toDb (r.rms (2.0, 6.0)) - toDb (inRms), r.maxActiveGrains };
    };

    auto sweep = [&] (const std::string& title, const std::string& id, const std::vector<float>& values, const Values& base, bool assertSpread)
    {
        std::printf ("  %s\n   ", title.c_str());
        double lo = 1e9, hi = -1e9;
        for (const auto x : values)
        {
            auto v = base;
            v[id] = x;
            const auto [db, voices] = measure (v);
            lo = std::min (lo, db);
            hi = std::max (hi, db);
            std::printf (" %g:%+.1fdB(%dv)", x, db, voices);
        }
        std::printf ("\n    spread %.1f dB%s\n", hi - lo, assertSpread ? "" : " (informational)");
        if (assertSpread)
            check (hi - lo < 6.0, title + " spread < 6 dB");
    };

    const std::vector<float> counts { 1, 2, 3, 4, 6, 8 };
    const std::vector<float> densities { 1, 2, 4, 8, 16, 32, 50 };

    sweep ("count 1..8 (density 8, size 120, pitch 0)", ParamIDs::count, counts, { { ParamIDs::density, 8 } }, true);
    sweep ("count 1..8 (density 50, size 120, pitch 0)", ParamIDs::count, counts, { { ParamIDs::density, 50 } }, true);
    sweep ("density 1..50 (count 1, size 1000, pitch 0)", ParamIDs::density, densities, { { ParamIDs::size, 1000 } }, true);
    sweep ("density 1..50 (count 8, size 1000, pitch 0)", ParamIDs::density, densities, { { ParamIDs::size, 1000 }, { ParamIDs::count, 8 } }, true);
    sweep ("density 1..50 (count 1, size 1000, pitch +7)", ParamIDs::density, densities, { { ParamIDs::size, 1000 }, { ParamIDs::pitch, 7 } }, true);
    sweep ("density 1..50 (count 1, size 1000, reverse)", ParamIDs::density, densities, { { ParamIDs::size, 1000 }, { ParamIDs::reverse, 1 } }, true);
    sweep ("count 1..8 (density 8, size 120, pitch -12)", ParamIDs::count, counts, { { ParamIDs::density, 8 }, { ParamIDs::pitch, -12 } }, true);
    sweep ("density 1..50 (count 1, size 120: sparse at low density)", ParamIDs::density, densities, {}, false);

    const auto a = measure ({ { ParamIDs::count, 1 }, { ParamIDs::density, 1 }, { ParamIDs::size, 1000 } }).first;
    const auto b = measure ({ { ParamIDs::count, 8 }, { ParamIDs::density, 50 }, { ParamIDs::size, 1000 } }).first;
    std::printf ("  corners at size 1000: count1/dens1 %+.1f dB vs count8/dens50 %+.1f dB -> %.1f dB apart\n", a, b, std::abs (a - b));
    check (std::abs (a - b) < 6.0, "corner spread < 6 dB");
}

//==============================================================================
void testCpu()
{
    std::printf ("\n[5] CPU: 48 kHz, 1024-sample blocks, density 50, count 8, size 1000 ms (64 voices busy), 20 s\n");

    for (const auto& [name, extra] : std::vector<std::pair<std::string, Values>> {
             { "pitch 0", {} }, { "pitch +24", { { ParamIDs::pitch, 24 } } }, { "pitch -24 reverse", { { ParamIDs::pitch, -24 }, { ParamIDs::reverse, 1 } } } })
    {
        Values v { { ParamIDs::density, 50 }, { ParamIDs::count, 8 }, { ParamIDs::size, 1000 }, { ParamIDs::feedback, 95 }, { ParamIDs::grainMix, 100 } };
        for (const auto& [k, x] : extra) v[k] = x;
        auto proc = makeProcessor (v);
        const auto r = render (*proc, 48000.0, 1024, 20.0, { "noise", continuousNoise });
        const auto pct = 100.0 * r.processSeconds / 20.0;
        std::printf ("  %-18s max active grains %d, processBlock time %.3f s for 20 s audio = %.2f%% of one core\n",
                     name.c_str(), r.maxActiveGrains, r.processSeconds, pct);
        check (r.maxActiveGrains == brokenarrow::GrainEngine::maxGrains, "64 voices busy: " + name);
        check (pct < 25.0, "CPU well under real time: " + name);
    }
}

//==============================================================================
void testPan()
{
    std::printf ("\n[7] Pan law: sine bursts, wet 100%%, feedback 0, 48 kHz (stereo and mono input buses)\n");

    for (const auto mono : { false, true })
    {
        double centreTotal = 0.0;

        for (const auto pan : { 0.0f, -100.0f, -60.0f, 60.0f, 100.0f })
        {
            auto proc = makeProcessor ({ { ParamIDs::pan, pan }, { ParamIDs::grainMix, 100 }, { ParamIDs::feedback, 0 } }, mono);
            const auto r = render (*proc, 48000.0, 256, 4.0, { "sine", sineBursts });

            double sl = 0, sr = 0;
            for (size_t i = 0; i < r.outL.size(); ++i) { sl += (double) r.outL[i] * r.outL[i]; sr += (double) r.outR[i] * r.outR[i]; }
            const auto n = (double) r.outL.size();
            const auto l = 10 * std::log10 (sl / n + 1e-30), rr = 10 * std::log10 (sr / n + 1e-30), total = 10 * std::log10 ((sl + sr) / n + 1e-30);
            if (std::abs (pan) < 0.5f) centreTotal = total;

            std::printf ("  %s pan %+4.0f: L %7.1f dB  R %7.1f dB  total %.1f dB\n", mono ? "mono  " : "stereo", pan, l, rr, total);
            check (r.finite && std::abs (total - centreTotal) < 0.5, "pan keeps total power");
            if (pan >= 100.0f)  check (l < -100.0, "hard right silences left");
            if (pan <= -100.0f) check (rr < -100.0, "hard left silences right");
        }
    }
}

//==============================================================================
void testState()
{
    std::printf ("\n[6] State save / restore\n");
    auto a = makeProcessor ({ { ParamIDs::density, 23.5f }, { ParamIDs::pitch, -7 }, { ParamIDs::reverse, 1 }, { ParamIDs::feedbackLP, 1234 } });
    juce::MemoryBlock state;
    a->getStateInformation (state);

    auto b = makeProcessor ({});
    b->setStateInformation (state.getData(), (int) state.getSize());

    bool same = true;
    for (int i = 0; i < a->getParameters().size(); ++i)
        same = same && std::abs (a->getParameters()[i]->getValue() - b->getParameters()[i]->getValue()) < 1.0e-6f;

    std::printf ("  %d parameters round-trip: %s\n", a->getParameters().size(), same ? "identical" : "DIFFERENT");
    check (same, "state round trip");

    auto defaults = makeProcessor ({});
    auto longest  = makeProcessor ({ { ParamIDs::feedback, 95 }, { ParamIDs::delayTime, 2000 }, { ParamIDs::size, 1000 } });
    std::printf ("  tail length: defaults %.1f s, feedback 95%% / 2 s delay %.1f s\n",
                 defaults->getTailLengthSeconds(), longest->getTailLengthSeconds());
    check (defaults->getTailLengthSeconds() >= 2.0 && longest->getTailLengthSeconds() <= 30.0, "tail length range");
}
} // namespace

//==============================================================================
int main (int argc, char** argv)
{
    juce::ScopedJuceInitialiser_GUI juceInit;

    if (argc > 1 && std::string (argv[1]) == "--latch")
    {
        testLatchSurvey();
        return failures == 0 ? 0 : 1;
    }

    std::printf ("Broken Arrow offline render tests\n");

    testState();
    testPan();
    testDryNull();
    testLevelNormalisation();
    testFeedbackStability();
    testLatchSurvey();
    testCpu();
    testMatrix();

    std::printf ("\n%s (%d failure%s)\n", failures == 0 ? "ALL PASSED" : "FAILED", failures, failures == 1 ? "" : "s");
    return failures == 0 ? 0 : 1;
}
