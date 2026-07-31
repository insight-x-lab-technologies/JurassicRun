import type { VNode } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { i18n } from '@services/i18n';
import { purchaseService, type PurchaseStatus } from '@services/purchase';

export function RedeemCodeForm(): VNode {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<PurchaseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // 10.8: sem gateway o formulário NÃO some da tela (antes o `ShopScreen` o escondia por
  // completo) — fica visível e desabilitado, com aviso. A decisão pertence ao formulário.
  const offline = !purchaseService.available.value;
  // Lê o valor atual do DOM (não o `code` do closure): o input pode ter sido
  // atualizado no mesmo tick do submit, antes do re-render do estado controlado
  // (molde de OnboardingScreen, gotcha de 4.2).
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy || offline) return;
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
          disabled={offline}
          onInput={(e) => setCode((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn" data-testid="redeem-submit" disabled={busy || offline}>
          {i18n.t('purchase.redeemButton')}
        </button>
      </div>
      {offline && (
        <p class="redeem__offline" data-testid="redeem-offline">
          {i18n.t('shop.gatewayOffline')}
        </p>
      )}
      {status !== null && (
        <p class="redeem__status" data-testid="redeem-status">
          {i18n.t(`purchase.result.${status}`)}
        </p>
      )}
    </form>
  );
}
