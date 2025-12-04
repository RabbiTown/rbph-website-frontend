export enum RbUserRole {
  Banned = 0,
  User = 1,
  Moderator = 2,
  Admin = 3,
}

export interface RbUser {
  id: number;
  email: string;
  urole: RbUserRole;
  nickname: string;
  bio?: string;
  ctime_at: OffsetDateTimeTuple;
}
