export interface RbGameSettings {
  team: {
    max_members: number;
  };
  ticket: Record<string, unknown>;
}

export interface RbGameModel {
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
  settings?: RbGameSettings;
}
