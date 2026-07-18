import type { VNode } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { i18n } from '@services/i18n';
import { purchaseService, type PurchaseStatus } from '@services/purchase';

export function RedeemCodeForm(): VNode {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<PurchaseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // Lê o valor atual do DOM (não o `code` do closure): o input pode ter sido
  // atualizado no mesmo tick do submit, antes do re-render do estado controlado
  // (molde de OnboardingScreen, gotcha de 4.2).
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const raw = inputRef.current?.value ?? code;
    const result = await purchaseService.redeem(raw);
    setStatus(result.status);
    if (result.status === 'ok') setCode('');
    setBusy(false);
  }

  return (
    <form class="redeem" onSubmit={submit}>
      <h2 class="redeem__title">{i18n.t('purchase.redeemTitle')}</h2>
      <p class="redeem__help">{i18n.t('purchase.help')}</p>
      <div class="redeem__row">
        <input
          ref={inputRef}
          class="redeem__input"
          data-testid="redeem-input"
          type="text"
          value={code}
          placeholder={i18n.t('purchase.redeemPlaceholder')}
          onInput={(e) => setCode((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn" data-testid="redeem-submit" disabled={busy}>
          {i18n.t('purchase.redeemButton')}
        </button>
      </div>
      {status !== null && (
        <p class="redeem__status" data-testid="redeem-status">
          {i18n.t(`purchase.result.${status}`)}
        </p>
      )}
    </form>
  );
}
