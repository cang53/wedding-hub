/**
 * Gold line — diamond — gold line.
 * The signature divider used in the masthead and login page.
 */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`ornament ${className}`} aria-hidden="true">
      <span className="line" />
      <span className="diamond" />
      <span className="line" />
    </div>
  );
}
