export type InboxNotificationLevel =
  | "silent"
  | "error"
  | "warning"
  | "info"
  | "debug";

const INBOX_NOTIFICATION_LEVELS: InboxNotificationLevel[] = [
  "silent",
  "error",
  "warning",
  "info",
  "debug",
];

export function shouldShowInboxNotification(
  level: InboxNotificationLevel,
  eventLevel: InboxNotificationLevel
): boolean {
  if (level === "silent") {
    return false;
  }
  return (
    INBOX_NOTIFICATION_LEVELS.indexOf(level) >=
    INBOX_NOTIFICATION_LEVELS.indexOf(eventLevel)
  );
}

export function migrateInboxNotificationLevel(
  loaded: Record<string, unknown> | null | undefined
): InboxNotificationLevel | undefined {
  if (!loaded || "inboxNotificationLevel" in loaded) {
    return undefined;
  }
  if (loaded.enableProcessingNotifications === false) {
    return "silent";
  }
  if (loaded.enableProcessingNotifications === true) {
    return "debug";
  }
  return undefined;
}
