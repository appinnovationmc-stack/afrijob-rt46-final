import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Capacitor's Haptics plugin no-ops (rejects) on plain web, so every call
// here is wrapped — callers never need to think about platform.
async function safe(fn: () => Promise<void>) {
  try {
    await fn();
  } catch {
    // no native haptics engine available (web) — silently ignore
  }
}

export const haptics = {
  /** Light tap — selection changes, toggles, minor UI feedback. */
  light: () => safe(() => Haptics.impact({ style: ImpactStyle.Light })),
  /** Medium tap — a photo was captured, an item was added. */
  medium: () => safe(() => Haptics.impact({ style: ImpactStyle.Medium })),
  /** Success — job status advanced, job submitted, report generated. */
  success: () => safe(() => Haptics.notification({ type: NotificationType.Success })),
  /** Error — a mutation failed. */
  error: () => safe(() => Haptics.notification({ type: NotificationType.Error })),
};
