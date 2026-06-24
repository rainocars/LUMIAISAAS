import React, { useEffect, useRef } from "react";

/**
 * Slot-reel digit that cycles 0-9 quickly using refs + DOM updates
 * (so React state isn't churned 10× per second).
 */
const Digit = ({ speed = 70 }) => {
  const ref = useRef(null);
  useEffect(() => {
    let v = Math.floor(Math.random() * 10);
    if (ref.current) ref.current.textContent = String(v);
    const id = setInterval(() => {
      v = (v + 1 + Math.floor(Math.random() * 3)) % 10;
      if (ref.current) ref.current.textContent = String(v);
    }, speed);
    return () => clearInterval(id);
  }, [speed]);
  return (
    <span
      ref={ref}
      className="font-mono inline-block w-[0.62em] text-center tabular-nums"
    >
      0
    </span>
  );
};

/**
 * "Book Your Call · +91 98XXX 99###" — animated phone digits.
 * Last six characters cycle continuously for a "live line" feel.
 */
export const AnimatedPhone = ({ prefix = "+91", className = "" }) => {
  return (
    <span className={`inline-flex items-baseline gap-1 font-mono ${className}`}>
      <span className="opacity-80">{prefix}</span>
      <span className="inline-flex">
        <Digit speed={90} />
        <Digit speed={120} />
        <span className="opacity-50 mx-0.5">·</span>
        <Digit speed={70} />
        <Digit speed={110} />
        <Digit speed={95} />
        <Digit speed={140} />
        <Digit speed={80} />
      </span>
    </span>
  );
};

export default AnimatedPhone;
