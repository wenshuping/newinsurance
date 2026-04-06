import { z } from 'zod';

const mobileSchema = z.string().trim().regex(/^1[3-9]\d{9}$/, '手机号格式不正确');
const nameSchema = z.string().trim().regex(/^[\u4e00-\u9fa5·]{2,20}$/, '姓名格式不正确');
const codeSchema = z.string().trim().regex(/^\d{6}$/, '验证码格式不正确');
const wechatIdentitySchema = z.string().trim().min(1).max(128);
const wechatAppTypeSchema = z.enum(['mini_program', 'mp', 'h5']);

export const sendCodeBodySchema = z.object({
  mobile: mobileSchema,
  tenantId: z.coerce.number().int().positive().optional(),
  tenantCode: z.string().trim().min(1).optional(),
  tenantKey: z.string().trim().min(1).optional(),
  lookupOnly: z.boolean().optional(),
});

export const verifyBasicBodySchema = z.object({
  name: nameSchema.optional().or(z.literal('')),
  mobile: mobileSchema,
  code: codeSchema,
  tenantId: z.coerce.number().int().positive().optional(),
  tenantCode: z.string().trim().min(1).optional(),
  tenantKey: z.string().trim().min(1).optional(),
  shareCode: z.string().trim().min(1).optional(),
  openId: wechatIdentitySchema.optional(),
  unionId: wechatIdentitySchema.optional(),
  appType: wechatAppTypeSchema.optional(),
})
  .refine((data) => !data.openId || data.appType, {
    message: 'openId 场景下必须提供 appType',
    path: ['appType'],
  });

export const resolveWechatIdentityBodySchema = z
  .object({
    openId: wechatIdentitySchema.optional(),
    unionId: wechatIdentitySchema.optional(),
    appType: wechatAppTypeSchema.optional(),
  })
  .refine((data) => data.unionId || data.openId, {
    message: '至少提供 unionId 或 openId',
    path: ['unionId'],
  })
  .refine((data) => !data.openId || data.appType, {
    message: 'openId 场景下必须提供 appType',
    path: ['appType'],
  });

export const bindWechatIdentityBodySchema = z
  .object({
    customerId: z.coerce.number().int().positive().optional(),
    openId: wechatIdentitySchema.optional(),
    unionId: wechatIdentitySchema.optional(),
    appType: wechatAppTypeSchema.optional(),
  })
  .refine((data) => data.unionId || data.openId, {
    message: '至少提供 unionId 或 openId',
    path: ['unionId'],
  })
  .refine((data) => !data.openId || data.appType, {
    message: 'openId 场景下必须提供 appType',
    path: ['appType'],
  });

export const resolveWechatH5SessionBodySchema = z
  .object({
    code: z.string().trim().min(1).max(512).optional(),
    openId: wechatIdentitySchema.optional(),
    unionId: wechatIdentitySchema.optional(),
    appType: wechatAppTypeSchema.optional(),
  })
  .refine((data) => Boolean(data.code || data.openId || data.unionId), {
    message: '至少提供 code 或 unionId/openId',
    path: ['code'],
  })
  .refine((data) => !data.openId || data.appType, {
    message: 'openId 场景下必须提供 appType',
    path: ['appType'],
  });
