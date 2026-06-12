export function formatRelativeTime(timestamp: number): string {
  return window.moment(timestamp).fromNow();
}
