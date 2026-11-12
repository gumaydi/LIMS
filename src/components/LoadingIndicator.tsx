type Props = {
  label?: string;
  compact?: boolean;
};

export function LoadingIndicator({ label = "Memuat data...", compact = false }: Props) {
  return (
    <div className={compact ? "loading-indicator compact" : "loading-indicator"} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
