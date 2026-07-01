export interface RbGameSettings {
  team: {
    max_members: number | null;
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
