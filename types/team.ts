export type TeamRole = 'owner' | 'editor' | 'viewer';

export type InvitePreview = {
  team_id: string;
  team_name: string;
  role: TeamRole;
  email: string | null;
  expires_at: string;
  invited_by: string;
};

export type TeamPublic = {
  id: string;
  name: string;
  owner_id: string;
  my_role: TeamRole;
  member_count: number;
  project_count: number;
  created_at: string;
  updated_at: string;
};
