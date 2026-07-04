import { useRef, useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { i18n } from '@services/i18n';
import { profileService, type NameError } from '@services/profile';

export function OnboardingScreen(): VNode {
  const [name, setName] = useState('');
  const [error, setError] = useState<NameError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e: Event): void {
    e.preventDefault();
    // Lê o valor atual do DOM (não o `name` do closure): o input pode ter sido
    // atualizado no mesmo tick do submit, antes do re-render do estado controlado.
    const raw = inputRef.current?.value ?? name;
    const v = profileService.validateName(raw);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    profileService.create(v.name);
  }

  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t('onboarding.title')}</h1>
      <p>{i18n.t('onboarding.prompt')}</p>
      <form class="form" onSubmit={submit}>
        <input
          ref={inputRef}
          class="form__input"
          type="text"
          value={name}
          placeholder={i18n.t('onboarding.placeholder')}
          onInput={(e) => {
            setName((e.target as HTMLInputElement).value);
            setError(null);
          }}
        />
        {error !== null && <p class="form__error">{i18n.t(`onboarding.error.${error}`)}</p>}
        <button class="btn" type="submit">
          {i18n.t('onboarding.start')}
        </button>
      </form>
    </div>
  );
}
