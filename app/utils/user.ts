export enum RbUserRole {
  Banned = 0,
  User = 1,
  Moderator = 2,
  Admin = 3,
  Root = 4,
}

export interface RbUser {
  id: number;
  email: string;
  urole: RbUserRole;
  nickname: string;
  bio?: string;
  must_change_password: boolean;
  avatar: string;
  ctime_at: string;
}

export interface AdminUserListItem {
  id: number;
  email: string;
  nickname: string;
  urole: RbUserRole;
  must_change_password: boolean;
  team_count: number;
  ctime_at: string;
}

export interface AdminUserTeam {
  game_id: number;
  game_title: string;
  team_id: number;
  team_name: string;
  is_captain: boolean;
}

export interface AdminUserDetail extends Omit<RbUser, 'avatar'> {
  teams: AdminUserTeam[];
}

export interface AdminTemporaryPasswordResponse {
  user: AdminUserDetail;
  temporary_password: string;
}
