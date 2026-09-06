/**
 * "Convergence": the real ERA Core feature set feeds the core as pulses of
 * light, and leaves the other side as results. Symmetrical by design — four
 * mirrored inbound rails, four mirrored outbound rails, one core between them.
 * SVG + SMIL so it stays crisp and identical on mobile and desktop.
 */

const ROWS = [-96, -46, 46, 96];

const INPUTS = ["Website", "AI chat", "Scheduling", "Payments"];
const OUTPUTS = ["Booked jobs", "Invoices paid", "Follow-ups", "Insights"];

const CORE_X = 200;
const CORE_Y = 130;

/** Inbound rail: from the label column into the left edge of the core. */
const inPath = (y: number) => `M 92 ${y} C 140 ${y}, 150 ${CORE_Y}, ${CORE_X - 26} ${CORE_Y}`;
/** Outbound rail: mirror image, from the core out to the results column. */
const outPath = (y: number) => `M ${CORE_X + 26} ${CORE_Y} C 250 ${CORE_Y}, 260 ${y}, 308 ${y}`;

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
          <radialGradient id="era-bloom">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="45%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <filter id="era-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* inbound: real features, each on its own rail */}
        <g>
          {ROWS.map((offset, i) => {
            const y = CORE_Y + offset;
            const d = inPath(y);
            return (
              <g key={INPUTS[i]}>
                <path
                  d={d}
                  fill="none"
                  className="stroke-muted-foreground/25"
                  strokeWidth={0.8}
                  strokeLinecap="round"
                />
                <text
                  x="84"
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px]"
                  style={{ letterSpacing: "0.08em" }}
                >
                  {INPUTS[i]}
                </text>
                <circle cx="89" cy={y} r="1.8" className="fill-muted-foreground/60" />
                <circle r="2.6" className="fill-primary" filter="url(#era-glow)">
                  <animateMotion
                    dur="4.4s"
                    begin={`${i * 1.1}s`}
                    repeatCount="indefinite"
                    path={d}
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.12;0.82;1"
                    dur="4.4s"
                    begin={`${i * 1.1}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}
        </g>

        {/* the core */}
        <g className="text-primary">
          <circle cx={CORE_X} cy={CORE_Y} r="96" fill="url(#era-bloom)">
            <animate attributeName="r" values="84;104;84" dur="7s" repeatCount="indefinite" />
          </circle>

          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={CORE_X}
              cy={CORE_Y}
              r="18"
              fill="none"
              className="stroke-primary"
              strokeWidth={0.9}
            >
              <animate
                attributeName="r"
                values="18;60"
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

          <g filter="url(#era-glow)">
            <g>
              <circle
                cx={CORE_X}
                cy={CORE_Y}
                r="30"
                fill="none"
                className="stroke-primary/50"
                strokeWidth={1.1}
                strokeDasharray="14 10"
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${CORE_X} ${CORE_Y}`}
                to={`360 ${CORE_X} ${CORE_Y}`}
                dur="26s"
                repeatCount="indefinite"
              />
            </g>
            <g>
              <circle
                cx={CORE_X}
                cy={CORE_Y}
                r="21"
                fill="none"
                className="stroke-gold/60"
                strokeWidth={1}
                strokeDasharray="4 12"
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`360 ${CORE_X} ${CORE_Y}`}
                to={`0 ${CORE_X} ${CORE_Y}`}
                dur="15s"
                repeatCount="indefinite"
              />
            </g>
            <circle cx={CORE_X} cy={CORE_Y} r="12" className="fill-primary/20 stroke-primary/80" />
            <circle cx={CORE_X} cy={CORE_Y} r="4.6" className="fill-gold">
              <animate
                attributeName="r"
                values="4.2;6;4.2"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </g>

        {/* outbound: results leaving the core, mirrored */}
        <g>
          {ROWS.map((offset, i) => {
            const y = CORE_Y + offset;
            const d = outPath(y);
            return (
              <g key={OUTPUTS[i]}>
                <path
                  d={d}
                  fill="none"
                  className="stroke-gold/25"
                  strokeWidth={0.8}
                  strokeLinecap="round"
                />
                <text
                  x="316"
                  y={y + 3}
                  className="fill-gold text-[9px]"
                  style={{ letterSpacing: "0.08em" }}
                >
                  {OUTPUTS[i]}
                </text>
                <circle cx="311" cy={y} r="1.8" className="fill-gold/60" />
                <circle r="2.6" className="fill-gold" filter="url(#era-glow)">
                  <animateMotion
                    dur="4.4s"
                    begin={`${1.4 + i * 1.1}s`}
                    repeatCount="indefinite"
                    path={d}
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.12;0.82;1"
                    dur="4.4s"
                    begin={`${1.4 + i * 1.1}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}
        </g>

        <text
          x="4"
          y="272"
          className="fill-muted-foreground text-[9px] uppercase"
          style={{ letterSpacing: "0.28em" }}
        >
          Operations
        </text>
        <text
          x="396"
          y="272"
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
