import { useState } from "react";

/**
 * Signal lattice: six inputs on the edges feed one record in the middle.
 * Pulses physically travel the wires, so the animation shows the product
 * behaviour instead of decorating the page.
 */
const LATTICE = [
  { label: "Website", x: 40, y: 44 },
  { label: "Chat", x: 34, y: 160 },
  { label: "Scheduling", x: 40, y: 276 },
  { label: "Customers", x: 360, y: 44 },
  { label: "Jobs", x: 366, y: 160 },
  { label: "Payments", x: 360, y: 276 },
] as const;

const CX = 200;
const CY = 160;

function wire(x: number, y: number) {
  const mx = (x + CX) / 2;
  return `M ${x} ${y} C ${mx} ${y} ${mx} ${CY} ${CX} ${CY}`;
}

export function HeroVisual() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="relative flex h-[24rem] w-full items-center justify-center sm:h-[30rem]">
      <svg
        viewBox="0 0 400 320"
        className="absolute inset-0 size-full"
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        {LATTICE.map((n, i) => {
          const d = wire(n.x, n.y);
          const on = active === n.label;
          return (
            <g key={n.label}>
              <path
                d={d}
                fill="none"
                strokeWidth={on ? 1.6 : 1}
                className={on ? "stroke-gold/70" : "stroke-primary/30"}
                strokeLinecap="round"
              />
              <path
                id={`wire-${i}`}
                d={d}
                fill="none"
                stroke="none"
              />
              <circle r={on ? 3.6 : 2.6} className={on ? "fill-gold" : "fill-primary"}>
                <animateMotion
                  dur={`${4.6 + i * 0.55}s`}
                  begin={`${i * 0.7}s`}
                  repeatCount="indefinite"
                  keyPoints="0;1"
                  keyTimes="0;1"
                  calcMode="spline"
                  keySplines="0.45 0 0.15 1"
                >
                  <mpath href={`#wire-${i}`} />
                </animateMotion>
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.12;0.82;1"
                  dur={`${4.6 + i * 0.55}s`}
                  begin={`${i * 0.7}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* edge inputs */}
      {LATTICE.map((n) => (
        <button
          key={n.label}
          type="button"
          onMouseEnter={() => setActive(n.label)}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(n.label)}
          onBlur={() => setActive(null)}
          style={{ left: `${(n.x / 400) * 100}%`, top: `${(n.y / 320) * 100}%` }}
          className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors duration-300 ${
            active === n.label
              ? "border-gold/60 bg-card text-gold"
              : "border-metal/60 bg-card/90 text-muted-foreground"
          }`}
        >
          {n.label}
        </button>
      ))}

      {/* core record */}
      <div className="relative z-10 rounded-xl border border-primary/40 bg-card px-6 py-5 text-center">
        <span className="pulse-halo" aria-hidden />
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-gold">ERA Core</p>
        <p className="mt-2 font-display text-2xl font-semibold text-foreground">v2.0</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {active ? `${active} runs on ERA Core v2.0` : "The engine running your business"}
        </p>

      </div>
    </div>
  );
}
