"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A short silent screen recording, played while it is on screen.
 *
 * Plays only while visible, so a page of clips does not run them all at once.
 * Someone who has asked their device for less motion gets the still and a
 * play button instead, and nothing starts on its own.
 *
 * Two encodings of each clip: WebM for Chrome, Edge and Firefox (Chromium
 * builds without H.264 cannot play the MP4 at all), MP4 for Safari and iOS.
 * `src` is the path without its extension; the poster is `src`.jpg.
 */
export function Clip({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Refused autoplay (a data saver, say) gets the play button. Scrolling
          // straight past cancels the play with an AbortError, which is not a
          // refusal: it plays again next time it comes into view.
          video.play().catch((e: unknown) => {
            if (e instanceof DOMException && e.name === "NotAllowedError") setStill(true);
          });
        } else video.pause();
      },
      { threshold: 0.4 },
    );
    seen.observe(video);
    return () => seen.disconnect();
  }, []);

  return (
    <figure className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
      <video
        ref={ref}
        poster={`${src}.jpg`}
        muted
        loop
        playsInline
        preload="none"
        controls={still}
        aria-label={label}
        className="block aspect-[8/5] w-full"
      >
        <source src={`${src}.webm`} type="video/webm" />
        <source src={`${src}.mp4`} type="video/mp4" />
      </video>
      <figcaption className="border-t border-line px-3 py-2 text-xs text-ink-2">{label}</figcaption>
    </figure>
  );
}
