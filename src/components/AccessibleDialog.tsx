import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface AccessibleDialogProps {
  children: ReactNode;
  onDismiss: () => void;
  labelledBy: string;
  describedBy?: string;
  backdropClassName: string;
  dialogClassName: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  style?: React.CSSProperties;
}

interface BackgroundState {
  element: HTMLElement;
  ariaHidden: string | null;
  inert: boolean;
}

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true" && !element.closest("[inert]"),
  );
}

/**
 * Shared modal behavior for app-owned dialogs.
 *
 * Portalling the layer to document.body lets us make the application behind it
 * inert without hiding the dialog itself from assistive technology.
 */
export function AccessibleDialog({
  children,
  onDismiss,
  labelledBy,
  describedBy,
  backdropClassName,
  dialogClassName,
  closeOnBackdrop = true,
  closeOnEscape = true,
  style,
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const modalLayer = dialog.closest<HTMLElement>("[data-modal-layer]");
    const backgroundState: BackgroundState[] = [];

    for (const element of Array.from(document.body.children)) {
      if (!(element instanceof HTMLElement) || element === modalLayer) continue;
      backgroundState.push({
        element,
        ariaHidden: element.getAttribute("aria-hidden"),
        inert: Boolean(element.inert),
      });
      element.setAttribute("aria-hidden", "true");
      element.inert = true;
    }

    const initialFocus = dialog.querySelector<HTMLElement>("[data-modal-initial-focus]")
      ?? focusableElements(dialog)[0]
      ?? dialog;
    initialFocus.focus();

    return () => {
      for (const state of backgroundState) {
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
        state.element.inert = state.inert;
      }
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && closeOnEscape) {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      return;
    }

    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={backdropClassName}
      role="presentation"
      data-modal-layer
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={style}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
