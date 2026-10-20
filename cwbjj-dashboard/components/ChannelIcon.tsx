import type { ChannelKey } from "@/lib/config/channels";

/* Small monochrome line icons for the channel table. They inherit the text colour. */
const paths: Record<string, React.ReactNode> = {
  instagram: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="3.2" />
      <circle cx="8" cy="8" r="2.6" />
      <circle cx="11.3" cy="4.7" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8.9 13.6V8.6h1.6M8.9 8.6V7.2c0-.8.4-1.2 1.2-1.2h.7M7.3 8.6h1.6" />
    </>
  ),
  google: <path d="M12.9 7.4H8.2v1.9h2.7a3.1 3.1 0 1 1-.9-3.3l1.4-1.4A5.1 5.1 0 1 0 13 8.2c0-.3 0-.5-.1-.8Z" />,
  direct: (
    <>
      <path d="M6.6 9.4a2.4 2.4 0 0 0 3.4 0l2-2a2.4 2.4 0 0 0-3.4-3.4l-.8.8" />
      <path d="M9.4 6.6a2.4 2.4 0 0 0-3.4 0l-2 2a2.4 2.4 0 0 0 3.4 3.4l.8-.8" />
    </>
  ),
  other: (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M2.4 8h11.2M8 2.4c1.6 1.6 2.3 3.6 2.3 5.6S9.6 12 8 13.6M8 2.4C6.4 4 5.7 6 5.7 8s.7 4 2.3 5.6" />
    </>
  ),
};

export function ChannelIcon({ channel }: { channel: ChannelKey }) {
  const base = channel.split("-")[0];
  return (
    <svg
      className="channel-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[base] ?? paths.other}
    </svg>
  );
}
