export type ApiErrorLike = {
  status?: number;
  code?: string;
  message?: string;
};

const AUTH_INVALID_CODES = new Set(['UNAUTHORIZED', 'CSRF_INVALID', 'NO_SESSION']);
const AUTH_GATE_CODES = new Set(['UNAUTHORIZED', 'NEED_BASIC_VERIFY']);

const CODE_MESSAGE_MAP: Record<string, string> = {
  UNAUTHORIZED: '登录已失效，请重新登录',
  CSRF_INVALID: '登录状态异常，请重新登录后重试',
  NO_SESSION: '请先登录',
  NO_PERMISSION: '暂无权限，请联系管理员',
  NEED_BASIC_VERIFY: '请先完成基础身份确认',
  INVALID_PARAMS: '参数不正确，请检查后重试',
  INVALID_MOBILE: '手机号格式不正确',
  INVALID_NAME: '姓名格式不正确',
  INVALID_CODE: '验证码格式不正确',
  CODE_NOT_FOUND: '验证码错误或已失效',
  CODE_EXPIRED: '验证码已过期',
  SMS_LIMIT_REACHED: '验证码请求过于频繁，请稍后再试',
  TENANT_REQUIRED: '缺少租户信息，请从正确入口进入',
  TENANT_CONTEXT_REQUIRED: '缺少租户上下文，请刷新后重试',
  ITEM_NOT_FOUND: '商品不存在',
  ITEM_NOT_AVAILABLE: '商品未上架或无权限',
  OUT_OF_STOCK: '库存不足',
  INSUFFICIENT_POINTS: '积分不足',
  MALL_ACTIVITY_NOT_FOUND: '商城活动不存在',
  MALL_ACTIVITY_NOT_AVAILABLE: '商城活动未上架或已下线',
  ALREADY_SIGNED: '今日已签到',
  ALREADY_COMPLETED: '今日该任务已完成',
  COURSE_NOT_FOUND: '课程不存在',
  COURSE_NOT_AVAILABLE: '课程未上架或已下线',
  PRODUCT_NOT_FOUND: '商品不存在',
  ACTIVITY_NOT_FOUND: '活动不存在',
  TEAM_NOT_FOUND: '团队不存在',
  EMPLOYEE_NOT_FOUND: '员工不存在',
  CUSTOMER_NOT_FOUND: '客户不存在',
  TAG_NOT_FOUND: '标签不存在',
  RULE_NOT_FOUND: '规则不存在',
  METRIC_RULE_NOT_FOUND: '指标规则不存在',
  EVENT_NOT_FOUND: '事件定义不存在',
  UPLOAD_FAILED: '上传失败，请稍后重试',
  FILE_TOO_LARGE: '文件过大，请压缩后重试',
  LOGIN_FAILED: '账号或密码错误',
  LOGIN_PARAMS_REQUIRED: '请输入账号和密码',
  REQUEST_TIMEOUT: '请求超时，请稍后重试',
  GATEWAY_UPSTREAM_UNAVAILABLE: '服务暂时不可用，请稍后重试',
  GATEWAY_FALLBACK_UNAVAILABLE: '系统正在切换处理中，请稍后再试',
  FAMILY_POLICY_REPORT_PROVIDER_NOT_READY: '家庭保障报告服务正在准备中，请稍后重试',
  FAMILY_POLICY_REPORT_TIMEOUT: '家庭保障报告整理超时，请稍后重试',
  FAMILY_POLICY_REPORT_UPSTREAM_FAILED: '家庭保障报告暂时无法整理，请稍后重试',
  FAMILY_POLICY_REPORT_FAILED: '家庭保障报告暂时无法整理，请稍后重试',
  FAMILY_POLICY_REPORT_EMPTY: '家庭保障报告暂时无法整理，请稍后重试',
};

export function shouldInvalidateSession(input: ApiErrorLike): boolean {
  const code = String(input?.code || '').trim().toUpperCase();
  if (AUTH_INVALID_CODES.has(code)) return true;
  return Number(input?.status || 0) === 401;
}

export function isAuthGateError(code: string | undefined | null): boolean {
  return AUTH_GATE_CODES.has(String(code || '').trim().toUpperCase());
}

export function resolveApiErrorMessage(input: ApiErrorLike, fallback = '请求失败'): string {
  const code = String(input?.code || '').trim().toUpperCase();
  if (code && CODE_MESSAGE_MAP[code]) return CODE_MESSAGE_MAP[code];
  if (input?.message) return String(input.message);
  const status = Number(input?.status || 0);
  if (status === 401) return '登录已失效，请重新登录';
  if (status === 403) return '暂无权限或状态不满足，请联系管理员';
  if (status === 404) return '请求资源不存在';
  if (status === 409) return '请求冲突，请刷新后重试';
  if (status >= 500) return '系统繁忙，请稍后重试';
  return fallback;
}
