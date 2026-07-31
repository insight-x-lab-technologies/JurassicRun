import { useState } from 'preact/hooks';
import type { VNode } from 'preact';
import { avatarFor, avatarDef, type AvatarId, type Profile } from '@services/profile';

/** Caminho do PNG do avatar. `BASE_URL` porque o app é servido sob subcaminho no GitHub Pages. */
export function avatarSrc(id: AvatarId): string {
  return `${import.meta.env.BASE_URL}ui/avatar.${id}.png`;
}

/**
 * Avatar do jogador: o PNG escolhido dentro de um disco da matiz do avatar. Se a imagem não
 * carregar (arte ausente, cache/rede), cai para a inicial do nome — a identidade nunca some.
 */
export function Avatar({ profile }: { profile: Profile }): VNode {
  const [failed, setFailed] = useState(false);
  const def = avatarDef(profile.avatarId);
  const { initial } = avatarFor(profile);
  return (
    <span class="avatar" style={{ backgroundColor: `hsl(${def.hue}, 55%, 45%)` }}>
      {failed ? (
        initial
      ) : (
        <img
          class="avatar__img"
          src={avatarSrc(profile.avatarId)}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
