export enum SyncMessageType {
  Unknown = -1,

  // 100 - game
  GameNewAnnouncement = 101,

  // 200 - team
  TeamMemberJoined = 201,
  TeamMemberLeft = 202,
  TeamDisbanded = 203,
  TeamInfoUpdated = 204,
  TeamGameStarted = 205,
  TeamGameFinished = 206,

  // 300 - puzzle
  PuzzleSubmitted = 301,
  PuzzleHintUnlocked = 302,
}

export interface SyncMessage<T> {
  type: SyncMessageType;
  data: T;
}

export interface SyncMessageMap {
  [SyncMessageType.Unknown]: unknown;

  // 100 - game
  [SyncMessageType.GameNewAnnouncement]: object;

  // 200 - team
  [SyncMessageType.TeamMemberJoined]: object;
  [SyncMessageType.TeamMemberLeft]: object;
  [SyncMessageType.TeamDisbanded]: object;
  [SyncMessageType.TeamInfoUpdated]: object;
  [SyncMessageType.TeamGameStarted]: object;
  [SyncMessageType.TeamGameFinished]: object;

  // 300 - puzzle
  [SyncMessageType.PuzzleSubmitted]: {
    user: { id: number; name: string };
    puzzle: { id: number; title: string };
    answer: string;
    action: RbJudgeAction;
    cooldown_till?: string;
    solved?: boolean;
    unlocks?: { id: number; title: string; round_id: number }[];
  };
  [SyncMessageType.PuzzleHintUnlocked]: { user: { id: number; name: string }; puzzle: { id: number; title: string }; hint: { id: number; title: string; cost_id?: number; cost_amount: number } };
}
