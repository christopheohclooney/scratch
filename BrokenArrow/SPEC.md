# Broken Arrow Build Spec

Oct 29, 2026 · @Christy

## How to use this spec

Save this doc as SPEC.md in your plugin folder, then tell Claude Code: "Read SPEC.md and do Stage 0 only. Stop when it builds and tell me how to test it." Move to the next stage only when the current one works in your DAW.

Rules for Claude Code, every stage:

- Do one stage at a time, then stop and give a short plain-English test list.
- Commit to git at the end of each stage, so any stage can be undone.
- Keep parameter IDs stable once created, so saved DAW sessions keep working.
- No memory allocation, locks or file access on the audio thread.
- Smooth every parameter change to avoid zipper noise and clicks.
- The output limiter and feedback soft clipper are never removed.
- Build AU and VST3 for Apple Silicon, install them, and run auval after every build.
- Explain changes simply. The user is a musician, not a programmer.

This is an original plugin inspired by how granular delays work. Use our own name, artwork, presets and wording throughout.

## What we're building

Audio Warfare Technologies: Broken Arrow is a stereo granular delay effect: audio in, audio out, no samples to load. It should stay musical and recognisable, not random bleeps. Tempo sync, scale-locked pitch and controlled randomness matter more than extreme chaos.

Signal flow:

1. Input gain.
2. A cyclical 8-second stereo buffer constantly records the input plus the grain delay feedback.
3. The granulator spawns grains from the buffer and mixes them.
4. The grain delay takes the granulator output, delays it, filters it (HP and LP) and feeds it back into the buffer input.
5. Granulator dry/wet.
6. FX slot 1, then FX slot 2, in series.
7. Master section: HP and LP filter, then compressor.
8. Master dry/wet, output gain, safety limiter.

&#91;embedded content: GrainLoop signal flow · 9 stages, 1 feedback loop\]

The feedback loop is what makes it a granular delay: each repeat gets re-granulated on its next pass.

## Stage 0: setup and pass-through

Goal: an empty plugin that loads in the DAW and passes audio through untouched.

- [ ] Check Xcode command line tools; install CMake if missing
- [ ] Create a JUCE CMake project named BrokenArrow (display name Broken Arrow, manufacturer Audio Warfare Technologies), stereo effect, AU and VST3, Apple Silicon
- [ ] Add Input Gain, Output Gain and a safety limiter on the output
- [ ] Build, install to the plugin folders, run auval
- [ ] Set up git and commit

Done when: it shows up in the DAW, audio passes through, and the gain knobs work.

## Stage 1: grain engine and grain delay

Goal: a usable glitch box with plain generic knobs.

- [ ] Cyclical 8-second stereo buffer, always recording
- [ ] Grain scheduler: max 64 active grains, each with its own start position, length, pitch, pan, direction and window
- [ ] Grains read just behind the record point, so they follow the live input
- [ ] Density, Size, Count, Offset, Pitch, Pan, Shape, Reverse (ranges in the reference table)
- [ ] Pitch by resampling the grain read speed, with interpolation
- [ ] Shape morphs the grain window from hard edges (glitchy) to fully smooth
- [ ] Grain delay: Time, Feedback, Feedback HP, Feedback LP, feeding back into the buffer input
- [ ] Soft clipper inside the feedback loop
- [ ] Granulator Dry/Wet
- [ ] Normalise grain level by how many grains overlap, so Count and Density don't make it louder

Done when: guitar and drum loops sound granular but recognisable, feedback builds musically, and nothing can blow up even at full feedback.

## Stage 2: character

Goal: the controls that make it musical and alive.

- [ ] Random amounts, applied per grain: Density Random, Size Random, Pitch Random, Pan Random (0 to 100 percent)
- [ ] Scale menu for Pitch: Chromatic, Major, Minor, Pentatonic, Octaves, Fifths, Major Chord, Minor Chord. Outside Chromatic, pitch steps are scale steps (Major Chord: 1 step = major 3rd, 2 = 5th, 3 = octave)
- [ ] Pitch Random picks notes only from the chosen scale
- [ ] Sync toggles for Density and Delay Time, using DAW tempo (1/32 to 2 bars, with dotted and triplet)
- [ ] Ratio locks: Size locked to a ratio of Density, Offset locked to a ratio of Density (1:4, 1:2, 1:1, 2:1, 4:1)
- [ ] Stretch on/off, Speed (100 percent down to 1 percent, slow-down only), Speed Sync
- [ ] Retrigger: jumps the slowed playhead back to the live position at a synced rate

Done when: synced settings lock to the groove, scale settings sound in key, and stretch gives smooth slowed-down smears.

## Stage 3: performance page

Goal: a simple front page that plays like a chaos pad. Current knobs move to an Advanced tab.

