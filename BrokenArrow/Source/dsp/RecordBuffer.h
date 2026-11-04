#pragma once

#include <juce_core/juce_core.h>

#include <vector>

namespace brokenarrow
{

//==============================================================================
// The cyclical stereo record buffer: always recording (input + grain delay
// feedback), and read by the grains with cubic Hermite interpolation.
//
// The storage is rounded up to a power of two (so index wrapping is a cheap
// bit mask), which means it holds at least the requested 8 seconds.
// Memory is only allocated in prepare(); everything else is real-time safe.
class RecordBuffer
{
public:
    void prepare (double sampleRate, double minimumSeconds)
    {
        const auto wanted = static_cast<int> (std::ceil (sampleRate * minimumSeconds)) + 4096;
        const auto size   = juce::nextPowerOfTwo (wanted);

        left.assign (static_cast<size_t> (size), 0.0f);
        right.assign (static_cast<size_t> (size), 0.0f);
        mask      = size - 1;
        writePos  = 0;
    }

    void clear() noexcept
    {
        std::fill (left.begin(), left.end(), 0.0f);
        std::fill (right.begin(), right.end(), 0.0f);
        writePos = 0;
    }

    int getSize() const noexcept     { return mask + 1; }
    int getWritePos() const noexcept { return writePos; }

    // Records one stereo frame at the write head and advances it.
    void write (float l, float r) noexcept
    {
        left[static_cast<size_t> (writePos)]  = l;
        right[static_cast<size_t> (writePos)] = r;
        writePos = (writePos + 1) & mask;
    }

    // Wraps any position (in samples, possibly negative) into [0, size).
    double wrap (double pos) const noexcept
    {
        const auto size = static_cast<double> (mask + 1);
        pos = std::fmod (pos, size);
        return pos < 0.0 ? pos + size : pos;
    }

    // 4-point, 3rd-order Hermite (Catmull-Rom) read at a fractional position
    // in [0, size). Reads samples floor(pos)-1 ... floor(pos)+2.
    void readHermite (double pos, float& outL, float& outR) const noexcept
    {
        const auto i = static_cast<int> (pos);
        const auto f = static_cast<float> (pos - static_cast<double> (i));

        const auto im1 = static_cast<size_t> ((i - 1) & mask);
        const auto i0  = static_cast<size_t> (i & mask);
        const auto i1  = static_cast<size_t> ((i + 1) & mask);
        const auto i2  = static_cast<size_t> ((i + 2) & mask);

        outL = hermite (left[im1],  left[i0],  left[i1],  left[i2],  f);
        outR = hermite (right[im1], right[i0], right[i1], right[i2], f);
    }

private:
    static float hermite (float xm1, float x0, float x1, float x2, float t) noexcept
    {
        const auto c1 = 0.5f * (x1 - xm1);
        const auto c2 = xm1 - 2.5f * x0 + 2.0f * x1 - 0.5f * x2;
        const auto c3 = 0.5f * (x2 - xm1) + 1.5f * (x0 - x1);
        return ((c3 * t + c2) * t + c1) * t + x0;
    }

    std::vector<float> left, right;
    int mask     = 0;
    int writePos = 0;
};

} // namespace brokenarrow
