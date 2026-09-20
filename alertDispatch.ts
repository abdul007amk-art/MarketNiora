/**
 * ALERT DISPATCH — final "NOTIFICATION" stage of the AI Research flow
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Wires Module 6's NotificationProvider (e.g. TelegramNotificationProvider)
 * to send an alert once a research event is APPROVED. Only APPROVED events
 * are ever dispatched — PENDING/REJECTED never reach a notification
 * provider, so a rejected or not-yet-reviewed AI finding can never
 * silently alert a user as if it were confirmed.
 */

import type { NotificationProvider, NotificationResult } from '../providers/notificationProvider.ts';
import type { ResearchEvent } from './researchEvent.ts';
import { validateResearchEvent } from './researchEvent.ts';

export interface DispatchResult {
  dispatched: boolean;
  reason: string;
  notificationResult: NotificationResult | null;
}

/**
 * Post-audit fix (Finding 11-C): previously only checked reviewStatus.
 * A caller could theoretically hand this function a forged/inconsistent
 * object (reviewStatus: 'APPROVED' but provenance.verificationStatus
 * still 'UNVERIFIED') and it would dispatch anyway. Now requires ALL
 * THREE: reviewStatus === APPROVED, verificationStatus === VERIFIED, and
 * the event passes full structural validation — otherwise refuses,
 * regardless of what reviewStatus alone claims.
 */
export async function dispatchApprovedEventAlert(
  event: ResearchEvent,
  recipient: string,
  provider: NotificationProvider
): Promise<DispatchResult> {
  if (event.reviewStatus !== 'APPROVED') {
    return { dispatched: false, reason: `event reviewStatus is ${event.reviewStatus}, not APPROVED — refusing to alert`, notificationResult: null };
  }
  if (event.provenance.verificationStatus !== 'VERIFIED') {
    return {
      dispatched: false,
      reason: `event reviewStatus is APPROVED but verificationStatus is ${event.provenance.verificationStatus}, not VERIFIED — inconsistent state, refusing to alert`,
      notificationResult: null,
    };
  }
  const validation = validateResearchEvent(event);
  if (!validation.valid) {
    return { dispatched: false, reason: `event failed structural validation: ${validation.errors.join('; ')}`, notificationResult: null };
  }

  const body = `${event.headline}\n\n${event.summary}`;
  const notificationResult = await provider.send({ to: recipient, body });

  return {
    dispatched: notificationResult.success,
    reason: notificationResult.success ? 'sent' : `notification provider failed: ${notificationResult.reason}`,
    notificationResult,
  };
}
