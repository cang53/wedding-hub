"use client";

/**
 * Banner for a failed background mutation (delete, toggle, reorder).
 *
 * Dialog forms surface their own errors through useActionState, but the
 * optimistic list mutations have nowhere to put a failure — before this they
 * were discarded, so a rejected write looked identical to a successful one
 * until the page was reloaded.
 */
export function ActionError({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 mb-6 px-4 py-3 rounded-[4px] border border-burgundy/30 bg-burgundy/5"
    >
      <span className="text-burgundy text-sm leading-relaxed flex-1">
        Couldn&rsquo;t save that change — {message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-burgundy/60 hover:text-burgundy text-sm leading-none shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
