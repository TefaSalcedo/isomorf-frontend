import { getOrCreateDeviceIdentity, regenerateDeviceIdentity, signDeviceRequest } from '@/lib/device/identity';
import type { DeviceSession, User } from '@/types/auth';
import type { Folder } from '@/types/folder';
import type { InvitePreview, ProjectShare, Team, TeamDetail, TeamInviteCreated, TeamMember, TeamRole } from '@/types/team';
import type { ElementLoad, LoadCase } from '@/types/structural-load';
import type { CatalogPresets, DesignSettings, DocumentState, ElementType, HistoryResponse, Material, Project, ProjectElement, Section, SectionShape, MaterialCategory } from '@/types/project';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type DevicePayload = { key_id: string; public_key: string; fingerprint: string; device_name: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function devicePayload(): Promise<DevicePayload> {
  const identity = await getOrCreateDeviceIdentity();
  return { key_id: identity.keyId, public_key: JSON.stringify(identity.publicKey), fingerprint: identity.fingerprint, device_name: `${navigator.platform} browser` };
}

async function request<T>(path: string, init: RequestInit = {}, proof = false): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (proof) Object.entries(await signDeviceRequest(await getOrCreateDeviceIdentity(), init.method ?? 'GET', path)).forEach(([key, value]) => headers.set(key, value));
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new Error(`Unable to connect to the API at ${API_URL}. Start the backend service and try again.`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status >= 500) {
      throw new ApiError(response.status, 'The API could not complete the request. Check that the database and backend services are running.');
    }
    throw new ApiError(response.status, body.detail ?? 'Request failed');
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

async function withDeviceRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.message === 'Device key is already registered') {
      await regenerateDeviceIdentity();
      return action();
    }
    throw error;
  }
}

