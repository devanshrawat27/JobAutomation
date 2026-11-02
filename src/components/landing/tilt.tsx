"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A shallow 3D lean on the product shot: the card turns a few degrees toward the
 * pointer, its layers drift at different depths and a soft light follows the
 * cursor. Touch devices and reduced-motion readers get the flat card.
 */
export default function Tilt({
  children,
  className = "",
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const stage = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const frame = useRef(0);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const render = () => {
      const next = current.current;
      const goal = target.current;
      next.x += (goal.x - next.x) * 0.1;
      next.y += (goal.y - next.y) * 0.1;

      element.style.setProperty("--tilt-x", `${(-next.y * max).toFixed(2)}deg`);
      element.style.setProperty("--tilt-y", `${(next.x * max).toFixed(2)}deg`);
      element.style.setProperty("--light-x", `${(50 + next.x * 40).toFixed(1)}%`);
      element.style.setProperty("--light-y", `${(30 + next.y * 30).toFixed(1)}%`);

      if (Math.abs(goal.x - next.x) > 0.001 || Math.abs(goal.y - next.y) > 0.001) {
        frame.current = requestAnimationFrame(render);
      } else {
        frame.current = 0;
      }
    };

    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      target.current = {
        x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      };
      if (!frame.current) frame.current = requestAnimationFrame(render);
    };

    const leave = () => {
      target.current = { x: 0, y: 0 };
      if (!frame.current) frame.current = requestAnimationFrame(render);
    };

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);

    return () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame.current);
    };
  }, [max]);

  return (
    <div className={`lp2-tilt ${className}`.trim()} ref={stage}>
      {children}
    </div>
  );
}
