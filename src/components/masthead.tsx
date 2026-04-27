import { WEDDING_DATE, COUPLE_DISPLAY } from "@/lib/config";
import { daysUntil, formatDateLong } from "@/lib/utils";
import { Ornament } from "./ornament";

/**
 * Masthead — eyebrow, big serif headline, ornament, countdown line.
 * Re-renders on every navigation so the countdown stays current; we don't
 * need a client-side tick because days only change once a day.
 */
export function Masthead() {
  const days = daysUntil(WEDDING_DATE);
  const longDate = formatDateLong(WEDDING_DATE);

  return (
    <header className="text-center pt-8 pb-10 border-b border-line mb-10">
      <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-burgundy mb-4">
        Notre Vie à Deux · Wedding Planning Hub
      </p>

      <h1 className="font-serif font-normal leading-none tracking-[-0.02em] text-ink"
          style={{ fontSize: "clamp(48px, 7vw, 88px)" }}>
        {COUPLE_DISPLAY.one} <em>&amp;</em> {COUPLE_DISPLAY.two}
      </h1>

      <Ornament />

      <p className="font-script text-[22px] text-burgundy">
        {days > 0 ? (
          <>
            <strong className="font-semibold text-[28px]">{days}</strong>{" "}
            day{days === 1 ? "" : "s"} until our wedding · {longDate}
          </>
        ) : days === 0 ? (
          <>Today is the day · {longDate} ♥</>
        ) : (
          <>Married since {longDate} ♥</>
        )}
      </p>
    </header>
  );
}
