import {
  shouldShowInboxNotification,
  migrateInboxNotificationLevel,
} from "./notification-level";

describe("shouldShowInboxNotification", () => {
  it("shows nothing at silent", () => {
    expect(shouldShowInboxNotification("silent", "error")).toBe(false);
    expect(shouldShowInboxNotification("silent", "debug")).toBe(false);
  });

  it("shows errors at error level and above", () => {
    expect(shouldShowInboxNotification("error", "error")).toBe(true);
    expect(shouldShowInboxNotification("warning", "error")).toBe(true);
    expect(shouldShowInboxNotification("error", "warning")).toBe(false);
  });

  it("shows warnings at warning level and above", () => {
    expect(shouldShowInboxNotification("warning", "warning")).toBe(true);
    expect(shouldShowInboxNotification("info", "warning")).toBe(true);
    expect(shouldShowInboxNotification("warning", "info")).toBe(false);
  });

  it("shows info at info level and above", () => {
    expect(shouldShowInboxNotification("info", "info")).toBe(true);
    expect(shouldShowInboxNotification("debug", "info")).toBe(true);
    expect(shouldShowInboxNotification("info", "debug")).toBe(false);
  });

  it("shows debug only at debug level", () => {
    expect(shouldShowInboxNotification("debug", "debug")).toBe(true);
  });
});

describe("migrateInboxNotificationLevel", () => {
  it("returns undefined when inboxNotificationLevel already exists", () => {
    expect(
      migrateInboxNotificationLevel({ inboxNotificationLevel: "warning" })
    ).toBeUndefined();
  });

  it("migrates false to silent", () => {
    expect(
      migrateInboxNotificationLevel({ enableProcessingNotifications: false })
    ).toBe("silent");
  });

  it("migrates true to debug", () => {
    expect(
      migrateInboxNotificationLevel({ enableProcessingNotifications: true })
    ).toBe("debug");
  });

  it("returns undefined when old setting was never saved", () => {
    expect(migrateInboxNotificationLevel({})).toBeUndefined();
    expect(migrateInboxNotificationLevel(null)).toBeUndefined();
  });
});
