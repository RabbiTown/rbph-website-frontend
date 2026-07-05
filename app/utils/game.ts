import type { ActivityLogPayload } from './activity-log';

export interface RbGame extends RbGameModel {
  rounds?: Pick<RbRound, 'id' | 'slug' | 'title'>[];
}

export enum RbTeamState {
  Banned = -1,
  Open = 0,
  InGame = 1,
  Finished = 2,
}

export interface RbTeamMember {
  id: number;
  is_captain: boolean;
  nickname: string;
  avatar: string;
  ctime_at: string;
}

export interface RbTeam {
  id: number;
  name: string;
  state?: RbTeamState;
  is_banned?: boolean;
  is_locked?: boolean;
  pass: string;
  bio: string;
  ctime_at: string;
  finish_at?: string | null;
  members: RbTeamMember[];
  features?: RbTeamFeatureData[];
}

export enum RbPuzzleType {
  Normal = 0,
  Story = 1,
}

export enum RbContentType {
  Markdown = 0,
  Html = 1,
  UnsafeMarkdown = 2,
}

export interface RbPuzzle {
  id: number;
  slug?: string | null;
  title: string;
  ptype: RbPuzzleType;
  content: string;
  content_type: RbContentType;
  round: Pick<RbRound, 'id' | 'slug' | 'title'>;
  game_id: number;
  announcements: RbAnnouncementInfo[];
}

export enum RbTeamPuzzleState {
  Locked = -1,
  Unlocked = 0,
  Solved = 1,
}

export interface RbPuzzleTeamData {
  state: RbTeamPuzzleState;
  max_submit?: number | null;
  submit_count: number;
  answers: string[];
  utime_at: string;
  cooldown_till?: string;
}

export interface RbPuzzleShowData {
  data: RbPuzzle;
  state: RbPuzzleTeamData;
}

export function mergePuzzleSubmitState(current: RbPuzzleTeamData, next: RbPuzzleTeamData | undefined, action: RbJudgeAction): RbPuzzleTeamData {
  const currentSubmitCount = current.submit_count ?? 0;
  const fallbackSubmitCount = action === RbJudgeAction.Fail ? currentSubmitCount + 1 : currentSubmitCount;

  return {
    ...(next ?? current),
    submit_count: Math.max(next?.submit_count ?? 0, fallbackSubmitCount),
  };
}

export interface RbContent {
  content: string;
  content_type: RbContentType;
}

export enum RbJudgeAction {
  Error = -2,
  Pending = -1,
  Fail = 0,
  Correct = 1,
  Milestone = 2,
  StartGame = 3,
  EasterEgg = 4,
  FinishGame = 5,
}

export interface JudgeActionConst {
  name: string;
  icon: string;
  color: 'error' | 'warning' | 'success' | 'primary' | 'secondary' | 'info' | 'neutral' | undefined;
  desc: string;
}

export const judgeActionConsts: Record<RbJudgeAction, JudgeActionConst> = {
  [RbJudgeAction.Error]: { name: '评测故障', icon: 'material-symbols:error-med-outline-rounded', color: 'error', desc: '评测时出现故障，请联系管理员！' },
  [RbJudgeAction.Pending]: { name: '评测中', icon: 'material-symbols:more-horiz', color: 'warning', desc: '如果长时间处于此状态，请联系管理员！' },
  [RbJudgeAction.Fail]: { name: '回答错误', icon: 'material-symbols:close-rounded', color: 'error', desc: '你没有得到任何信息。' },
  [RbJudgeAction.Correct]: { name: '回答正确', icon: 'material-symbols:check-rounded', color: 'success', desc: '恭喜通过本题！' },
  [RbJudgeAction.Milestone]: { name: '里程碑', icon: 'material-symbols:flag-outline-rounded', color: 'warning', desc: '这是本题的一个中间答案。' },
  [RbJudgeAction.StartGame]: { name: '开始游戏', icon: 'material-symbols:celebration-rounded', color: 'success', desc: '你的队伍已开始游戏。' },
  [RbJudgeAction.EasterEgg]: { name: '彩蛋', icon: 'material-symbols:auto-awesome-outline-rounded', color: 'primary', desc: '这是一个彩蛋！' },
  [RbJudgeAction.FinishGame]: { name: '恭喜完赛', icon: 'material-symbols:auto-awesome-outline-rounded', color: 'success', desc: '回答正确，恭喜完赛！' },
};

