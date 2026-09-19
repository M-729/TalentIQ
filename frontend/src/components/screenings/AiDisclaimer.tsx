export function AiDisclaimer({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      AI screening provides decision-support information based on the submitted CV and configured job requirements.
      Final hiring decisions remain with HR.
    </p>
  );
}
