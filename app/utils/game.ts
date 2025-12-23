export interface RbGame {
  id: number;
  title: string;
  is_shown?: boolean;
  is_online?: boolean;

  reg_open_at?: string;
  pre_open_at?: string;
  start_at: string;
  end_at: string;
  ctime_at?: string;

  cover?: string;
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
  tname: string;
  tstate: RbTeamState;
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
}

export interface RbPuzzle {
  id: number;
  title: string;
  ptype: RbPuzzleType;
  content: string;
  content_type: RbContentType;
  round: Pick<RbRound, 'id' | 'title'>;
  game_id: number;
}

export enum RbTeamPuzzleState {
  Locked = -1,
  Unlocked = 0,
  Solved = 1,
}

export interface RbPuzzleTeamData {
  state: RbTeamPuzzleState;
  answers: string[];
  utime_at: string;
}

export interface RbPuzzleShowData {
  data: RbPuzzle;
  state: RbPuzzleTeamData;
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
};

export interface RbJudgeResult {
  action: RbJudgeAction;
  result?: string;
  answer?: string;
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
  title: string;
  content: string;
  content_type: RbContentType;
  cover?: string;
  game_id: number;
  puzzle?: number;
}

export interface RbRoundInnerPuzzleData {
  id: number;
  title: string;
  state: RbTeamPuzzleState;
  answer?: string;
}

export interface RbRoundUserData {
  data: RbRound;
  puzzles: RbRoundInnerPuzzleData[];
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

export interface RbTeamCurrencyWrapper {
  server_time: string;
  data: RbTeamCurrency[];
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
  tname: string;
  bio: string;
  finish_at?: string;
  last_solved_at?: string;
  solves: number;
  members: string[];
}

export interface LeaderBoardTeamInfo {
  id: number;
  tname: string;
  bio: string;
  finish_at?: string;
  last_solved_at?: string;
  solves: number;
  members: string[];
}

export interface LeaderBoardInfo {
  data: LeaderBoardTeamInfo[];
}
