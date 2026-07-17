import { useEffect, useState } from 'preact/hooks';
import { shouldSuggestRotate } from '@render/orientation';

/**
 * Retorna true quando convém sugerir girar para paisagem (celular em retrato).
 * Assina `matchMedia` (sem polling): reage a girar o aparelho / mudar de janela.
 */
export function useRotateHint(): boolean {
  const [suggest, setSuggest] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const portraitMq = window.matchMedia('(orientation: portrait)');
    const coarseMq = window.matchMedia('(pointer: coarse)');
    const update = (): void => {
      setSuggest(
        shouldSuggestRotate({ portrait: portraitMq.matches, coarsePointer: coarseMq.matches }),
      );
    };
    update();
    portraitMq.addEventListener('change', update);
    coarseMq.addEventListener('change', update);
    return () => {
      portraitMq.removeEventListener('change', update);
      coarseMq.removeEventListener('change', update);
    };
  }, []);

  return suggest;
}
