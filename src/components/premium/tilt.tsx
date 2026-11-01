"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A shallow 3D tilt that follows the pointer. The card leans a few degrees and
 * its layers drift at different depths, which reads as depth without a 3D
 * engine. Touch devices and reduced motion get the flat card.
 */
export default function Tilt({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const render = () => {
      const next = current.current;
      const goal = target.current;
      next.x += (goal.x - next.x) * 0.12;
      next.y += (goal.y - next.y) * 0.12;

      element.style.setProperty("--tilt-y", `${(next.x * max).toFixed(2)}deg`);
      element.style.setProperty("--tilt-x", `${(-next.y * max).toFixed(2)}deg`);
      element.style.setProperty("--shift-x", `${(next.x * -14).toFixed(2)}px`);
      element.style.setProperty("--shift-y", `${(next.y * -10).toFixed(2)}px`);
      element.style.setProperty("--glow-x", `${(50 + next.x * 42).toFixed(1)}%`);
      element.style.setProperty("--glow-y", `${(42 + next.y * 38).toFixed(1)}%`);

      if (Math.abs(goal.x - next.x) > 0.001 || Math.abs(goal.y - next.y) > 0.001) {
        raf.current = requestAnimationFrame(render);
      } else {
        raf.current = 0;
      }
    };

    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      target.current = {
        x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      };
      if (!raf.current) raf.current = requestAnimationFrame(render);
    };

    const leave = () => {
      target.current = { x: 0, y: 0 };
      if (!raf.current) raf.current = requestAnimationFrame(render);
    };

    const host = element.parentElement ?? element;
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);

    return () => {
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf.current);
    };
  }, [max]);

  return (
    <div className={`tilt ${className}`.trim()} ref={frame}>
      {children}
    </div>
  );
}
