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
  ctime_at: string;
}

export interface RbTeam {
  id: number;
  name: string;
  state: RbTeamState;
  pass: string;
  bio: string;
  ctime_at: string;
  members: RbTeamMember[];
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
  announcements: Omit<RbAnnouncementInfo, 'is_pinned' | 'game_id' | 'puzzle_id'>[];
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

export function mergePuzzleSubmitState(
  current: RbPuzzleTeamData,
  next: RbPuzzleTeamData | undefined,
  action: RbJudgeAction,
): RbPuzzleTeamData {
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
  name: string;
  growth: number;
  prec: number;
  amount: number;
  max_amount: number;
  utime_at: string;
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
  title: string;
  cooldown: number;
  cost_id: number;
  cost_amount: number;
}

export interface RbHintTeamState {
  id: number;
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
}

export interface RbAnnouncementInfo {
  id: number;
  title: string;
  content: string;
  content_type: RbContentType;
  is_pinned: boolean;
  game_id?: number;
  puzzle_id?: number;
  puzzle_slug?: string | null;
  utime_at: string;
}

export interface RbGameAggreInfo {
  game: RbGame;
  team?: RbTeam;
  currency?: RbTeamCurrency[];
  rounds?: Pick<RbRound, 'id' | 'slug' | 'title'>[];
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
}

export enum RbTicketSendBlock {
  Ok = 0,
  NoAccess = -1,
  Closed = -2,
  Pending = -3,
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
  sender: { id: number; nickname: string };
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
  actor: { id: number; nickname: string };
  actor_type: RbTicketSenderType;
  message?: TicketMessage;
  ctime_at: string;
}

export type TicketThreadItem = TicketMessage | TicketOperation;

export function isTicketMessage(item: TicketThreadItem): item is TicketMessage {
  return item.type !== RbTicketThreadItemType.Operation;
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
}

export type TicketAggreInfo = TicketSummary;
export type TicketDetailInfo = TicketSummary;
