import type { AvatarProvider } from './user';

export interface RbGameSettings {
  team: {
    max_members: number | null;
  };
  display: {
    staff_nickname: string | null;
    staff_avatar_email: string | null;
    staff_avatar_provider: AvatarProvider;
  };
  ticket: Record<string, unknown>;
}

export interface RbGameModel {
  id: number;
  title: string;
  is_listed?: boolean;
  is_active?: boolean;

  ctime_at?: string;

  cover?: string;
  settings?: RbGameSettings;
}
