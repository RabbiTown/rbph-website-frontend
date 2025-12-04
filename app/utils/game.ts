export interface RbGame {
  id: number;
  title: string;
  is_shown: boolean;
  is_online: boolean;

  reg_open_at?: OffsetDateTimeTuple;
  pre_open_at?: OffsetDateTimeTuple;
  start_at: OffsetDateTimeTuple;
  end_at: OffsetDateTimeTuple;
  ctime_at: OffsetDateTimeTuple;

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
  ctime_at: OffsetDateTimeTuple;
}

export interface RbTeam {
  id: number;
  tname: string;
  tstate: RbTeamState;
  pass: string;
  bio: string;
  ctime_at: OffsetDateTimeTuple;
  members: RbTeamMember[];
}
