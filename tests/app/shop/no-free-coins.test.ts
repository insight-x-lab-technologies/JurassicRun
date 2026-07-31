import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Arquivos que compõem a Loja e o resgate. Nenhum pode creditar moeda por conta própria:
// o ÚNICO caminho de moeda paga é purchaseService.redeem → gateway → wallet.earn, dentro do
// serviço, depois de o servidor validar o código (item 10.8). Ler o saldo é permitido; creditar
// não. A guarda é sobre a CHAMADA (`.earn(`), não sobre o import — é a chamada que credita.
const SHOP_FILES = [
  'src/app/screens/ShopScreen.tsx',
  ...readdirSync('src/app/shop').map((f) => join('src/app/shop', f)),
  ...readdirSync('src/app/purchase').map((f) => join('src/app/purchase', f)),
];

describe('a Loja não credita moedas', () => {
  it('nenhum arquivo da Loja chama earn(', () => {
    const offenders = SHOP_FILES.filter((f) => /\.earn\s*\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('a varredura enxerga mesmo os arquivos da Loja (a guarda não é vácua)', () => {
    expect(SHOP_FILES).toContain('src/app/screens/ShopScreen.tsx');
    expect(SHOP_FILES.length).toBeGreaterThan(2);
  });
});
