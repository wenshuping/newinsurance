import { afterEach, describe, expect, it, vi } from 'vitest';

import { analyzeInsurancePolicyResponsibilities } from '../server/skeleton-c-v1/services/policy-analysis.service.mjs';

const originalEnv = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
  DEEPSEEK_FALLBACK_MODEL: process.env.DEEPSEEK_FALLBACK_MODEL,
  DEEPSEEK_TIMEOUT_MS: process.env.DEEPSEEK_TIMEOUT_MS,
  DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT: process.env.DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT,
};

afterEach(() => {
  if (originalEnv.DEEPSEEK_API_KEY === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalEnv.DEEPSEEK_API_KEY;
  if (originalEnv.DEEPSEEK_BASE_URL === undefined) delete process.env.DEEPSEEK_BASE_URL;
  else process.env.DEEPSEEK_BASE_URL = originalEnv.DEEPSEEK_BASE_URL;
  if (originalEnv.DEEPSEEK_MODEL === undefined) delete process.env.DEEPSEEK_MODEL;
  else process.env.DEEPSEEK_MODEL = originalEnv.DEEPSEEK_MODEL;
  if (originalEnv.DEEPSEEK_FALLBACK_MODEL === undefined) delete process.env.DEEPSEEK_FALLBACK_MODEL;
  else process.env.DEEPSEEK_FALLBACK_MODEL = originalEnv.DEEPSEEK_FALLBACK_MODEL;
  if (originalEnv.DEEPSEEK_TIMEOUT_MS === undefined) delete process.env.DEEPSEEK_TIMEOUT_MS;
  else process.env.DEEPSEEK_TIMEOUT_MS = originalEnv.DEEPSEEK_TIMEOUT_MS;
  if (originalEnv.DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT === undefined) delete process.env.DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT;
  else process.env.DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT = originalEnv.DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT;
  vi.restoreAllMocks();
});

describe('analyzeInsurancePolicyResponsibilities', () => {
  it('throws a clear error when DeepSeek key is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY;

    await expect(
      analyzeInsurancePolicyResponsibilities({
        policy: {
          company: '中国平安保险',
          name: '平安福21',
        },
      }),
    ).rejects.toMatchObject({
      code: 'POLICY_ANALYSIS_PROVIDER_NOT_READY',
    });
  });

  it('parses structured DeepSeek analysis response', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
    process.env.DEEPSEEK_MODEL = 'deepseek-chat';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'deepseek-chat',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productOverview: '新华保险的“畅行万里”系列以返还型交通意外保障为核心，这张保单更接近畅行万里臻享版两全保险，责任主线是意外高倍赔付加满期返还保费。',
                  coreFeature: '这款产品的核心特点是：在提供多场景高倍交通意外保障的同时，若满期平安生存，还会返还已交保费。',
                  coverageTable: [
                    {
                      coverageType: '满期生存保险金',
                      scenario: '合同期满时仍生存',
                      payout: '返还实际交纳的保费',
                      note: '这是两全险的主要特点，保障和储蓄兼顾。',
                    },
                    {
                      coverageType: '一般意外身故/全残保险金',
                      scenario: '除特定意外外的其他意外',
                      payout: '基本保额的10倍',
                      note: '需以正式条款核对具体责任定义。',
                    },
                  ],
                  exclusions: ['一般免责：故意伤害、犯罪、自杀、吸毒、酒驾、无证驾驶等情形通常不赔。'],
                  purchaseAdvice: '这款产品更适合有长期出行需求、希望保费到期可返还的人群。投保前重点核对保障期间、缴费期以及不同交通意外责任的赔付倍数。',
                  disclaimer: '本分析基于OCR摘录，不替代正式条款。',
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const result = await analyzeInsurancePolicyResponsibilities({
      policy: {
        company: '新华保险',
        name: '畅行万里臻享版两全保险',
        date: '2024-01-15',
        amount: 50000,
        firstPremium: 3496,
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    const systemPrompt = String(requestBody?.messages?.[0]?.content || '');
    const userPrompt = String(requestBody?.messages?.[1]?.content || '');
    expect(systemPrompt).toContain('公开产品资料');
    expect(systemPrompt).toContain('满期金');
    expect(systemPrompt).toContain('投保规则');
    expect(userPrompt).toContain('保险产品：畅行万里臻享版两全保险');
    expect(userPrompt).toContain('投保时间：2024-01-15');
    expect(userPrompt).toContain('保额：50000');
    expect(userPrompt).toContain('年交保费：3496');
    expect(userPrompt).toContain('按产品责任尽量拆解到具体保障场景');
    expect(userPrompt).not.toContain('投保人：');
    expect(userPrompt).not.toContain('被保险人：');
    expect(userPrompt).not.toContain('缴费期间：');
    expect(userPrompt).not.toContain('保障期间：');
    expect(userPrompt).not.toContain('OCR文本：');
    expect(result.productOverview).toBe(
      '新华保险的“畅行万里”系列以返还型交通意外保障为核心，这张保单更接近畅行万里臻享版两全保险，责任主线是意外高倍赔付加满期返还保费。',
    );
    expect(result.coreFeature).toBe(
      '这款产品的核心特点是：在提供多场景高倍交通意外保障的同时，若满期平安生存，还会返还已交保费。',
    );
    expect(result.coverageTable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coverageType: '满期生存保险金',
          scenario: '合同期满时仍生存',
          payout: '返还实际交纳的保费',
          note: '这是两全险的主要特点，保障和储蓄兼顾。',
        }),
      ]),
    );
    expect(result.exclusions).toEqual(['一般免责：故意伤害、犯罪、自杀、吸毒、酒驾、无证驾驶等情形通常不赔。']);
    expect(result.purchaseAdvice).toBe(
      '这款产品更适合有长期出行需求、希望保费到期可返还的人群。投保前重点核对保障期间、缴费期以及不同交通意外责任的赔付倍数。',
    );
    expect(result.disclaimer).toBe('本分析基于OCR摘录，不替代正式条款。');
    expect(result.model).toBe('deepseek-chat');
  });

  it('does not send OCR text even when an OCR payload is provided', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'deepseek-chat',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  productOverview: '测试概述',
                  coreFeature: '测试特点',
                  coverageTable: [
                    {
                      coverageType: '测试责任',
                      scenario: '测试情形',
                      payout: '测试赔付',
                      note: '测试说明',
                    },
                  ],
                  exclusions: ['测试免责'],
                  purchaseAdvice: '测试建议',
                  disclaimer: '测试提示',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await analyzeInsurancePolicyResponsibilities({
      policy: {
        company: '中国平安保险',
        name: '常青树',
        date: '2023-08-08',
        amount: 200000,
        firstPremium: 5200,
      },
      ocrText: '原始OCR文本测试',
      fetchImpl: fetchMock,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    const userPrompt = String(requestBody?.messages?.[1]?.content || '');
    expect(userPrompt).toContain('投保时间：2023-08-08');
    expect(userPrompt).toContain('保额：200000');
    expect(userPrompt).toContain('年交保费：5200');
    expect(userPrompt).not.toContain('补充OCR文本');
    expect(userPrompt).not.toContain('原始OCR文本测试');
  });

  it('normalizes flexible array/object shapes returned by the model', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'deepseek-chat',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '这是一份返还型交通意外险，主线责任是多场景高倍意外赔付和满期返还保费。',
                  mainCoverageBreakdown: [
                    {
                      title: '客运列车/航空意外',
                      detail: '保障情形：乘坐客运列车或民航班机；赔付金额：基本保额的60倍；说明：赔付倍数最高的一项。',
                    },
                  ],
                  riskAlerts: [{ detail: '免责条款未见原文，需要补充条款页。' }],
                  advisorSuggestions: [{ title: '更适合长期出行、希望保费返还的人群投保。' }],
                  coreFeature: '这款产品的核心特点是：兼顾交通意外高倍保障和满期返还保费。',
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await analyzeInsurancePolicyResponsibilities({
      policy: {
        company: '中国平安保险',
        name: '享享人生（825）',
      },
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      productOverview: '这是一份返还型交通意外险，主线责任是多场景高倍意外赔付和满期返还保费。',
      coreFeature: '这款产品的核心特点是：兼顾交通意外高倍保障和满期返还保费。',
      coverageTable: [
        {
          coverageType: '客运列车/航空意外',
          scenario: '乘坐客运列车或民航班机',
          payout: '基本保额的60倍',
          note: '赔付倍数最高的一项。',
        },
      ],
      exclusions: ['免责条款未见原文，需要补充条款页。'],
      purchaseAdvice: '更适合长期出行、希望保费返还的人群投保。',
    });
  });

  it('falls back to chat model when reasoner times out', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-reasoner';
    process.env.DEEPSEEK_FALLBACK_MODEL = 'deepseek-chat';

    const timeoutError = new Error('aborted');
    timeoutError.name = 'AbortError';

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'deepseek-chat',
            choices: [
              {
                message: {
                content: JSON.stringify({
                    productOverview: '这是一份平安长期储蓄型保险保单，当前能确认保额12万元、交费10年、预计总保费约12万元。',
                    coreFeature: '这款产品的核心特点是：通过长期交费形成稳定储蓄安排，责任解释仍需以正式条款核对。',
                    coverageTable: [
                      {
                        coverageType: '主险责任性质',
                        scenario: '当前字段未展示完整责任表',
                        payout: '需以正式条款核对',
                        note: '从当前字段看，更像长期储蓄或领取型责任。',
                      },
                    ],
                    exclusions: ['当前缺少完整责任条款和免责条款页，所有责任解释都需以正式条款核对。'],
                    purchaseAdvice: '建议先补齐正式条款，再向客户解释这张单更偏长期储蓄安排，不要只拿保额做价值判断。',
                    disclaimer: '本分析基于OCR摘录，不替代正式条款。',
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const result = await analyzeInsurancePolicyResponsibilities({
      policy: {
        company: '中国平安保险',
        name: '享享人生（825）',
        paymentPeriod: '10年交',
        amount: '120000',
        firstPremium: '12000',
      },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.model).toBe('deepseek-chat');
    expect(result.productOverview).toContain('预计总保费约12万元');
    expect(result.coverageTable[0]?.coverageType).toBe('主险责任性质');
  });
});
