import { useBillingAccount } from './useBillingAccount';

// Phase J: the missing link between billing_accounts.status and what the
// UI actually does about it. useBillingAccount() already reads the real
// row; this derives a UI-facing verdict from it. Deliberately NOT a hard
// lockout on 'past_due' — no payment provider is wired up yet (see
// useBillingAccount's note: provider is 'none' on both live orgs), so a
// past_due org has no way to self-resolve that by paying. Blocking them
// out entirely would be punishing a state the product itself created.
// 'cancelled' is the one status that gates: it's an intentional
// deactivation, not a lapsed card.
export type EntitlementLevel = 'ok' | 'warn' | 'blocked';

export interface Entitlements {
  level: EntitlementLevel;
  message: string | null;
  trialDaysRemaining: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useEntitlements(): { data: Entitlements | null; isLoading: boolean } {
  const { data: billing, isLoading } = useBillingAccount();

  if (!billing) return { data: null, isLoading };

  if (billing.status === 'cancelled') {
    return {
      isLoading,
      data: {
        level: 'blocked',
        message: 'This organisation\u2019s subscription has been cancelled. Contact your administrator to reactivate access.',
        trialDaysRemaining: null,
      },
    };
  }

  if (billing.status === 'past_due') {
    return {
      isLoading,
      data: {
        level: 'warn',
        message: 'Payment is past due. Some features may be limited soon \u2014 contact your administrator.',
        trialDaysRemaining: null,
      },
    };
  }

  if (billing.status === 'trial') {
    const trialEnd = billing.trial_ends_at ? new Date(billing.trial_ends_at).getTime() : null;
    const daysRemaining = trialEnd ? Math.ceil((trialEnd - Date.now()) / DAY_MS) : null;
    if (daysRemaining !== null && daysRemaining <= 7) {
      return {
        isLoading,
        data: {
          level: daysRemaining <= 0 ? 'warn' : 'ok',
          message:
            daysRemaining <= 0
              ? 'Your trial has ended. Contact your administrator to continue using AfriOps.'
              : `Trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
          trialDaysRemaining: daysRemaining,
        },
      };
    }
    return { isLoading, data: { level: 'ok', message: null, trialDaysRemaining: daysRemaining } };
  }

  return { isLoading, data: { level: 'ok', message: null, trialDaysRemaining: null } };
}
