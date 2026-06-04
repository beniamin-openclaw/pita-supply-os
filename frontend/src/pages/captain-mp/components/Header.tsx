// Sticky header. Locale-aware via useT().

import { useT } from "../../../i18n";
import { HamburgerMenu } from "./HamburgerMenu";

interface HeaderProps {
  locationName: string;
  /** Captain token — first chars shown as a masked id badge. */
  token: string;
  onShowOrders?: () => void;
}

export function Header({ locationName, token, onShowOrders }: HeaderProps) {
  const { t, formatDateTime } = useT();
  const maskedToken = token.slice(0, 4).toUpperCase() || "—";
  // Header date pill: short weekday + numeric date, no time. We pass individual
  // field options so we must NOT include dateStyle (Intl.DateTimeFormat throws
  // when dateStyle/timeStyle is mixed with weekday/year/month/day).
  const dateStr = formatDateTime(new Date(), {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <header className="bg-[#1a4480] text-white px-4 py-3 sticky top-0 z-40">
      <div className="flex justify-between items-center mb-3">
        <h1 className="font-semibold text-lg tracking-tight">{t("header.title")}</h1>
        <HamburgerMenu onShowOrders={onShowOrders} />
      </div>

      <div className="flex gap-2 text-xs font-medium overflow-x-auto hide-scrollbar -mx-1 px-1">
        <div className="bg-white/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <span aria-hidden="true">📍</span>
          <span className="sr-only">{t("header.locationLabel")}</span>
          {locationName || "—"}
        </div>
        <div className="bg-white/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <span aria-hidden="true">👤</span>
          <span className="sr-only">{t("header.captainLabel")}</span>
          {maskedToken}
        </div>
        <div className="bg-white/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <span aria-hidden="true">📅</span>
          <span className="sr-only">{t("header.dayLabel")}</span>
          {dateStr}
        </div>
      </div>
    </header>
  );
}
