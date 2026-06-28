import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'dev-dist/'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use o serviço de RNG com seed (determinismo).' },
        { object: 'Date', property: 'now', message: 'Use o relógio da simulação (determinismo).' },
        { object: 'performance', property: 'now', message: 'Use o relógio da simulação (determinismo).' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'setTimeout', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'setInterval', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'requestAnimationFrame', message: 'Proibido em src/core/ (determinismo).' },
        { name: 'window', message: 'src/core/ é headless.' },
        { name: 'document', message: 'src/core/ é headless.' },
        { name: 'localStorage', message: 'src/core/ é headless.' },
        { name: 'fetch', message: 'src/core/ é headless.' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['phaser', 'phaser/*', 'preact', 'preact/*', '@preact/*'] },
      ],
    },
  },
);
