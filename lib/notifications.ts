export type Notif = {
  id: string; // stable, so dismissing / "already notified" survive refreshes
  kind: "class" | "caffeine" | "deadline" | "opportunity" | "event";
  severity: "info" | "warn" | "alert";
  title: string;
  detail: string;
  href: string;
  /** Also pop a browser notification (when permitted). */
  push?: boolean;
};
