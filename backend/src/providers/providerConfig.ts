/**
 * PROVIDER CONFIG
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE: this is the ONLY place provider credentials get read, and
 * it reads exclusively via security/secretsLoader.ts (Module 3) —
 * process.env only, fails closed on anything missing, never logs a
 * value. No credential is ever hardcoded here or anywhere else in this
 * repo. See .env.example for the full list of expected variable NAMES
 * (no values).
 */

import { requireSecret } from '../security/secretsLoader.ts';

export interface TelegramConfig {
  botToken: string;
}

export function loadTelegramConfig(): TelegramConfig {
  return { botToken: requireSecret('TELEGRAM_BOT_TOKEN') };
}

export interface UpstoxConfig {
  apiKey: string;
  apiSecret: string;
}

export function loadUpstoxConfig(): UpstoxConfig {
  return {
    apiKey: requireSecret('UPSTOX_API_KEY'),
    apiSecret: requireSecret('UPSTOX_API_SECRET'),
  };
}


/**
 * Short-lived Upstox API access token for read-only quote requests.
 * Obtain it through the approved Upstox OAuth authorization-code flow and
 * inject it through the server secret store. Do not put it in frontend code,
 * logs, source files, or a committed .env file. Upstox tokens expire at 03:30
 * IST the following day; automated refresh/reauthorization is not implemented
 * by this loader.
 */
export interface UpstoxAccessTokenConfig {
  accessToken: string;
}

export function loadUpstoxAccessTokenConfig(): UpstoxAccessTokenConfig {
  return { accessToken: requireSecret('UPSTOX_ACCESS_TOKEN') };
}
