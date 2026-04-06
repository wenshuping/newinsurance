import { describe, expect, it } from 'vitest';

import {
  extractBaiduPrivateOcrText,
  extractPolicyFieldsFromImageWithOllamaVision,
  extractPaddleOcrText,
  extractPolicyFieldsFromText,
  normalizeExtractedPolicyFields,
  selectBestPolicyScanCandidate,
} from '../server/skeleton-c-v1/services/insurance-ocr.service.mjs';

describe('extractPolicyFieldsFromText', () => {
  it('extracts labeled fields from OCR text', () => {
    const payload = extractPolicyFieldsFromText(`
      保险公司：中国平安保险
      险种名称：平安福21重大疾病保险
      投保人：温哈哈
      被保险人：温哈哈
      合同成立日：2024年02月20日
      交费期间：20年交
      保险期间：终身
      基本保险金额：500,000元
      首期保险费：12,000元
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '平安福21重大疾病保险',
      applicant: '温哈哈',
      insured: '温哈哈',
      date: '2024-02-20',
      paymentPeriod: '20年交',
      coveragePeriod: '终身',
      amount: '500000',
      firstPremium: '12000',
    });
  });

  it('normalizes wan-based amounts from noisy OCR text', () => {
    const payload = extractPolicyFieldsFromText(`
      中国人寿保险股份有限公司
      产品名称 国寿如E康悦百万医疗保险
      投保人 李四 被保险人 李四
      生效日期 2025/03/01
      缴费年期 趸交
      保障期间 1年
      保额 100万
      首年保费 3.6万
    `);

    expect(payload.company).toBe('中国人寿保险');
    expect(payload.name).toBe('国寿如E康悦百万医疗保险');
    expect(payload.date).toBe('2025-03-01');
    expect(payload.paymentPeriod).toBe('趸交');
    expect(payload.coveragePeriod).toBe('1年');
    expect(payload.amount).toBe('1000000');
    expect(payload.firstPremium).toBe('36000');
  });

  it('supports 投保公司 labels without falling back to unrelated insurance lines', () => {
    const payload = extractPolicyFieldsFromText(`
      投保公司：中国平安
      产品名称：平安福终身寿险
      投保人：张三
      被保险人：李四
      生效日期：2026年03月01日
      缴费期限：20年
      保险期间：终身
      保险金额：100万
      首年保费：3600元
    `);

    expect(payload.company).toBe('中国平安保险');
    expect(payload.insured).toBe('李四');
  });

  it('supports other insurers and broader field aliases from labeled policy text', () => {
    const payload = extractPolicyFieldsFromText(`
      保险人：泰康人寿保险有限责任公司
      主险名称：泰康乐享健康重大疾病保险
      投保人姓名：张三
      被保险人姓名：李四
      保险起期：2025年03月15日
      交费年限：20年
      保障期限：终身
      基本保额：300000元
      首年应交保费：5680元
    `);

    expect(payload).toMatchObject({
      company: '泰康保险',
      name: '泰康乐享健康重大疾病保险',
      applicant: '张三',
      insured: '李四',
      date: '2025-03-15',
      paymentPeriod: '20年交',
      coveragePeriod: '终身',
      amount: '300000',
      firstPremium: '5680',
    });
  });

  it('recognizes company header aliases and non-standard labels for other insurers', () => {
    const payload = extractPolicyFieldsFromText(`
      中国人民健康保险股份有限公司
      保险产品名称：好医保长期医疗保险
      要保人：王五
      受保人：王五
      生效时间：2025/01/08
      缴费年限：1年
      保险责任期间：1年
      基本保险金额：400万
      首次保费：1280元
    `);

    expect(payload).toMatchObject({
      company: '人保健康',
      name: '好医保长期医疗保险',
      applicant: '王五',
      insured: '王五',
      date: '2025-01-08',
      paymentPeriod: '1年交',
      coveragePeriod: '1年',
      amount: '4000000',
      firstPremium: '1280',
    });
  });

  it('extracts table-style fields from Ping An policy layouts', () => {
    const payload = extractPolicyFieldsFromText(`
      中国平安 PINGAN
      中国平安人寿保险股份有限公司
      保险单
      保险合同成立及生效日：2010年12月20日 00:00
      投保人：秦国英
      被保险人：杜金坤
      保险项目
      保险期间
      交费年限
      基本保险金额/份数/档次
      保险费
      投保主险：享享人生（825）
      42年
      10年
      120,000元
      12,000.00元
      首期保费合计：（年交）人民币壹万贰仟元整（RMB12000.00）
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '享享人生（825）',
      applicant: '秦国英',
      insured: '杜金坤',
      date: '2010-12-20',
      paymentPeriod: '10年交',
      coveragePeriod: '42年',
      amount: '120000',
      firstPremium: '12000',
    });
  });

  it('extracts compact Ping An OCR rows without misreading product code as amount', () => {
    const payload = extractPolicyFieldsFromText(`
      中国平安人寿保险股份有限公司保险单
      保险合同成立及生效日 2010年12月20日 00:00
      投保人 秦国英 性别 女 生日 1970年01月06日 证件号码
      被保险人 杜金坤 性别 男 生日 1967年01月19日 证件号码
      及保险主要事项
      投保主险 享享人生（825） 42年 10年 120,000元 12,000.00元
      首期保费合计（年交）RMB12000.00
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '享享人生（825）',
      applicant: '秦国英',
      insured: '杜金坤',
      date: '2010-12-20',
      paymentPeriod: '10年交',
      coveragePeriod: '42年',
      amount: '120000',
      firstPremium: '12000',
    });
  });

  it('extracts insurer and one-row horizontal table values from Ping An health policy layouts', () => {
    const payload = extractPolicyFieldsFromText(`
      中国平安保险股份有限公司
      PING AN INSURANCE COMPANY OF CHINA, LTD.
      健康保险保险单
      投保人：杜金坤
      客户号码：C12020015308
      承保日期：02/10/2002
      合同生效日期：2002年02月09日
      总保费(人民币)：叁仟捌佰伍拾圆整(3850.00)
      被保险人及保险主要事项
      被保险人
      客户号码
      保险险种
      保险期限
      缴费年期
      缴费方式
      保险金额(元)
      保险费(元)
      杜金坤
      C12020015308
      常青树
      终身
      25
      年缴
      100000.00
      3850.00
      身故受益人：第一顺位：秦国英100%
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002-02-09',
      paymentPeriod: '25年交',
      coveragePeriod: '终身',
      amount: '100000',
      firstPremium: '3850',
    });
  });

  it('extracts inline label-value rows when OCR compresses the table into one stream', () => {
    const payload = extractPolicyFieldsFromText(`
      中国平安保险股份有限公司 健康保险保险单
      投保人 杜金坤
      合同生效日期 2002年02月09日
      被保险人 杜金坤 客户号码 C12020015308 保险险种 常青树 保险期限 终身 缴费年期 25 缴费方式 年缴 保险金额(元) 100000.00 保险费(元) 3850.00
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002-02-09',
      paymentPeriod: '25年交',
      coveragePeriod: '终身',
      amount: '100000',
      firstPremium: '3850',
    });
  });

  it('extracts one-line header row plus one-line value row from health policy OCR text', () => {
    const payload = extractPolicyFieldsFromText(`
      PING AN INSURANCE COMPANY OF CHINA, LTD.
      健康保险保险单
      投保人 杜金坤
      合同生效日期 2002年02月09日
      被保险人 客户号码 保险险种 保险期限 缴费年期 缴费方式 保险金额(元) 保险费(元)
      杜金坤 C12020015308 常青树 终身 25 年缴 100000.00 3850.00
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002-02-09',
      paymentPeriod: '25年交',
      coveragePeriod: '终身',
      amount: '100000',
      firstPremium: '3850',
    });
  });

  it('extracts compact health policy rows even when the table headers are missing', () => {
    const payload = extractPolicyFieldsFromText(`
      中国平安保险股份有限公司
      健康保险保险单
      投保人 杜金坤
      合同生效日期 2002年02月09日
      杜金坤C12020015308 常青树终身 25 年缴 100000.00 3850.00
      身故受益人 第一顺位：秦国英 100%
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002-02-09',
      paymentPeriod: '25年交',
      coveragePeriod: '终身',
      amount: '100000',
      firstPremium: '3850',
    });
  });

  it('extracts compressed horizontal header-value rows when OCR merges headers and values together', () => {
    const payload = extractPolicyFieldsFromText(`
      中国平安保险股份有限公司 健康保险保险单
      投保人 杜金坤
      合同生效日期 2002年02月09日
      被保险人客户号码保险险种保险期限缴费年期缴费方式保险金额(元)保险费(元)杜金坤C12020015308常青树终身25年缴100000.003850.00
      身故受益人第一顺位秦国英100%
    `);

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002-02-09',
      paymentPeriod: '25年交',
      coveragePeriod: '终身',
      amount: '100000',
      firstPremium: '3850',
    });
  });

  it('normalizes local LLM OCR post-processor payloads into policy fields', () => {
    const payload = normalizeExtractedPolicyFields({
      company: 'PING AN INSURANCE COMPANY OF CHINA, LTD.',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002年02月09日',
      paymentPeriod: '',
      paymentYears: '25',
      paymentMode: '年缴',
      coveragePeriod: '终身',
      amount: '100000.00',
      firstPremium: '3850.00',
    });

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002-02-09',
      paymentPeriod: '25年交',
      coveragePeriod: '终身',
      amount: '100000',
      firstPremium: '3850',
    });
  });

  it('extracts table-style policy fields from新华保险样式文本', () => {
    const payload = extractPolicyFieldsFromText(`
      NCI 新华保险
      合同成立日期：2025年09月30日
      合同生效日期：2025年10月01日
      投保人：温舒萍
      被保险人：温舒萍
      险种名称
      畅行万里臻享版
      两全保险
      50000.00元
      至2069年10月1日零时
      年交
      /10年
      每年2760.00元
      附加住院补贴A款
      医疗保险
      3份
      至2026年09月30日
      一次交清
      396.00元
      女性特定疾病保险
      100000.00元
      首期保险费合计：3496.00元
    `);

    expect(payload.company).toBe('新华保险');
    expect(payload.name).toBe('畅行万里臻享版两全保险 / 附加住院补贴A款医疗保险 / 女性特定疾病保险');
    expect(payload.applicant).toBe('温舒萍');
    expect(payload.insured).toBe('温舒萍');
    expect(payload.date).toBe('2025-09-30');
    expect(payload.paymentPeriod).toBe('年交/10年');
    expect(payload.coveragePeriod).toBe('至2069年10月1日零时');
    expect(payload.amount).toBe('50000');
    expect(payload.firstPremium).toBe('3496');
  });

  it('fuses Paddle 和 Vision 的原始输出，返回更完整的保单字段', () => {
    const paddle = `
      ONCI新华保险
      关爱人生每一天
      保险单
      币值单位：人民币元
      保险合同号：990193250202
      基本内容
      合同成立日期：2025年09月30日
      合同生效日期：2025年10月01日
      投保人：温舒萍
      证件号码：
      被保险人：温舒萍
      证件号码：
      OCA
      EUJNZ4
      身故保险金受益人
      证件号码
      受益顺序
      受益份额
      被保险人的法定继承人
      保险利益表
      险种名称
      基本保险金额/保险金额
      保险期间
      交费方式
      保险费约定支付日
      保险费
      /保障计划/份数
      /交费期间（续期保险费交费日期）
      /交费期满日
      每年10月01日
      每年2760.00元
      畅行万里臻享版
      50000.00元
      至2069年10月1日零时
      年交
      两全保险
      /10年
      /2034年10月01日
      3份
      一次交清
      396.00元
      附加住院补贴A款
      至2026年09月30日
      医疗保险
      340.00元
      i她A款女性特定疾病
      100000.00元
      至2026年09月30日一次交清
      保险
      ￥3496.00
      首期保险费合计：（大写）叁仟肆佰玖拾陆元整
      特别约定：
      本栏空白
    `;
    const vision = `
      2 NCI新华保险
      关爱人生每一天
      币值单位：人民币元
      保险单
      基本内容
      合同成立日期：2025年09月30日
      投保人：温舒萍
      被保险人：温舒萍
      身故保险金受益人
      被保险人的法定继承人
      险种名称
      畅行万里臻享版
      两全保险
      附加住院补贴A款
      医疗保险
      i她A款女性特定疾病
      保险
      特别约定：
      本栏空白
      保险合同号：990193250202
      合同生效日期：2025年10月01日
      证件号码：C00r
      证件号码：-360
      受益顺序
      基本保险金额/保险金额
      /保障计划/份数
      50000.00元
      3份
      100000.00元
      证件号码
      受益份额
      保险利益表
      保险期间
      至2069年10月1日零时 年交
      /10年
      交费方式 保险费约定支付日
      /交费期间（续期保险费交费日期〉
      /交费期满日
      每年10月01日
      /2034年10月01日
      保险费
      每年2760.00元
      至2026年09月30日一次交清
      396.00元
      340.00元
      至2026年09月30日一次交清
      首期保险费合计：（大写）叁仟肆佰玖拾陆元整 ¥3496.00
    `;
    const payload = selectBestPolicyScanCandidate([paddle, vision]).data;

    expect(payload).toMatchObject({
      company: '新华保险',
      name: '畅行万里臻享版两全保险 / 附加住院补贴A款医疗保险 / i她A款女性特定疾病保险',
      applicant: '温舒萍',
      insured: '温舒萍',
      date: '2025-09-30',
      paymentPeriod: '年交/10年',
      coveragePeriod: '至2069年10月1日零时',
      amount: '50000',
      firstPremium: '3496',
    });
  });
});

describe('extractBaiduPrivateOcrText', () => {
  it('joins baidu words_result arrays into normalized OCR text', () => {
    const text = extractBaiduPrivateOcrText({
      words_result: [{ words: '投保公司：中国平安' }, { words: '投保人：温舒萍' }, { words: '首年保费：3496.00元' }],
    });

    expect(text).toBe('投保公司:中国平安\n投保人:温舒萍\n首年保费:3496.00元');
  });

  it('supports nested baidu private payload shapes', () => {
    const text = extractBaiduPrivateOcrText({
      data: {
        words_result: [{ words: '保险期间：至2069年10月1日零时' }, { words: '交费方式：年交/10年' }],
      },
    });

    expect(text).toBe('保险期间:至2069年10月1日零时\n交费方式:年交/10年');
  });
});

describe('extractPaddleOcrText', () => {
  it('joins line arrays emitted by paddle helper scripts', () => {
    const text = extractPaddleOcrText({
      lines: ['投保公司：中国平安', '投保人：温舒萍', '首年保费：3496.00元'],
    });

    expect(text).toBe('投保公司:中国平安\n投保人:温舒萍\n首年保费:3496.00元');
  });

  it('supports raw PaddleOCR result payloads with rec_texts', () => {
    const text = extractPaddleOcrText({
      result: [
        {
          res: {
            rec_texts: ['投保公司：中国平安', '产品名称：畅行万里臻享版两全保险'],
          },
        },
      ],
    });

    expect(text).toBe('投保公司:中国平安\n产品名称:畅行万里臻享版两全保险');
  });
});

describe('extractPolicyFieldsFromImageWithOllamaVision', () => {
  it('normalizes structured fields returned by qwen vision', async () => {
    const payload = await extractPolicyFieldsFromImageWithOllamaVision(
      {
        name: 'policy.jpg',
        type: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
      },
      async (_url, options) => {
        const request = JSON.parse(String(options?.body || '{}'));
        expect(request.options?.num_ctx).toBe(512);
        return {
          ok: true,
          json: async () => ({
            message: {
              content: JSON.stringify({
                company: '中国平安保险股份有限公司',
                name: '常青树',
                applicant: '杜金坤',
                insured: '杜金坤',
                date: '2002年02月09日',
                paymentYears: '25',
                paymentMode: '年缴',
                coveragePeriod: '终身',
                amount: '100000.00',
                firstPremium: '3850.00',
              }),
            },
          }),
        };
      },
    );

    expect(payload).toMatchObject({
      company: '中国平安保险',
      name: '常青树',
      applicant: '杜金坤',
      insured: '杜金坤',
      date: '2002-02-09',
      paymentPeriod: '25年交',
      coveragePeriod: '终身',
      amount: '100000',
      firstPremium: '3850',
    });
  });
});
