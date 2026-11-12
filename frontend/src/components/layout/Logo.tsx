import Image from "next/image";

/**
 * The company's logo.
 *
 * This replaces a hand-drawn approximation — a house outline with an "RE"
 * monogram in generic Tailwind amber (#f59e0b), captioned in the source as the
 * "Official Rams @Elec mark". It was not. The real mark is
 * public/brand/re-logo.svg, copied from the Manager app's own resources, and it
 * is red (#E31B38) and white.
 *
 * The red belongs to the mark. It is not an accent and must not spread into
 * buttons, links or headings — ui-direction.md is explicit that BrandGold is
 * the single accent and red is semantic. Both read clearly on the charcoal
 * ground, so the full-colour mark is used rather than the white-only variant.
 *
 * Intrinsic dimensions are passed so the browser reserves the right box before
 * the file loads. The logo sits in the header, above the fold, on every page —
 * without them it is a guaranteed layout shift on the slow mobile connections
 * most visitors arrive on, and CLS is a target here.
 */

const LOGO_WIDTH = 1024;
const LOGO_HEIGHT = 660.48;

export default function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src="/brand/re-logo.svg"
        alt="Rams @Elec"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        // The header logo is in the LCP region on every page; let it load eagerly.
        priority
        className="h-full w-auto"
      />

      {showText && (
        <span className="font-display text-lg font-bold tracking-tight text-white">
          Rams <span className="text-brand-500">@Elec</span>
        </span>
      )}
    </div>
  );
}
