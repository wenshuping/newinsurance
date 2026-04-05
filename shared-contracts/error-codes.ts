export const C_AUTH_ERRORS = [
  'INVALID_NAME',
  'INVALID_MOBILE',
  'INVALID_CODE',
  'CODE_NOT_FOUND',
  'CODE_EXPIRED',
  'SMS_LIMIT_REACHED',
] as const;

export const C_ACTIVITY_ERRORS = [
  'ACTIVITY_NOT_FOUND',
  'USE_SIGN_IN',
  'MANUAL_FLOW_REQUIRED',
  'ALREADY_COMPLETED',
] as const;

export const C_MALL_ERRORS = [
  'ITEM_NOT_FOUND',
  'OUT_OF_STOCK',
  'INSUFFICIENT_POINTS',
  'REDEMPTION_NOT_FOUND',
  'ALREADY_WRITTEN_OFF',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
] as const;

export const COMMON_AUTH_ERRORS = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NEED_BASIC_VERIFY',
] as const;

export type CAuthErrorCode = (typeof C_AUTH_ERRORS)[number];
export type CActivityErrorCode = (typeof C_ACTIVITY_ERRORS)[number];
export type CMallErrorCode = (typeof C_MALL_ERRORS)[number];
export type CommonAuthErrorCode = (typeof COMMON_AUTH_ERRORS)[number];

export type ErrorCode =
  | CAuthErrorCode
  | CActivityErrorCode
  | CMallErrorCode
  | CommonAuthErrorCode
  | string;
