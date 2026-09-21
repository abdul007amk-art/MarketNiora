/**
 * NOTIFICATION PROVIDER
 * Status: IMPLEMENTATION — unit tested below (HTTP layer is dependency-
 * injected, so tests never make a real network call — this sandbox has
 * none anyway).
 *
 * GOVERNANCE: bot tokens/credentials are never hardcoded — they're passed
 * in from the caller, which should load them via
 * security/secretsLoader.ts (see providerConfig.ts). Never logged.
 */

export interface NotificationMessage {
  to: string;
  subject?: string;
  body: string;
}

export interface NotificationResult {
  success: boolean;
  providerMessageId: string | null;
  reason: string;
}

export interface NotificationProvider {
  name: string;
  send(message: NotificationMessage): Promise<NotificationResult>;
}

/** Never actually sends — used when no provider is configured. Fails closed rather than pretending to have sent something. */
export class NullNotificationProvider implements NotificationProvider {
  public readonly name = 'NONE_CONFIGURED_NOTIFICATION';

  async send(_message: NotificationMessage): Promise<NotificationResult> {
    return { success: false, providerMessageId: null, reason: 'no notification provider configured — message not sent' };
  }
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** Minimal seam so this module never depends on a real HTTP client or the global fetch type directly. A real deployment wraps native fetch behind this interface (Module 13 — API layer). */
export interface HttpClient {
  post(url: string, body: Record<string, unknown>): Promise<HttpResponse>;
}

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: { message_id?: number };
  description?: string;
}

/**
 * Zero-cost alert channel (see infra/DEPLOYMENT_NOTES.md). Fails closed
 * on missing token, non-ok HTTP status, an `ok: false` API response, or
 * any thrown error — never throws out of send(), always returns a
 * NotificationResult the caller can inspect.
 */
export class TelegramNotificationProvider implements NotificationProvider {
  public readonly name = 'TELEGRAM';
  private botToken: string;
  private httpClient: HttpClient;

  constructor(botToken: string, httpClient: HttpClient) {
    if (!botToken || botToken.trim().length === 0) {
      throw new Error('botToken is required — refusing to construct a provider that would send unauthenticated requests');
    }
    this.botToken = botToken;
    this.httpClient = httpClient;
  }

  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      const response = await this.httpClient.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: message.to,
        text: message.body,
      });

      if (!response.ok) {
        return { success: false, providerMessageId: null, reason: `Telegram API returned HTTP status ${response.status}` };
      }

      const data = (await response.json()) as TelegramSendMessageResponse;
      if (!data.ok) {
        return { success: false, providerMessageId: null, reason: `Telegram API reported failure: ${data.description ?? 'no description'}` };
      }

      return {
        success: true,
        providerMessageId: data.result?.message_id !== undefined ? String(data.result.message_id) : null,
        reason: 'sent',
      };
    } catch (err) {
      return { success: false, providerMessageId: null, reason: err instanceof Error ? err.message : 'unknown error sending notification' };
    }
  }
}
