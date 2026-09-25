/**
 * MARKETNIORA DECISION STATE MACHINE — HARDENED
 *
 * WATCH -> WAIT -> READY is the normal progression.
 * READY can return to WAIT on partial confirmation loss or become
 * INVALIDATED on a hard thesis/risk failure.
 *
 * Theme and Rotation are context only and never mutate this state directly.
 */
export type DecisionState = 'WATCH' | 'WAIT' | 'READY' | 'INVALIDATED';

export type TransitionReason =
  | 'THESIS_CONFIRMATION'
  | 'SETUP_DETERIORATION'
  | 'ALL_READY_GATES'
  | 'PARTIAL_CONFIRMATION_LOSS'
  | 'HARD_INVALIDATION'
  | 'OPPORTUNITY_COST';

export interface StateTransitionInput {
  from: DecisionState;
  technicalConfirmed: boolean;
  volumeConfirmed: boolean;
  relativeStrengthConfirmed: boolean;
  fundamentalRiskAcceptable: boolean;
  entryAvailable: boolean;
  hardInvalidation: boolean;
  opportunityCostHigh: boolean;
}

export interface StateTransitionResult {
  to: DecisionState;
  reason: TransitionReason;
}

export function transitionDecision(input: StateTransitionInput): StateTransitionResult {
  if (input.hardInvalidation) {
    return { to: 'INVALIDATED', reason: 'HARD_INVALIDATION' };
  }

  if (input.from === 'READY') {
    const all = input.technicalConfirmed &&
      input.volumeConfirmed &&
      input.relativeStrengthConfirmed &&
      input.fundamentalRiskAcceptable &&
      input.entryAvailable;

    if (all) return { to: 'READY', reason: 'ALL_READY_GATES' };
    return { to: 'WAIT', reason: 'PARTIAL_CONFIRMATION_LOSS' };
  }

  if (input.from === 'WAIT') {
    const all = input.technicalConfirmed &&
      input.volumeConfirmed &&
      input.relativeStrengthConfirmed &&
      input.fundamentalRiskAcceptable &&
      input.entryAvailable;

    if (all) return { to: 'READY', reason: 'ALL_READY_GATES' };
    if (input.opportunityCostHigh || (!input.technicalConfirmed && !input.volumeConfirmed)) {
      return { to: 'WATCH', reason: input.opportunityCostHigh ? 'OPPORTUNITY_COST' : 'SETUP_DETERIORATION' };
    }
    return { to: 'WAIT', reason: 'THESIS_CONFIRMATION' };
  }

  if (input.from === 'WATCH') {
    const initialConfirmation = input.technicalConfirmed || input.relativeStrengthConfirmed || input.fundamentalRiskAcceptable;
    return initialConfirmation
      ? { to: 'WAIT', reason: 'THESIS_CONFIRMATION' }
      : { to: 'WATCH', reason: 'SETUP_DETERIORATION' };
  }

  return { to: 'INVALIDATED', reason: 'HARD_INVALIDATION' };
}
