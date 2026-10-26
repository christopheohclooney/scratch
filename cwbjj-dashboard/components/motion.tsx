"use client";

import Link from "next/link";
import { MotionConfig, motion, type Transition, type Variants } from "motion/react";
import { useEffect, useState } from "react";

/*
  All the dashboard's motion in one place. Everything honours the visitor's
  "reduce motion" setting through MotionConfig.
*/

const ease = [0.22, 0.61, 0.36, 1] as const;

/* The sliding underline and pill: a soft spring, settled in about 0.45s. */
const slide: Transition = { type: "spring", bounce: 0.15, duration: 0.45 };

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface NavItem {
  key: string;
  label: string;
  href: string;
}

/*
  Links with a shared indicator (underline or pill) that slides to the one
  clicked. The indicator moves on click, before the new page data arrives, so
  the switch feels immediate.
*/
export function SlidingNav({
  items,
  active,
  label,
  className,
  indicatorClassName,
  layoutId,
}: {
  items: NavItem[];
  active: string;
  label: string;
  className: string;
  indicatorClassName: string;
  layoutId: string;
}) {
  const [selected, setSelected] = useState(active);
  useEffect(() => setSelected(active), [active]);

  return (
    <nav className={className} aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          aria-current={item.key === active ? "page" : undefined}
          data-selected={item.key === selected || undefined}
          onClick={() => setSelected(item.key)}
        >
          {item.key === selected ? (
            <motion.span className={indicatorClassName} layoutId={layoutId} transition={slide} aria-hidden="true" />
          ) : null}
          <span className="nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

const container: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

/* Fades and lifts each section in turn. Give it a key so it replays on a tab or range change. */
export function Stagger({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={container} initial="hidden" animate="shown">
      {children}
    </motion.div>
  );
}

export function Item({ children }: { children: React.ReactNode }) {
  return <motion.div variants={item}>{children}</motion.div>;
}

/* A bar that grows from the baseline to its width. */
export function GrowBar({ share, className }: { share: number; className: string }) {
  return (
    <motion.div
      className={className}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(1, share) * 100}%` }}
      transition={{ duration: 0.7, ease, delay: 0.15 }}
    />
  );
}
