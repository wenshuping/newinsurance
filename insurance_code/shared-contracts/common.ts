export type ApiErrorContract = {
  code: string;
  message: string;
};

export type CUserContract = {
  id: number;
  name: string;
  mobile: string;
  is_verified_basic: boolean;
  verified_at?: string | null;
};

