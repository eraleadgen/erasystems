/**
 * "Convergence": scattered, restless strands are drawn into the ERA Core and
 * leave as three clean, lit beams. Light does the work — no grids, no orbits.
 * Everything is SVG + SMIL so it stays crisp at any size and identical on
 * mobile and desktop.
 */

const STRANDS = [
  "M -20 34 C 78 18, 52 92, 138 66 C 172 56, 158 112, 196 96",
  "M -20 92 C 62 82, 80 38, 136 92 C 166 122, 156 78, 196 112",
  "M -20 152 C 74 152, 56 104, 128 134 C 172 152, 150 146, 196 130",
  "M -20 214 C 66 228, 80 172, 136 202 C 174 224, 154 176, 196 150",
  "M -20 272 C 76 292, 54 220, 130 242 C 172 254, 148 198, 196 166",
];

const BEAMS = [
  "M 218 130 C 272 116, 320 108, 404 102",
  "M 218 130 C 274 130, 322 132, 404 132",
  "M 218 130 C 272 144, 320 152, 404 162",
];

export function HeroVisual() {
  return (
    <div className="relative flex aspect-[400/280] w-full max-w-[34rem] items-center justify-center">
      <svg
        viewBox="0 0 400 280"
        className="size-full overflow-visible"
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="era-strand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="60%" stopColor="currentColor" stopOpacity="0.4" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="era-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="era-bloom">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="45%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <filter id="era-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* restless inbound strands */}
        <g className="text-muted-foreground">
          {STRANDS.map((d, i) => (
            <g key={d}>
              <path
                d={d}
                fill="none"
                stroke="url(#era-strand)"
                strokeWidth={1}
                strokeLinecap="round"
              />
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.85}
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeDasharray="26 300"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="326"
                  to="0"
                  dur={`${5 + i * 0.7}s`}
                  begin={`${i * 0.55}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-opacity"
                  values="0;0.75;0"
                  dur={`${5 + i * 0.7}s`}
                  begin={`${i * 0.55}s`}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ))}
        </g>

        {/* the core */}
        <g className="text-primary">
          <circle cx="207" cy="130" r="96" fill="url(#era-bloom)">
            <animate attributeName="r" values="84;104;84" dur="7s" repeatCount="indefinite" />
          </circle>

          {/* expanding rings of light */}
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx="207"
              cy="130"
              r="18"
              fill="none"
              className="stroke-primary"
              strokeWidth={0.9}
            >
              <animate
                attributeName="r"
                values="18;64"
                dur="4.5s"
                begin={`${i * 1.5}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.55;0"
                dur="4.5s"
                begin={`${i * 1.5}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}

          {/* counter-rotating aperture blades */}
          <g filter="url(#era-glow)">
            <g>
              <circle
                cx="207"
                cy="130"
                r="30"
                fill="none"
                className="stroke-primary/50"
                strokeWidth={1.1}
                strokeDasharray="14 10"
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 207 130"
                to="360 207 130"
                dur="26s"
                repeatCount="indefinite"
              />
            </g>
            <g>
              <circle
                cx="207"
                cy="130"
                r="21"
                fill="none"
                className="stroke-gold/60"
                strokeWidth={1}
                strokeDasharray="4 12"
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="360 207 130"
                to="0 207 130"
                dur="15s"
                repeatCount="indefinite"
              />
            </g>
            <circle cx="207" cy="130" r="12" className="fill-primary/20 stroke-primary/80" />
            <circle cx="207" cy="130" r="4.6" className="fill-gold">
              <animate
                attributeName="r"
                values="4.2;6;4.2"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </g>

        {/* clean outbound beams */}
        <g className="text-primary">
          {BEAMS.map((d, i) => (
            <g key={d}>
              <path
                d={d}
                fill="none"
                stroke="url(#era-beam)"
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeOpacity={0.5}
              />
              <path
                d={d}
                fill="none"
                className="stroke-gold"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeDasharray="34 260"
                filter="url(#era-glow)"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="294"
                  to="0"
                  dur={`${3 + i * 0.4}s`}
                  begin={`${i * 0.45}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-opacity"
                  values="0.9;0.9;0"
                  keyTimes="0;0.65;1"
                  dur={`${3 + i * 0.4}s`}
                  begin={`${i * 0.45}s`}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ))}
        </g>

        <text
          x="4"
          y="268"
          className="fill-muted-foreground text-[9px] uppercase"
          style={{ letterSpacing: "0.28em" }}
        >
          Operations
        </text>
        <text
          x="396"
          y="268"
          textAnchor="end"
          className="fill-gold text-[9px] uppercase"
          style={{ letterSpacing: "0.28em" }}
        >
          Results
        </text>
      </svg>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-[3.2rem] text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-gold">ERA Core</p>
        <p className="text-[11px] text-muted-foreground">v2.0 runs the whole business</p>
      </div>
    </div>
  );
}
