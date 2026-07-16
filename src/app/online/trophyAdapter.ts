import { onlineService } from '@services/online';
import type { TrophyOnline } from '@services/trophy/online';

interface OnlineTrophiesLike {
  readonly online: { readonly value: boolean };
  submitTrophies(ids: readonly string[]): Promise<void>;
  fetchTrophies(): Promise<readonly string[]>;
}

export function createTrophyOnline(deps: { onlineSvc?: OnlineTrophiesLike } = {}): TrophyOnline {
  const svc = (deps.onlineSvc ?? onlineService) as OnlineTrophiesLike;
  return {
    online: svc.online as TrophyOnline['online'],
    submitTrophies(ids) {
      return svc.submitTrophies(ids);
    },
    fetchTrophies() {
      return svc.fetchTrophies();
    },
  };
}
