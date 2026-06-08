import { type ReactElement, type ReactNode } from "react";

interface AppHeaderProps {
  children: ReactNode;
  /** Extra classes for the brand bar (padding, sticky, z-index — per screen). */
  className?: string;
}

/**
 * Thin shared brand bar — owns only the `bg-brand text-white` chrome. All
 * role-specific layout and content is passed as children; this component holds
 * no role logic (kept deliberately thin per plan-review F5).
 */
export function AppHeader({ children, className = "" }: AppHeaderProps): ReactElement {
  return <header className={`bg-brand text-white ${className}`.trim()}>{children}</header>;
}
