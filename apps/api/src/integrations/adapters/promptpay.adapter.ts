import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { buildPromptPayPayload } from '@repo/domain';
import type { PromptPayQrService } from '../ports/promptpay-qr.port';

/**
 * PromptPayAdapter (ARCHITECTURE §4.3) — real, gateway-free `PromptPayQrService`.
 * The EMVCo payload itself is pure/deterministic (`@repo/domain`'s
 * `buildPromptPayPayload`, testable against published PromptPay test
 * vectors); this adapter's only job is rendering that payload string to a
 * scannable QR image (`qrcode` npm package, PNG data URL) — there is no
 * payment-gateway account, API key, or network call involved.
 */
@Injectable()
export class PromptPayAdapter implements PromptPayQrService {
  async generate(input: { promptPayId: string; amountThb: number }): Promise<{
    payload: string;
    qrImageDataUrl: string;
  }> {
    const payload = buildPromptPayPayload(input);
    const qrImageDataUrl = await QRCode.toDataURL(payload);
    return { payload, qrImageDataUrl };
  }
}
