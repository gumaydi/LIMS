import { type ReactNode, type RefObject, useEffect, useRef } from "react";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  children?: ReactNode;
  confirmDisabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "primary",
  children,
  confirmDisabled = false,
  initialFocusRef,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    (initialFocusRef?.current ?? confirmButtonRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialFocusRef, isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal-card"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-desc">{description}</p>
        {children}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmButtonRef}
            className={`button ${variant === "danger" ? "danger" : "primary"}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