export interface RbJudgeResult {
  action: RbJudgeAction;
  result?: string;
  answer?: string;
}

export interface RbJudgeResponse {
  result: RbJudgeResult;
  cooldown_till?: string;
  solved?: boolean;
  unlocks?: { id: number; slug?: string | null; title: string; round_id: number; round_slug?: string | null }[];
  state?: RbPuzzleTeamData;
  currency?: RbTeamCurrency[];
  currency_penalty?: RbCurrencyPenalty[];
}

export interface RbSubmission {
  user_id: number;
  user_answer: string;
  norm_answer: string;
  saction: RbJudgeAction;
  sresult?: string;
  real_answer?: string;
  ctime_at: string;
}

export interface RbSubmissionPage {
  data: RbSubmission[];
  total: number;
}

export interface RbRound {
  id: number;
  slug?: string | null;
  title: string;
  content: string;
  content_type: RbContentType;
  cover?: string;
  game_id: number;
  puzzle?: number;
}

export interface RbRoundInnerPuzzleData {
  id: number;
  slug?: string | null;
  title: string;
  state: RbTeamPuzzleState;
  answer?: string;
}

export interface RbRoundTeamData {
  puzzle?: RbPuzzleTeamData;
  puzzles: RbRoundInnerPuzzleData[];
}

export interface RbRoundUserData {
  data: RbRound;
  state: RbRoundTeamData;
}

export interface RbTeamCurrency {
  id: number;
  slug: string;
  name: string;
  growth: number;
  init_amount: number;
  prec: number;
  amount: number;
  current_amount?: number;
  max_amount: number;
  hidden?: boolean;
  utime_at: string;
}

export interface RbTeamActivity {
  id: number;
  type: string;
  scope: number;
  severity: number;
  game_id?: number | null;
  team_id?: number | null;
  user_id?: number | null;
  target_user_id?: number | null;
  puzzle_id?: number | null;
  round_id?: number | null;
  hint_id?: number | null;
  ticket_id?: number | null;
  submission_id?: number | null;
  currency_id?: number | null;
  delta_amount?: number | null;
  data: ActivityLogPayload;
  ctime_at: string;
}

export interface RbCurrencyPenalty {
  currency_id: number;
  name: string;
  prec: number;
  amount: number;
}

export function formatCurrencyPenaltySuffix(penalty: RbCurrencyPenalty[] | undefined): string {
  if (!penalty?.length) return '';

  return penalty
    .map(item => {
      const diff = -item.amount;
      return `(${item.name} ${intPrecString(diff, item.prec, true, ' ')})`;
    })
    .join(' ');
}

export interface RbHint {
  id: number;
  title?: string | null;
  title_hidden: boolean;
  cooldown: number;
  cost_id?: number | null;
  cost_amount: number;
}

export interface RbHintTeamState {
  id: number;
  title: string;
  content: string;
  content_type: number;
}

export interface RbPuzzleHintTeamData {
  data: RbHint[];
  state: RbHintTeamState[];
}

export interface RbLeaderBoardTeam {
  id: number;
  name: string;
  bio: string;
  finish_at?: string;
  last_solved_at?: string;
  solves: number;
  members: string[];
}

export interface LeaderBoardTeamInfo {
  rank: number;
  id: number;
  name: string;
  bio: string;
  finish_at?: string;
  last_solved_at?: string;
  solves: number;
  members: string[];
}

export interface LeaderBoardInfo {
  data: LeaderBoardTeamInfo[];
  version: number;
  total: number;
  has_more: boolean;
  reset: boolean;
  state: 'live' | 'locked';
  locked_at?: string;
}

export interface RbAnnouncementInfo {
  id: number;
  title: string;
  content: string;
  content_type: RbContentType;
  is_pinned: boolean;
  game_id?: number | null;
  puzzles: RbAnnouncementPuzzle[];
  utime_at: string;
}

export interface RbAnnouncementPuzzle {
  id: number;
  slug?: string | null;
  title: string;
  round_id: number;
  round_slug?: string | null;
  is_round_puzzle: boolean;
}

export interface AdminAnnouncementData extends RbAnnouncementInfo {
  is_shown: boolean;
  game_id: number | null;
  ctime_at: string;
}

