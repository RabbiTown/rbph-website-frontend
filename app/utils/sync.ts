export enum SyncMessageType {
  Unknown = -1,

  // 0 - system
  SystemStatusUpdated = 1,

  // 100 - game
  GameNewAnnouncement = 101,
  GameReleaseUpdated = 102,

  // 200 - team
  TeamInfoUpdated = 201,
  TeamDisbanded = 202,
  TeamSelfKicked = 203,
  TeamSelfPromoted = 204,

  // 300 - puzzle
  PuzzleSubmitted = 301,
  PuzzleHintUnlocked = 302,
  PuzzleBackendEvent = 303,

  // 400 - ticket
  TicketUpdated = 401,
  NotificationUpdated = 402,
}

export interface SyncMessage<T> {
  type: SyncMessageType;
  data: T;
}

export interface SyncMessageMap {
  [SyncMessageType.Unknown]: unknown;

  // 0 - system
  [SyncMessageType.SystemStatusUpdated]: null;

  // 100 - game
  [SyncMessageType.GameNewAnnouncement]: { game_id: number | null };
  [SyncMessageType.GameReleaseUpdated]: { game_id: number; cursor: number };

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
    unlocks?: { id: number; slug?: string | null; title: string; round_id: number; round_slug?: string | null }[];
    state?: RbPuzzleTeamData;
    currency?: RbTeamCurrency[];
    currency_penalty?: RbCurrencyPenalty[];
    content_changed?: boolean;
  };
  [SyncMessageType.PuzzleHintUnlocked]: { sid?: string; user: { id: number; name: string }; puzzle: { id: number; title: string }; hint: { id: number; title: string; cost_id?: number | null; cost_amount: number } };
  [SyncMessageType.PuzzleBackendEvent]: {
    puzzle_id: number;
    event: string;
    payload: unknown;
    actor: { id: number; nickname: string };
    source: { type: 'api' | 'judge' | 'hint_purchase'; function: string };
  };
  [SyncMessageType.TicketUpdated]: {
    event: 'created' | 'message' | 'closed' | 'assigned' | 'unassigned';
    ticket_id: number;
    message_id?: number | null;
    actor_id: number;
    team_id: number;
    puzzle_id?: number | null;
    game_id: number;
  };
  [SyncMessageType.NotificationUpdated]: {
    event: 'created' | 'read' | 'read_all';
    notification_id?: number | null;
    team_id: number;
    game_id: number;
  };
}
