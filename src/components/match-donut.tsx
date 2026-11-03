import type { CSSProperties } from "react";

/** 2πr for the 36-unit viewBox, r = 15.5. */
const CIRCUMFERENCE = 97.4;

export type MatchVerdict = "strong" | "good" | "possible" | "weak";

/**
 * The match score as one ring, everywhere it appears.
 *
 * The arc length is the score, the number sits inside, and the colour is the
 * verdict — strong green, good blue, possible amber, weak grey. A single
 * component keeps /jobs and /dashboard from drifting apart.
 */
export default function MatchDonut({
  score,
  verdict,
  size = 56,
}: {
  score: number;
  verdict: MatchVerdict;
  size?: number;
}) {
  const value = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <span
      aria-label={`Match score ${value} out of 100`}
      className={`match-donut is-${verdict}`}
      role="img"
      style={{ "--donut-size": `${size}px` } as CSSProperties}
    >
      <svg aria-hidden="true" viewBox="0 0 36 36">
        <circle className="match-donut-track" cx="18" cy="18" r="15.5" />
        <circle
          className="match-donut-value"
          cx="18"
          cy="18"
          r="15.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
        />
      </svg>
      <span className="match-donut-body">
        <b>{value}</b>
        <small>match</small>
      </span>
    </span>
  );
}
