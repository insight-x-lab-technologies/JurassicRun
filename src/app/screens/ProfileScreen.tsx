import { useRef, useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { profileService, avatarFor, type Profile } from '@services/profile';

function Avatar({ profile }: { profile: Profile }): VNode {
  const { initial, hue } = avatarFor(profile);
  return (
    <span class="avatar" style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}>
      {initial}
    </span>
  );
}

export function ProfileScreen(): VNode {
  const active = profileService.activeProfile.value;
  const profiles = profileService.profiles.value;
  const [renameValue, setRenameValue] = useState(active?.name ?? '');
  const [createValue, setCreateValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  function submitRename(e: Event): void {
    e.preventDefault();
    // Lê o valor atual do DOM (não o closure): o input pode ter sido atualizado
    // no mesmo tick do submit, antes do re-render do estado controlado.
    const raw = renameInputRef.current?.value ?? renameValue;
    profileService.renameActive(raw);
  }

  function submitCreate(e: Event): void {
    e.preventDefault();
    const raw = createInputRef.current?.value ?? createValue;
    if (profileService.create(raw)) {
      setCreateValue('');
      if (createInputRef.current !== null) createInputRef.current.value = '';
    }
  }

  return (
    <div class="screen">
      <h1 class="screen__title">{i18n.t('screen.profile')}</h1>

      {active !== null && (
        <div class="profile-header">
          <Avatar profile={active} />
          <span>{active.name}</span>
        </div>
      )}

      <form class="form" data-testid="rename-form" onSubmit={submitRename}>
        <input
          ref={renameInputRef}
          class="form__input"
          data-testid="rename-input"
          type="text"
          value={renameValue}
          onInput={(e) => setRenameValue((e.target as HTMLInputElement).value)}
        />
        <button class="btn" type="submit">
          {i18n.t('profile.save')}
        </button>
      </form>

      <h2>{i18n.t('profile.players')}</h2>
      <ul class="profile-list">
        {profiles.map((p) => (
          <li
            key={p.id}
            class={
              'profile-list__item' + (p.id === active?.id ? ' profile-list__item--active' : '')
            }
          >
            <Avatar profile={p} />
            {p.id === active?.id ? (
              <>
                <span>{p.name}</span>
                <span class="profile-list__badge">{i18n.t('profile.active')}</span>
              </>
            ) : (
              <button class="btn btn--ghost" data-switch onClick={() => profileService.switchTo(p.id)}>
                {p.name}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form class="form" data-testid="create-form" onSubmit={submitCreate}>
        <input
          ref={createInputRef}
          class="form__input"
          data-testid="create-input"
          type="text"
          value={createValue}
          placeholder={i18n.t('profile.newPlayer')}
          onInput={(e) => setCreateValue((e.target as HTMLInputElement).value)}
        />
        <button class="btn" type="submit">
          {i18n.t('profile.create')}
        </button>
      </form>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
