/**
 * Ambient gold dust drifting over the VDS hero.
 *
 * Positions come from a deterministic pseudo-random sequence so the server
 * render and the browser render agree (no hydration mismatch).
 */

function seeded(i: number, salt: number) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function GoldParticles({ count = 55 }: { count?: number }) {
  const dots = Array.from({ length: count }, (_, i) => ({
    left: seeded(i, 1) * 100,
    top: seeded(i, 2) * 100,
    size: 1.5 + seeded(i, 3) * 2.5,
    delay: seeded(i, 4) * 12,
    duration: 9 + seeded(i, 5) * 12,
    drift: (seeded(i, 6) - 0.5) * 60,
    opacity: 0.25 + seeded(i, 7) * 0.6,
  }));

  return (
    <div className="vds-particles" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className="vds-particle"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            animationDelay: `-${d.delay}s`,
            animationDuration: `${d.duration}s`,
            opacity: d.opacity,
            ["--vds-drift" as string]: `${d.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
