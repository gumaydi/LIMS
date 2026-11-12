type AlertMessageProps = {
  type?: "success" | "error" | "info";
  message: string;
  onDismiss?: () => void;
};

export function AlertMessage({ type = "info", message, onDismiss }: AlertMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`form-message ${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <div className="message-content">
        <span className="message-icon" aria-hidden="true">
          {type === "success" ? "✓" : "!"}
        </span>
        <span className="message-text">{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="message-dismiss"
          aria-label="Tutup notifikasi"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}
