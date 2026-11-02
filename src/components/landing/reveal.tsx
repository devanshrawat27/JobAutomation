"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Reveals a block the first time it scrolls into view. Motion is short and
 * eased; with reduced motion the block is simply visible.
 */
export default function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  id?: string;
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
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag className={`lp2-reveal ${className}`.trim()} id={id} ref={node}>
      {children}
    </Tag>
  );
}