export interface RbGameAggreInfo {
  game: RbGame;
  team?: RbTeam;
  currency?: RbTeamCurrency[];
  rounds?: Pick<RbRound, 'id' | 'slug' | 'title'>[];
  release_cursor: number;
  phases: RbReleasePhase[];
  features: RbGameFeatures;
  server_time: string;
}

export type RbGameFeature = 'team_formation' | 'direct_message' | 'puzzle_ticket' | 'leaderboard' | 'currency';
export type RbGameFeatureState = 'closed' | 'existing_only' | 'open' | 'live' | 'locked';
export type RbGameFeatures = Record<RbGameFeature, RbGameFeatureState>;
export type RbTeamFeature = Exclude<RbGameFeature, 'team_formation' | 'currency'>;

export interface RbTeamFeatureData {
  feature: RbTeamFeature;
  enabled: boolean;
}

export type AdminTeamFeatureData = RbTeamFeatureData;

export interface AdminTeamListItem {
  id: number;
  name: string;
  is_banned: boolean;
  is_locked: boolean;
  finish_at?: string | null;
  member_count: number;
  captain_id?: number | null;
  captain_name?: string | null;
}

export interface AdminUserOption {
  id: number;
  email: string;
  nickname: string;
  in_team_id?: number | null;
  in_team_name?: string | null;
}

export interface AdminTeamDetail extends Omit<RbTeam, 'state'> {
  is_banned: boolean;
  is_locked: boolean;
  game_id: number;
  finish_at?: string | null;
  features: AdminTeamFeatureData[];
  currency: AdminTeamCurrency[];
}

export interface AdminTeamCurrency extends RbTeamCurrency {
  game_growth: number;
  team_growth: number;
}

export interface RbFeatureChange {
  feature: RbGameFeature;
  state: RbGameFeatureState;
}

export interface RbReleasePhase {
  id: number;
  title: string;
  description: string;
  content_type: RbContentType;
  release_at: string;
}

export interface RbReleasedPuzzle {
  id: number;
  slug?: string | null;
  title: string;
  round_id: number;
  round_slug?: string | null;
  is_round_puzzle: boolean;
}

export interface RbReleaseEvent {
  id: number;
  type: 'phase_released' | 'puzzles_released';
  occurred_at: string;
  phase: RbReleasePhase | null;
  puzzles: RbReleasedPuzzle[];
}

export interface RbReleaseSyncResponse {
  release_cursor: number;
  events: RbReleaseEvent[];
  phases: RbReleasePhase[];
  features: RbGameFeatures;
  server_time: string;
}

export enum RbTicketState {
  Closed = 0,
  Open = 1,
}

export enum RbTicketSenderType {
  Team = 0,
  Host = 1,
}

export enum TicketOpenBlock {
  Ok = 0,
  CurrentPuzzlePending = -1,
  PendingLimit = -2,
  Cooldown = -3,
  Disabled = -4,
  FeatureClosed = -5,
  FeatureExistingOnly = -6,
  TeamFeatureBanned = -7,
}

export enum RbTicketSendBlock {
  Ok = 0,
  NoAccess = -1,
  Closed = -2,
  Pending = -3,
  FeatureClosed = -4,
  FeatureExistingOnly = -5,
  TeamFeatureBanned = -6,
}

export enum RbTicketOperationAction {
  Open = 1,
  Close = 2,
  AutoCloseSolved = 3,
}

export enum RbTicketThreadItemType {
  Message = 0,
  Operation = 1,
}

export interface TicketMessage {
  type?: RbTicketThreadItemType.Message;
  id: number;
  sender: { id: number; nickname: string; avatar?: string };
  sender_type: RbTicketSenderType;
  cost_id?: number;
  cost_amount: number;
  unlocked: boolean;

  content?: string;
  content_type?: RbContentType;

  ctime_at: string;
  utime_at: string | null;
}

export interface TicketOperation {
  type: RbTicketThreadItemType.Operation;
  id: number;
  action: RbTicketOperationAction;
  actor: { id: number; nickname: string; avatar?: string };
  actor_type: RbTicketSenderType;
  message?: TicketMessage;
  ctime_at: string;
}

export type TicketThreadItem = TicketMessage | TicketOperation;

export function isTicketMessage(item: TicketThreadItem): item is TicketMessage {
  return item.type !== RbTicketThreadItemType.Operation;
}

