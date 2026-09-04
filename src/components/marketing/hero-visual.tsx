/**
 * "Chaos into flow": tangled, noisy strands on the left are pulled through the
 * ERA Core and leave as one calm, bright stream. It shows the promise of the
 * product (efficiency) rather than decorating the page. No grids, no orbits.
 */

const TANGLE = [
  "M -10 40 C 70 20, 60 96, 130 70 C 168 56, 150 118, 196 92",
  "M -10 96 C 60 84, 74 40, 132 96 C 164 128, 154 74, 196 108",
  "M -10 160 C 72 158, 58 106, 126 138 C 170 158, 148 150, 196 132",
  "M -10 224 C 64 236, 78 176, 134 208 C 172 230, 152 178, 196 152",
  "M -10 280 C 74 300, 56 224, 128 246 C 170 258, 146 200, 196 168",
];

const FLOW = [
  "M 214 130 C 268 118, 316 112, 396 108",
  "M 214 130 C 272 130, 320 132, 396 132",
  "M 214 130 C 268 142, 316 150, 396 156",
];

export function HeroVisual() {
  return (
    <div className="relative flex h-[22rem] w-full items-center justify-center sm:h-[28rem]">
      <svg
        viewBox="0 0 400 260"
        className="size-full"
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="era-tangle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.45" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="era-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id="era-core-glow">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* incoming noise */}
        <g className="text-muted-foreground">
          {TANGLE.map((d, i) => (
            <g key={d}>
              <path
                d={d}
                fill="none"
                stroke="url(#era-tangle)"
                strokeWidth={1.1}
                strokeLinecap="round"
              />
              <circle r={2.2} className="fill-muted-foreground/70">
                <animateMotion
                  dur={`${5.4 + i * 0.6}s`}
                  begin={`${i * 0.45}s`}
                  repeatCount="indefinite"
                  path={d}
                  calcMode="spline"
                  keyPoints="0;1"
                  keyTimes="0;1"
                  keySplines="0.6 0 0.2 1"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.9;0"
                  dur={`${5.4 + i * 0.6}s`}
                  begin={`${i * 0.45}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </g>

        {/* the core */}
        <g className="text-primary">
          <circle cx="205" cy="130" r="70" fill="url(#era-core-glow)">
            <animate
              attributeName="r"
              values="58;76;58"
              dur="6s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="205" cy="130" r="16" className="fill-primary/25 stroke-primary/70" />
          <circle cx="205" cy="130" r="6" className="fill-gold" />
        </g>

        {/* calm outgoing flow */}
        <g className="text-primary">
          {FLOW.map((d, i) => (
            <g key={d}>
              <path d={d} fill="none" stroke="url(#era-flow)" strokeWidth={1.4} strokeLinecap="round" />
              <circle r={2.8} className="fill-gold">
                <animateMotion
                  dur={`${3.2 + i * 0.35}s`}
                  begin={`${i * 0.5}s`}
                  repeatCount="indefinite"
                  path={d}
                />
                <animate
                  attributeName="opacity"
                  values="1;1;0"
                  keyTimes="0;0.6;1"
                  dur={`${3.2 + i * 0.35}s`}
                  begin={`${i * 0.5}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </g>

        <text
          x="16"
          y="248"
          className="fill-muted-foreground text-[9px] uppercase"
          style={{ letterSpacing: "0.28em" }}
        >
          Scattered work
        </text>
        <text
          x="384"
          y="248"
          textAnchor="end"
          className="fill-gold text-[9px] uppercase"
          style={{ letterSpacing: "0.28em" }}
        >
          Time back
        </text>
      </svg>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-10 text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-gold">ERA Core</p>
        <p className="text-[11px] text-muted-foreground">v2.0 runs the whole business</p>
      </div>
    </div>
  );
}
