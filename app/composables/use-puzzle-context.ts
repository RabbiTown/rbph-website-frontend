export interface RbPuzzleContext {
  puzzle: Ref<RbPuzzleShowData | undefined>;
  puzzleRoute: (page?: string) => string | undefined;
  roundRoute: () => string | undefined;
}

const puzzleContextKey: InjectionKey<RbPuzzleContext> = Symbol('rbph-puzzle-context');

export function providePuzzleContext(puzzle: Ref<RbPuzzleShowData | undefined>): RbPuzzleContext {
  const context: RbPuzzleContext = {
    puzzle,
    puzzleRoute(page?: string) {
      const data = puzzle.value?.data;
      if (!data) return undefined;
      return preferredPuzzleRoute(data, page);
    },
    roundRoute() {
      const data = puzzle.value?.data;
      if (!data) return undefined;
      return gameRoundSimpleRoute(data.game_id, data.round);
    },
  };

  provide(puzzleContextKey, context);
  return context;
}

export function usePuzzleContext(): RbPuzzleContext {
  const context = inject(puzzleContextKey);
  if (!context) throw new Error('Puzzle context is not provided');
  return context;
}
