import { signal, type ReadonlySignal } from '@preact/signals';

export interface TrophyOnline {
  readonly online: ReadonlySignal<boolean>;
  submitTrophies(ids: readonly string[]): Promise<void>;
  fetchTrophies(): Promise<readonly string[]>;
}

export interface MemoryTrophyOnline extends TrophyOnline {
  readonly submitted: string[][];
  setOnline(v: boolean): void;
}

export function memoryTrophyOnline(
  opts: { online?: boolean; trophies?: readonly string[] } = {},
): MemoryTrophyOnline {
  const _online = signal(opts.online ?? false);
  const submitted: string[][] = [];
  return {
    online: _online,
    submitted,
    setOnline(v) {
      _online.value = v;
    },
    async submitTrophies(ids) {
      submitted.push([...ids]);
    },
    async fetchTrophies() {
      return opts.trophies ?? [];
    },
  };
}
