type RouteRef = {
  id: number;
  slug?: string | null;
};

function routeRef(ref: RouteRef): string {
  return encodeURIComponent(ref.slug || ref.id.toString());
}

export function gamePuzzleRoute(gameId: number | undefined, puzzle: RouteRef, page?: string): string {
  const base = gameId ? `/games/${gameId}/puzzles/${routeRef(puzzle)}` : `/puzzles/${puzzle.id}`;
  return page ? `${base}/${page}` : base;
}

export function gameRoundRoute(gameId: number | undefined, round: RouteRef): string {
  return gameId ? `/games/${gameId}/rounds/${routeRef(round)}` : `/rounds/${round.id}`;
}

export function preferredPuzzleRoute(puzzle: Pick<RbPuzzle, 'id' | 'slug' | 'game_id'>, page?: string): string {
  return gamePuzzleRoute(puzzle.game_id, puzzle, page);
}

export function preferredRoundRoute(round: Pick<RbRound, 'id' | 'slug' | 'game_id'>): string {
  return gameRoundRoute(round.game_id, round);
}

export function gameRoundSimpleRoute(gameId: number | undefined, round: RouteRef): string {
  return gameRoundRoute(gameId, round);
}

export function gamePuzzleSimpleRoute(gameId: number | undefined, puzzle: RouteRef, page?: string): string {
  return gamePuzzleRoute(gameId, puzzle, page);
}