export const api = {
  register: async (payload: { email: string; password: string; first_name: string; last_name: string }) => withDeviceRetry(async () => request<{ user: User; session_id: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...payload, device: await devicePayload() }) })),
  login: async (payload: { email: string; password: string }) => withDeviceRetry(async () => request<{ user: User; session_id: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ ...payload, device: await devicePayload() }) })),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<User>('/api/auth/me'),
  sessions: () => request<DeviceSession[]>('/api/auth/sessions'),
  revokeSession: (id: string) => request<void>(`/api/auth/sessions/${id}`, { method: 'DELETE' }, true),
  projects: () => request<Project[]>('/api/projects'),
  folders: () => request<Folder[]>('/api/folders'),
  createFolder: (payload: { name: string }) => request<Folder>('/api/folders', { method: 'POST', body: JSON.stringify(payload) }, true),
  updateFolder: (id: string, payload: { name: string }) => request<Folder>(`/api/folders/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  deleteFolder: (id: string) => request<void>(`/api/folders/${id}`, { method: 'DELETE' }, true),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  loadCases: (id: string) => request<LoadCase[]>(`/api/projects/${id}/load-cases`),
  createLoadCase: (id: string, payload: { name: string; category?: string }) => request<LoadCase>(`/api/projects/${id}/load-cases`, { method: 'POST', body: JSON.stringify(payload) }, true),
  loads: (id: string) => request<ElementLoad[]>(`/api/projects/${id}/loads`),
  createLoad: (id: string, payload: Omit<ElementLoad, 'id' | 'created_at'>) => request<ElementLoad>(`/api/projects/${id}/loads`, { method: 'POST', body: JSON.stringify(payload) }, true),
  updateLoad: (projectId: string, loadId: string, payload: Partial<Omit<ElementLoad, 'id' | 'created_at'>>) => request<ElementLoad>(`/api/projects/${projectId}/loads/${loadId}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  deleteLoad: (projectId: string, loadId: string) => request<void>(`/api/projects/${projectId}/loads/${loadId}`, { method: 'DELETE' }, true),
  createProject: (payload: { name: string; description: string }) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(payload) }, true),
  updateProject: (id: string, payload: Partial<{ name: string; description: string; design_settings: DesignSettings }>) => request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  elements: (id: string) => request<ProjectElement[]>(`/api/projects/${id}/elements`),
  createElement: (projectId: string, payload: ElementPayload) => request<ProjectElement>(`/api/projects/${projectId}/elements`, { method: 'POST', body: JSON.stringify(payload) }, true),
  updateElement: (projectId: string, id: string, payload: Omit<ElementPayload, 'id'>) => request<ProjectElement>(`/api/projects/${projectId}/elements/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  deleteElement: (projectId: string, id: string) => request<void>(`/api/projects/${projectId}/elements/${id}`, { method: 'DELETE' }, true),
  saveDocument: (projectId: string, payload: DocumentPayload) => request<DocumentState>(`/api/projects/${projectId}/document`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  documentHistory: (projectId: string, limit = 100) => request<HistoryResponse>(`/api/projects/${projectId}/history?limit=${limit}`),
  undoDocument: (projectId: string) => request<DocumentState>(`/api/projects/${projectId}/history/undo`, { method: 'POST' }, true),
  redoDocument: (projectId: string) => request<DocumentState>(`/api/projects/${projectId}/history/redo`, { method: 'POST' }, true),
  restoreRevision: (projectId: string, revision: number) => request<DocumentState>(`/api/projects/${projectId}/history/${revision}/restore`, { method: 'POST' }, true),
  teams: () => request<Team[]>('/api/teams'),
  team: (id: string) => request<TeamDetail>(`/api/teams/${id}`),
  createTeam: (payload: { name: string }) => request<Team>('/api/teams', { method: 'POST', body: JSON.stringify(payload) }, true),
  updateTeam: (id: string, payload: { name: string }) => request<Team>(`/api/teams/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  deleteTeam: (id: string) => request<void>(`/api/teams/${id}`, { method: 'DELETE' }, true),
  createInvite: (teamId: string, payload: { email?: string; role: TeamRole; expires_in_days?: number }) => request<TeamInviteCreated>(`/api/teams/${teamId}/invites`, { method: 'POST', body: JSON.stringify(payload) }, true),
  revokeInvite: (teamId: string, inviteId: string) => request<void>(`/api/teams/${teamId}/invites/${inviteId}`, { method: 'DELETE' }, true),
  invitePreview: (token: string) => request<InvitePreview>(`/api/teams/invites/${token}`),
  acceptInvite: (token: string) => request<Team>('/api/teams/invites/accept', { method: 'POST', body: JSON.stringify({ token }) }, true),
  updateMemberRole: (teamId: string, memberId: string, role: TeamRole) => request<TeamMember>(`/api/teams/${teamId}/members/${memberId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, true),
  removeMember: (teamId: string, memberId: string) => request<void>(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }, true),
  leaveTeam: (teamId: string) => request<void>(`/api/teams/${teamId}/leave`, { method: 'POST' }, true),
  shareProject: (teamId: string, projectId: string) => request<ProjectShare>(`/api/teams/${teamId}/projects`, { method: 'POST', body: JSON.stringify({ project_id: projectId }) }, true),
  unshareProject: (teamId: string, projectId: string) => request<void>(`/api/teams/${teamId}/projects/${projectId}`, { method: 'DELETE' }, true),
  catalogPresets: () => request<CatalogPresets>('/api/catalog/presets'),
  materials: (projectId: string) => request<Material[]>(`/api/projects/${projectId}/materials`),
  createMaterial: (projectId: string, payload: { name: string; category?: MaterialCategory; properties?: Record<string, unknown> }) =>
    request<Material>(`/api/projects/${projectId}/materials`, { method: 'POST', body: JSON.stringify(payload) }, true),
  updateMaterial: (projectId: string, materialId: string, payload: { name?: string; category?: MaterialCategory; properties?: Record<string, unknown> }) =>
    request<Material>(`/api/projects/${projectId}/materials/${materialId}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  deleteMaterial: (projectId: string, materialId: string) => request<void>(`/api/projects/${projectId}/materials/${materialId}`, { method: 'DELETE' }, true),
  sections: (projectId: string) => request<Section[]>(`/api/projects/${projectId}/sections`),
  createSection: (projectId: string, payload: { name: string; shape?: SectionShape; material_id?: string | null; dimensions?: Record<string, unknown>; properties?: Record<string, unknown> }) =>
    request<Section>(`/api/projects/${projectId}/sections`, { method: 'POST', body: JSON.stringify(payload) }, true),
  updateSection: (projectId: string, sectionId: string, payload: { name?: string; shape?: SectionShape; material_id?: string | null; dimensions?: Record<string, unknown>; properties?: Record<string, unknown> }) =>
    request<Section>(`/api/projects/${projectId}/sections/${sectionId}`, { method: 'PUT', body: JSON.stringify(payload) }, true),
  deleteSection: (projectId: string, sectionId: string) => request<void>(`/api/projects/${projectId}/sections/${sectionId}`, { method: 'DELETE' }, true),
};

export type DocumentPayload = { name?: string; design_settings?: DesignSettings; elements: ElementPayload[] };

export type ElementPayload = { id?: string; element_type: ElementType; x1: number; y1: number; x2: number; y2: number; length: number; rotation: number; material_id?: string | null; section_id?: string | null; properties: Record<string, unknown> };
