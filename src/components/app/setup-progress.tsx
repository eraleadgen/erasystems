export type StepState = "done" | "current" | "upcoming";

export function SetupProgress({
  steps,
}: {
  steps: { label: string; state: StepState }[];
}) {
  return (
    <ol className="era-card grid gap-px overflow-hidden bg-border p-0 sm:grid-cols-4">
      {steps.map((step, i) => (
        <li key={step.label} className="era-step bg-card px-4 py-4" data-state={step.state}>
          <span className="era-step-dot" />
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Step {i + 1}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{step.label}</p>
        </li>
      ))}
    </ol>
  );
}
