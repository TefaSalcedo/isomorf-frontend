export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
};

export type DeviceSession = {
  id: string;
  key_id: string;
  device_name: string | null;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
};
