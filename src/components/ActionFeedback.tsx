import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ActionNoticeType = "info" | "success" | "error";

export interface ActionConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ActionFeedbackContextValue {
  confirmAction: (options: ActionConfirmationOptions) => Promise<boolean>;
  notify: (message: string, options?: { type?: ActionNoticeType; durationMs?: number }) => void;
}

interface ActionToast {
  id: number;
  message: string;
  type: ActionNoticeType;
}

interface PendingConfirmation {
  options: ActionConfirmationOptions;
  resolve: (confirmed: boolean) => void;
}

const ActionFeedbackContext = createContext<ActionFeedbackContextValue>({
  confirmAction: async (options) => {
    if (typeof window === "undefined") return true;
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom")) return true;
    try {
      return window.confirm(`${options.title}\n\n${options.message}`) !== false;
    } catch {
      return true;
    }
  },
  notify: () => undefined,
});

export function useActionFeedback() {
  return useContext(ActionFeedbackContext);
}

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const nextToastId = useRef(1);
  const [toasts, setToasts] = useState<ActionToast[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const notify = useCallback<ActionFeedbackContextValue["notify"]>((message, options) => {
    const id = nextToastId.current++;
    const type = options?.type ?? "info";
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, options?.durationMs ?? 3500);
  }, []);

  const confirmAction = useCallback<ActionFeedbackContextValue["confirmAction"]>((options) => {
    return new Promise<boolean>((resolve) => {
      setConfirmation((current) => {
        current?.resolve(false);
        return { options, resolve };
      });
    });
  }, []);

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    setConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirmAction, notify }), [confirmAction, notify]);

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      <div className="action-toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`action-toast action-toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
      {confirmation && (
        <div className="action-confirm-backdrop" role="presentation" onClick={() => resolveConfirmation(false)}>
          <div
            className="action-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="action-confirm-title">{confirmation.options.title}</h3>
            <p>{confirmation.options.message}</p>
            <div className="action-confirm-actions">
              <button type="button" onClick={() => resolveConfirmation(false)}>
                {confirmation.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className={confirmation.options.danger ? "danger" : "primary-action"}
                onClick={() => resolveConfirmation(true)}
              >
                {confirmation.options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ActionFeedbackContext.Provider>
  );
}
