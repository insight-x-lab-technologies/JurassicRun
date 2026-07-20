import { useEffect, useRef, useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { back } from '../router';
import { i18n } from '@services/i18n';
import { profileService, avatarFor, type Profile } from '@services/profile';
import { onlineService } from '@services/online';
import { getHomeStats } from '../home/stats';

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
  const onlineStatus = onlineService.status.value;
  const globalId = onlineService.globalPlayerId.value;
  const [renameValue, setRenameValue] = useState(active?.name ?? '');
  const [createValue, setCreateValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Resincroniza o campo de renomear quando o perfil ativo muda (troca via
  // botão da lista não remonta o componente). Só dispara quando a identidade
  // do ativo muda, então não briga com a digitação do usuário.
  useEffect(() => {
    setRenameValue(active?.name ?? '');
  }, [active?.id]);

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
      // Limpa o DOM imediatamente também (não só o estado controlado): sem isso,
      // testes/observadores que leem o valor do input no mesmo tick do submit
      // ainda veriam o texto antigo até o próximo re-render.
      if (createInputRef.current !== null) createInputRef.current.value = '';
    }
  }

  const stats = getHomeStats();

  return (
    <div class="screen profile">
      <h1 class="screen__title">{i18n.t('screen.profile')}</h1>

      {/* Item 6.1: duas colunas — identidade/estado à esquerda, ações à direita. */}
      <div class="profile__grid">
        <section class="profile__col profile__col--identity">
          {active !== null && (
            <div class="profile-card">
              <div class="profile-card__avatar">
                <Avatar profile={active} />
              </div>
              <p class="profile-card__name">{active.name}</p>

              <dl class="profile-card__stats">
                <div class="profile-card__stat">
                  <dt>{i18n.t('home.coins')}</dt>
                  <dd>{stats.coins}</dd>
                </div>
                <div class="profile-card__stat">
                  <dt>{i18n.t('home.trophies')}</dt>
                  <dd>{stats.trophies}</dd>
                </div>
                <div class="profile-card__stat">
                  <dt>{i18n.t('home.level')}</dt>
                  <dd>{stats.maxLevel}</dd>
                </div>
              </dl>
            </div>
          )}

          <div class="online-status" data-testid="online-status">
            <span class="online-status__label">{i18n.t('online.title')}</span>
            <span class={`online-status__value online-status__value--${onlineStatus}`}>
              {i18n.t(`online.status.${onlineStatus}`)}
            </span>
            {globalId !== null && (
              <span class="online-status__id">
                {i18n.t('online.globalId')}: {globalId.slice(0, 8)}
              </span>
            )}
          </div>
        </section>

        <section class="profile__col profile__col--actions">
          <h2 class="profile__heading">{i18n.t('profile.rename')}</h2>
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

          <h2 class="profile__heading">{i18n.t('profile.players')}</h2>
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
                    <span class="profile-list__name">{p.name}</span>
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
        </section>
      </div>

      <button class="btn btn--ghost" onClick={() => back()}>
        {i18n.t('nav.back')}
      </button>
    </div>
  );
}
