export enum RbUserRole {
  Banned = 0,
  User = 1,
  Moderator = 2,
  Admin = 3,
  Root = 4,
}

export enum AvatarProvider {
  Cravatar = 'cravatar',
  Catavatar = 'catavatar',
}

export interface RbUser {
  id: number;
  email: string;
  urole: RbUserRole;
  nickname: string;
  bio?: string;
  must_change_password: boolean;
  avatar: string;
  avatar_provider: AvatarProvider;
  ctime_at: string;
}

export interface AdminUserListItem {
  id: number;
  email: string;
  nickname: string;
  avatar: string;
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

export interface AdminUserDetail extends RbUser {
  teams: AdminUserTeam[];
}

export interface AdminTemporaryPasswordResponse {
  user: AdminUserDetail;
  temporary_password: string;
}
