import type { Project } from '@/types/project';

export type TeamRole = 'owner' | 'editor' | 'viewer';

export type Team = {
  id: string;
  name: string;
  owner_id: string;
  my_role: TeamRole;
  member_count: number;
  project_count: number;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: TeamRole;
  created_at: string;
};

export type TeamInvite = {
  id: string;
  team_id: string;
  email: string | null;
  role: TeamRole;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type TeamInviteCreated = TeamInvite & { token: string; accept_url: string };

export type InvitePreview = {
  team_id: string;
  team_name: string;
  role: TeamRole;
  email: string | null;
  expires_at: string;
  invited_by: string;
};

export type TeamDetail = Team & {
  members: TeamMember[];
  projects: Project[];
  invites: TeamInvite[];
};

export type ProjectShare = { id: string; project_id: string; team_id: string; created_at: string };
