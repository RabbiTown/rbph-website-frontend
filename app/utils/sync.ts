export enum SyncMessageType {
  Unknown = -1,

  // 100 - game
  GameNewAnnouncement = 101,

  // 200 - team
  TeamInfoUpdated = 201,
  TeamDisbanded = 202,
  TeamSelfKicked = 203,
  TeamSelfPromoted = 204,

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
  [SyncMessageType.TeamDisbanded]: null;
  [SyncMessageType.TeamInfoUpdated]: null;
  [SyncMessageType.TeamSelfKicked]: null;
  [SyncMessageType.TeamSelfPromoted]: null;

  // 300 - puzzle
  [SyncMessageType.PuzzleSubmitted]: {
    sid?: string;
    user: { id: number; name: string };
    puzzle: { id: number; title: string };
    answer: string;
    action: RbJudgeAction;
    cooldown_till?: string;
    solved?: boolean;
    unlocks?: { id: number; title: string; round_id: number }[];
  };
  [SyncMessageType.PuzzleHintUnlocked]: { sid?: string; user: { id: number; name: string }; puzzle: { id: number; title: string }; hint: { id: number; title: string; cost_id?: number; cost_amount: number } };
}
