'use client';

import { useRef, useEffect, type PropsWithChildren, type HTMLAttributes } from 'react';

interface RevealSectionProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  delay?: string;
}

export function RevealSection({ children, className = '', delay, style, ...props }: RevealSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { ...style, transitionDelay: delay } : style}
      {...props}
    >
      {children}
    </div>
  );
}
