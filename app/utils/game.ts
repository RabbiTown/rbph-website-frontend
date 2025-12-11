export interface RbGame {
  id?: number;
  title?: string;
  is_shown?: boolean;
  is_online?: boolean;

  reg_open_at?: string;
  pre_open_at?: string;
  start_at?: string;
  end_at?: string;
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
  id?: number;
  is_captain?: boolean;
  nickname?: string;
  ctime_at?: string;
}

export interface RbTeam {
  id?: number;
  tname?: string;
  tstate?: RbTeamState;
  pass?: string;
  bio?: string;
  ctime_at?: string;
  members?: RbTeamMember[];
}

export enum RbPuzzleType {
  Normal = 0,
  Story = 1,
}

export interface RbPuzzle {
  id?: number;
  title?: string;
  prelogue?: string;
  content?: string;
  ptype?: RbPuzzleType;
  round_id?: number;
}
