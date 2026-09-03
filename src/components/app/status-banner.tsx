export function StatusBanner({
  tone,
  label,
  headline,
  body,
  footnote,
}: {
  tone: "live" | "waiting" | "halted";
  label: string;
  headline: string;
  body: string;
  footnote?: React.ReactNode;
}) {
  return (
    <section className={`era-card era-banner era-banner--${tone} p-6 sm:p-7`}>
      <span className={`era-status era-status--${tone}`}>
        <i />
        {label}
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {headline}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>
      {footnote && <div className="mt-4 text-xs text-muted-foreground">{footnote}</div>}
    </section>
  );
}
