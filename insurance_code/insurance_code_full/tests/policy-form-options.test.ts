import { describe, expect, it } from 'vitest';

import {
  buildPolicyCompanyOptions,
  buildPolicyCoveragePeriodOptions,
  buildPolicyPaymentPeriodOptions,
  normalizePolicyCompany,
  normalizePolicyCoveragePeriod,
  normalizePolicyPaymentPeriod,
} from '../src/lib/policyFormOptions';

describe('policyFormOptions', () => {
  it('normalizes insurer aliases into selectable values', () => {
    expect(normalizePolicyCompany('NCI新华保险')).toBe('新华保险');
    expect(normalizePolicyCompany('泰康人寿保险有限责任公司')).toBe('泰康保险');
    expect(normalizePolicyCompany('中国人民健康保险股份有限公司')).toBe('人保健康');
    expect(buildPolicyCompanyOptions('新华保险')).toContain('新华保险');
    expect(buildPolicyCompanyOptions('泰康人寿保险有限责任公司')).toContain('泰康保险');
  });

  it('normalizes OCR payment period into UI form options', () => {
    expect(normalizePolicyPaymentPeriod('年交/10年')).toBe('10年交');
    expect(normalizePolicyPaymentPeriod('一次交清')).toBe('趸交');
    expect(normalizePolicyPaymentPeriod('20年')).toBe('20年交');
    expect(buildPolicyPaymentPeriodOptions('年交/10年')).toContain('10年交');
  });

  it('keeps OCR coverage period available when it is not a preset option', () => {
    expect(normalizePolicyCoveragePeriod('至2069年10月1日零时')).toBe('至2069年10月1日零时');
    expect(normalizePolicyCoveragePeriod('保至70周岁')).toBe('至70岁');
    expect(buildPolicyCoveragePeriodOptions('至2069年10月1日零时')).toContain('至2069年10月1日零时');
  });
});
