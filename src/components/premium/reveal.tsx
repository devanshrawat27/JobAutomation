"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Reveals a block once, the first time it scrolls into view. The motion is
 * short and calm; reduced motion shows the block immediately.
 */
export default function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const node = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = node.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.classList.add("is-in");
      return;
    }

    if (delay) element.style.setProperty("--reveal-delay", `${delay}ms`);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add("is-in");
        observer.disconnect();
      },
      { rootMargin: "0px 0px 8% 0px", threshold: 0.08 },
    );

    observer.observe(element);

    // Safety net: if the observer never fires (a throttled or hidden tab), any
    // block already inside the viewport appears anyway.
    const fallback = window.setTimeout(() => {
      if (element.classList.contains("is-in")) return;
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) element.classList.add("is-in");
    }, 1800);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [delay]);

  return (
    <Tag className={`reveal ${className}`.trim()} ref={node}>
      {children}
    </Tag>
  );
}
