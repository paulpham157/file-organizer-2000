interface ObsidianMoment {
  fromNow(): string;
  format(pattern: string): string;
  startOf(unit: string): ObsidianMoment;
  endOf(unit: string): ObsidianMoment;
  isBetween(
    start: ObsidianMoment,
    end: ObsidianMoment,
    unit?: null,
    inclusivity?: string
  ): boolean;
  isAfter(other: ObsidianMoment): boolean;
  subtract(amount: number, unit: string): ObsidianMoment;
}

declare global {
  interface Window {
    moment: (input?: number | string | Date) => ObsidianMoment;
  }
}

export {};
