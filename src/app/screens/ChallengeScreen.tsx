import type { VNode } from 'preact';
import { useState } from 'preact/hooks';
import { back } from '../router';
import { leaderboardService } from '@services/leaderboard';
import { dailyChallengeSeed, weeklyChallengeSeed } from '@render/seedSource';
import { buildChallengeBrief } from '../challenge/brief';
import { ChallengeBrief } from './ChallengeBrief';
import { PlayScreen } from './PlayScreen';

/**
 * Desafio Diário/Semanal: briefing primeiro, jogo depois. A seed é capturada 1× por montagem
 * (a partida e o briefing falam do MESMO período, mesmo se o dia virar durante a sessão) e
 * "Voltar"/"Desistir" no jogo retornam ao briefing (não ao Home), remontando-o — os recordes
 * exibidos ficam atualizados após a partida porque `buildChallengeBrief` lê os signals correntes
 * do serviço de leaderboard no render.
 */
export function ChallengeScreen({ mode }: { mode: 'daily' | 'weekly' }): VNode {
  const [seed] = useState(() => (mode === 'daily' ? dailyChallengeSeed() : weeklyChallengeSeed()));
  const [playing, setPlaying] = useState(false);

  if (playing) return <PlayScreen mode={mode} onExit={() => setPlaying(false)} />;

  const view = buildChallengeBrief({
    seed,
    localEntries: mode === 'daily' ? leaderboardService.daily.value : leaderboardService.weekly.value,
    centralEntries:
      mode === 'daily' ? leaderboardService.centralDaily.value : leaderboardService.centralWeekly.value,
  });
  return (
    <ChallengeBrief mode={mode} view={view} onPlay={() => setPlaying(true)} onBack={() => back()} />
  );
}
