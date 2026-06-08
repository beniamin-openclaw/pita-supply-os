import { type ReactElement } from "react";
import logoUrl from "../../assets/pita-bros-logo.svg";

interface LogoProps {
  className?: string;
  /** Play the one-shot fade+scale reveal. Gate once-per-session at the call site. */
  animate?: boolean;
}

/** Pita Bros brand logo (fill-only SVG asset). Reveal is fade+scale, not draw-on
 * (the asset has no strokes — plan-review F1); reduced-motion is honored globally. */
export function Logo({ className = "", animate = false }: LogoProps): ReactElement {
  return (
    <img
      src={logoUrl}
      alt="Pita Bros"
      className={`${animate ? "logo-reveal" : ""} ${className}`.trim()}
    />
  );
}
