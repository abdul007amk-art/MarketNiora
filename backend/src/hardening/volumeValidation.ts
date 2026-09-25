/**
 * MARKETNIORA VOLUME VALIDATION — HARDENING LAYER
 *
 * This module does NOT change Stock Score weights or the locked momentum
 * sequence. It prevents raw volume spikes from being treated as confirmation
 * when they are plausibly explained by circuits, block/bulk activity,
 * earnings/news events, or insufficient liquidity.
 */
export type VolumeEventKind =
  | 'NORMAL'
  | 'ABNORMAL_CANDIDATE'
  | 'VALID_CONFIRMATION'
  | 'DISTRIBUTION_RISK'
  | 'NON_CONFIRMING_EVENT';

export interface VolumeValidationInput {
  volume: number;
  average20dVolume: number;
  priceChangePct: number;
  liquiditySufficient: boolean;
  freeFloatSufficient: boolean;
  blockOrBulkDeal: boolean;
  circuitMove: boolean;
  materialEvent: boolean;
  deliveryPct?: number | null;
  delivery20dAvgPct?: number | null;
}

export interface VolumeValidationResult {
  ratio: number | null;
  abnormalCandidate: boolean;
  validConfirmation: boolean;
  distributionRisk: boolean;
  kind: VolumeEventKind;
  reasons: string[];
}

export function validateVolumeEvent(input: VolumeValidationInput): VolumeValidationResult {
  const reasons: string[] = [];
  if (!Number.isFinite(input.volume) || input.volume < 0) throw new Error('volume must be finite and >= 0');
  if (!Number.isFinite(input.average20dVolume) || input.average20dVolume <= 0) {
    throw new Error('average20dVolume must be finite and > 0');
  }
  if (!Number.isFinite(input.priceChangePct)) throw new Error('priceChangePct must be finite');

  const ratio = input.volume / input.average20dVolume;
  const abnormalCandidate = ratio >= 2;

  if (!abnormalCandidate) reasons.push('volume is below 2x 20D average');
  if (!input.liquiditySufficient) reasons.push('liquidity gate failed');
  if (!input.freeFloatSufficient) reasons.push('free-float gate failed');
  if (input.blockOrBulkDeal) reasons.push('block/bulk deal event — volume is non-confirming');
  if (input.circuitMove) reasons.push('circuit movement — volume is non-confirming');
  if (input.materialEvent) reasons.push('material event day — event-adjusted, not standalone confirmation');

  const distributionRisk = ratio >= 1.5 && input.priceChangePct < 0;
  if (distributionRisk) reasons.push('volume expansion with negative price action');

  const eventContaminated = input.blockOrBulkDeal || input.circuitMove || input.materialEvent;
  const validConfirmation =
    abnormalCandidate &&
    input.liquiditySufficient &&
    input.freeFloatSufficient &&
    !eventContaminated &&
    input.priceChangePct > 0;

  if (validConfirmation) reasons.push('volume >=2x with positive price action and no disqualifying event');
  if (!validConfirmation && abnormalCandidate && !distributionRisk && !eventContaminated) {
    reasons.push('abnormal volume is a candidate event but confirmation conditions are incomplete');
  }

  let kind: VolumeEventKind = 'NORMAL';
  if (distributionRisk) kind = 'DISTRIBUTION_RISK';
  else if (validConfirmation) kind = 'VALID_CONFIRMATION';
  else if (abnormalCandidate) kind = eventContaminated ? 'NON_CONFIRMING_EVENT' : 'ABNORMAL_CANDIDATE';

  return { ratio, abnormalCandidate, validConfirmation, distributionRisk, kind, reasons };
}

/**
 * Locked sequence helper:
 * abnormal event -> 2–4 cooling sessions -> second expansion -> entry trigger.
 * This function only validates the sequence; it does not generate a score.
 */
export interface MomentumSequenceInput {
  firstEventValid: boolean;
  coolingSessions: number;
  structuralBreakdownDuringCooling: boolean;
  secondExpansionRatio: number;
  secondExpansionPositivePriceAction: boolean;
  breakoutOrRetest: boolean;
  ema20PullbackEntry: boolean;
}

export function validateMomentumSequence(input: MomentumSequenceInput): {
  eligible: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!input.firstEventValid) reasons.push('first abnormal-volume event is not valid confirmation');
  if (input.coolingSessions < 2 || input.coolingSessions > 4) reasons.push('cooling period must be 2–4 sessions');
  if (input.structuralBreakdownDuringCooling) reasons.push('structural breakdown occurred during cooling');
  if (input.secondExpansionRatio < 1.5) reasons.push('second volume expansion is below 1.5x average');
  if (!input.secondExpansionPositivePriceAction) reasons.push('second expansion lacks positive price action');
  if (!input.breakoutOrRetest && !input.ema20PullbackEntry) reasons.push('no breakout/retest or EMA20 pullback entry');

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
