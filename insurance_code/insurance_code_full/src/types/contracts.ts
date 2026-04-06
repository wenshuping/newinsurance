// Keep local contract types to avoid cross-repo path dependency in CI.
export type CUserContract = {
  id: number;
  name: string;
  mobile: string;
  wechat_open_id?: string;
  wechat_union_id?: string;
  wechat_app_type?: string;
  wechat_bound_at?: string | null;
  is_verified_basic: boolean;
  verified_at?: string | null;
};

export type VerifyBasicResponseContract = {
  token: string;
  csrfToken?: string;
  user: CUserContract;
  isNewlyVerified?: boolean;
  balance?: number;
};

export type SendCodeResponseContract = {
  ok: boolean;
  message: string;
  dev_code?: string;
  isVerifiedBasic?: boolean;
  verifiedName?: string;
};

export type ApiError = {
  code?: string;
  message?: string;
};

export type UserDto = CUserContract;
export type VerifyBasicResponse = VerifyBasicResponseContract;
export type SendCodeResponse = SendCodeResponseContract;

export type MeResponse = {
  user: CUserContract;
  balance: number;
  csrfToken?: string | null;
};

export type PointsSummaryResponse = {
  balance: number;
};