export function mergeTicketThreadItems(...groups: TicketThreadItem[][]): TicketThreadItem[] {
  const items = new Map<string, TicketThreadItem>();
  for (const group of groups) {
    for (const item of group) items.set(`${item.type ?? RbTicketThreadItemType.Message}:${item.id}`, item);
  }
  const rank = (item: TicketThreadItem) => {
    if (isTicketMessage(item)) return 1;
    return item.action === RbTicketOperationAction.Open ? 0 : 2;
  };
  return [...items.values()].sort((a, b) => Date.parse(a.ctime_at) - Date.parse(b.ctime_at) || rank(a) - rank(b) || a.id - b.id);
}

export interface TicketSummary {
  id: number;
  state: RbTicketState;
  game_id?: number;
  team?: Pick<RbTeam, 'id' | 'name' | 'state'> & { currency?: RbTeamCurrency[] };
  puzzle?: Pick<RbPuzzle, 'id' | 'slug' | 'title' | 'round'> & Pick<RbPuzzleTeamData, 'state'>;
  msg_count?: number;
  last_at: string | null;
  last_by?: RbTicketSenderType;
  assignee?: { id: number; nickname: string; email?: string; avatar?: string };
}

export interface TicketPerm {
  send_block: RbTicketSendBlock;
  can_host: boolean;
  can_view_locked: boolean;
  content_type: RbContentType[];
  currency: number[];
}

export function canSendTicket(perm?: TicketPerm): boolean {
  if (!perm) return false;
  return perm.send_block === RbTicketSendBlock.Ok && perm.content_type.length > 0;
}

export function getDefaultTicketContentType(perm?: Pick<TicketPerm, 'content_type'>): RbContentType {
  return perm?.content_type[0] ?? RbContentType.UnsafeMarkdown;
}

export function canUseTicketContentType(perm: Pick<TicketPerm, 'content_type'> | undefined, contentType: RbContentType): boolean {
  return Boolean(perm?.content_type.includes(contentType));
}

export interface TicketThread {
  ticket?: TicketSummary | null;
  messages: TicketThreadItem[];
  history: {
    before?: string;
    after?: string;
    stop?: string;
    newer?: string;
    has_more: boolean;
  };
  perm: TicketPerm;
}

export interface TicketPuzzleList {
  open_block: TicketOpenBlock;
  cooldown_till?: string | null;
  open_tickets?: {
    id: number;
    puzzle_id: number;
    puzzle_title: string;
  }[];
  tickets: TicketSummary[];
}

export interface TicketMessageInfo {
  messages: TicketMessage[];
}

export interface TicketSendResponse {
  message_id: number;
  ticket?: TicketSummary;
  msg: TicketMessage;
  perm?: TicketPerm;
}

export interface TicketCloseResponse {
  ticket?: TicketSummary;
  thread: TicketThread;
  perm?: TicketPerm;
}

export interface TicketUnlockResponse {
  id: number;
  sender: { id: number; nickname: string };
  sender_type: RbTicketSenderType;
  cost_id: number | null;
  cost_amount: number;
  unlocked: boolean;
  content?: string | null;
  content_type?: RbContentType | null;
  ctime_at: string;
  utime_at?: string | null;
}

export interface TicketOpenResponse {
  ticket_id: number;
  message_id: number;
  thread: TicketThread;
}

export interface TicketSendRequest {
  content: string;
  content_type: RbContentType;
  sender_type?: RbTicketSenderType;
  cost_id?: number | null;
  cost_amount?: number;
  force_assignee?: boolean;
}

export interface StaffTicketListResponse {
  tickets: TicketSummary[];
  has_more: boolean;
}

export interface StaffTeamOption {
  id: number;
  name: string;
  state: RbTeamState;
}

export interface TicketAssignResponse {
  assignee?: { id: number; nickname: string; email?: string; avatar?: string } | null;
}

export enum NotificationKind {
  TicketReply = 1,
}

export interface TeamNotification {
  id: number;
  kind: NotificationKind;
  actor?: { id: number; nickname: string } | null;
  data: {
    ticket_id: number;
    message_id: number;
    puzzle_id?: number | null;
    puzzle_title?: string | null;
  };
  read: boolean;
  read_at?: string | null;
  ctime_at: string;
}

export interface NotificationUnreadResponse {
  count: number;
  dm_count: number;
}

export type TicketAggreInfo = TicketSummary;
export type TicketDetailInfo = TicketSummary;