- [ ] Macro 1 "Fission" (0 to 100): raises Density and Count, shortens Size, raises Pitch Random and Pan Random
- [ ] Macro 2 "Fallout" (0 to 100): raises Feedback and Delay Time, and the FX wet amounts once Stage 5 exists
- [ ] Circular XY pad: horizontal moves Macro 1, vertical moves Macro 2
- [ ] Reverse toggle, large Dry/Wet slider, input and output meters with clip indicators
- [ ] Macros offset the Advanced settings rather than overwriting them
- [ ] Macros and XY position are automatable in the DAW

Done when: dragging the XY dot goes smoothly from clean to shattered and washed-out, with no clicks.

Later option: let presets choose what each macro controls and rename it.

## Stage 4: modulation envelopes

Goal: two looping, drawable envelopes that can move any knob.

- [ ] Two envelopes, each a looping curve of points the user can add, drag, delete and bend
- [ ] Rate, with Sync to switch between Hz and musical note values
- [ ] Humanize adds random variation to each cycle
- [ ] Random button makes a new shape; Clear resets it
- [ ] Assign each envelope to up to 8 parameters, each with its own depth, unipolar or bipolar
- [ ] Modulation is centred on the knob's current position
- [ ] A few starter shapes: sine, triangle, ramp up, ramp down, square, stepped random

Done when: an envelope on Pitch or Density creates rhythmic movement in time with the track.

## Stage 5: effects and master section

Goal: two effect slots after the granulator, then a master section. The effects sit after the granulator dry/wet, so they process both the grains and the dry signal.

Two slots in series, each with an on/off switch, an effect menu and its own dry/wet:

| Effect | Controls |
| --- | --- |
| Bit Reducer | Bits, Sample Rate Reduction |
| Chorus | Rate, Depth, Mix |
| Distortion | Drive, Tone, Type (soft, hard, fuzz) |
| Filter | Type (LP, HP, BP), Cutoff, Resonance |
| Phaser | Rate, Depth, Feedback |
| Reverb | Size, Damping, Width, Freeze |
| Stereo Delay | Time (with sync), Feedback, Ping-pong |

Master section, with an on/off switch:

- [ ] HP Cutoff and LP Cutoff
- [ ] Compressor: Threshold, Ratio, Attack, Release, Gain, with a gain reduction meter
- [ ] Master Dry/Wet

Done when: each effect works in both slots, switching effects doesn't click, and Reverb Freeze holds a pad under the grains.

## Stage 6: custom UI, presets, polish

Goal: make it look and feel like a finished instrument, in our own style.

- [ ] Custom dark UI: performance page plus Advanced page with Grain, Modulation, FX and Master sections
- [ ] Our own XY visual: a circle with dots that react to live grains (density, spread, pitch)
- [ ] Value readout showing the knob being moved
- [ ] Preset save and load, with categories and an Init preset
- [ ] Dry/Wet lock so it stays put while browsing presets
- [ ] Resizable window
- [ ] Starter presets: guitar shimmer, drum stutter, vocal smear, frozen pad, glitch repeater
- [ ] Check CPU at 64 grains with both FX on; optimise if over about 15 percent on one core

Done when: you'd happily use it on a client mix.

## Testing and parameter reference

After every stage, test in the DAW with a guitar DI, a drum loop and a vocal:

- [ ] Plugin loads, saves and reloads with the session, settings intact
- [ ] No clicks when moving any knob quickly or automating it
- [ ] Full feedback with tiny density and huge grains never clips the output
- [ ] Bypass on and off is click-free
- [ ] Works at 44.1, 48 and 96 kHz, and with buffer sizes 64 to 1024
- [ ] Tempo-synced settings follow tempo changes

Starting ranges are educated guesses; tune them by ear.

| Parameter | Range | Default |
| --- | --- | --- |
| Density | 1 to 50 grains per second, or synced | 8 per second |
| Size | 10 to 1000 ms, or ratio-locked | 120 ms |
| Count | 1 to 8 grains per trigger | 1 |
| Offset | 0 to 500 ms, or ratio-locked | 0 ms |
| Pitch | -24 to +24 steps | 0 |
| Pan | -100 to +100 | 0 |
| Shape | 0 (hard edges) to 100 (smooth) | 70 |
| Random amounts | 0 to 100 percent | 0 |
| Speed (Stretch) | 1 to 100 percent | 100 percent |
| Delay Time | 10 to 2000 ms, or synced | 375 ms |
| Feedback | 0 to 95 percent | 30 percent |
| Feedback HP | 20 Hz to 2 kHz | 80 Hz |
| Feedback LP | 500 Hz to 20 kHz | 8 kHz |
| Granulator Dry/Wet | 0 to 100 percent | 50 percent |
| Input and Output Gain | -24 to +12 dB | 0 dB |
