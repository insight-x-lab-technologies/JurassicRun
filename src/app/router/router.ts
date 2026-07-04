import { signal, type ReadonlySignal } from '@preact/signals';
import { HOME_SCREEN, type Screen } from './routes';

// Pilha de histórico de navegação; o topo é a rota corrente.
const stack: Screen[] = [HOME_SCREEN];
const _route = signal<Screen>(HOME_SCREEN);

/** Sinal somente-leitura com a rota corrente (topo da pilha). */
export const route: ReadonlySignal<Screen> = _route;

/** Empilha uma tela e a torna corrente. Navegar para a rota corrente é no-op. */
export function navigate(screen: Screen): void {
  if (stack[stack.length - 1] === screen) return;
  stack.push(screen);
  _route.value = screen;
}

/** Volta uma tela. Na raiz (Home) é no-op. */
export function back(): void {
  if (stack.length <= 1) return;
  stack.pop();
  _route.value = stack[stack.length - 1]!;
}

/** true sse há para onde voltar (pilha com mais de um item). */
export function canGoBack(): boolean {
  return stack.length > 1;
}

/** Reinicia a navegação para a raiz (Home). Usado por "sair para Home" e por testes. */
export function resetToHome(): void {
  stack.length = 0;
  stack.push(HOME_SCREEN);
  _route.value = HOME_SCREEN;
}
