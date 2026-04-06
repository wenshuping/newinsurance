import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasConfiguredOcrServiceBaseUrl,
  resolveOcrServiceBaseUrl,
  scanInsurancePolicyOverHttp,
} from '../server/microservices/ocr-service/client.mjs';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('ocr-service client', () => {
  it('resolves OCR service base url from env', () => {
    delete process.env.POLICY_OCR_SERVICE_URL;
    expect(resolveOcrServiceBaseUrl()).toBe('');
    expect(hasConfiguredOcrServiceBaseUrl()).toBe(false);

    process.env.POLICY_OCR_SERVICE_URL = ' http://127.0.0.1:4105/ ';
    expect(resolveOcrServiceBaseUrl()).toBe('http://127.0.0.1:4105');
    expect(hasConfiguredOcrServiceBaseUrl()).toBe(true);
  });

  it('posts scan request to OCR microservice and forwards token', async () => {
    process.env.POLICY_OCR_SERVICE_URL = 'http://127.0.0.1:4105';
    process.env.POLICY_OCR_SERVICE_TOKEN = 'ocr-secret';

    const fetchMock = vi.fn(async (_url, init) => ({
      ok: true,
      text: async () => JSON.stringify({ ok: true, data: { company: '新华保险' }, ocrText: 'OCR' }),
      init,
    }));

    const payload = await scanInsurancePolicyOverHttp(
      {
        uploadItem: {
          name: 'policy.png',
          type: 'image/png',
          dataUrl: 'data:image/png;base64,ZmFrZQ==',
        },
      },
      fetchMock,
    );

    expect(payload).toMatchObject({ ok: true, data: { company: '新华保险' }, ocrText: 'OCR' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:4105/internal/ocr/policies/scan');
    expect(init.method).toBe('POST');
    expect(init.headers['x-ocr-service-token']).toBe('ocr-secret');
  });

  it('omits null uploadItem when proxying OCR text only', async () => {
    process.env.POLICY_OCR_SERVICE_URL = 'http://127.0.0.1:4105';

    const fetchMock = vi.fn(async (_url, init) => ({
      ok: true,
      text: async () => JSON.stringify({ ok: true, data: { company: '中国平安保险' }, ocrText: 'OCR' }),
      init,
    }));

    await scanInsurancePolicyOverHttp(
      {
        uploadItem: null,
        ocrText: '中国平安保险股份有限公司 健康保险保险单',
      },
      fetchMock,
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      ocrText: '中国平安保险股份有限公司 健康保险保险单',
    });
  });

  it('surfaces upstream scan error codes', async () => {
    process.env.POLICY_OCR_SERVICE_URL = 'http://127.0.0.1:4105';

    const fetchMock = vi.fn(async () => ({
      ok: false,
      text: async () => JSON.stringify({ code: 'POLICY_OCR_EMPTY', message: 'empty' }),
    }));

    await expect(
      scanInsurancePolicyOverHttp(
        {
          uploadItem: {
            name: 'policy.png',
            type: 'image/png',
            dataUrl: 'data:image/png;base64,ZmFrZQ==',
          },
        },
        fetchMock,
      ),
    ).rejects.toThrow('POLICY_OCR_EMPTY');
  });

  it('maps network failures to upstream unavailable', async () => {
    process.env.POLICY_OCR_SERVICE_URL = 'http://127.0.0.1:4105';

    const fetchMock = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(
      scanInsurancePolicyOverHttp(
        {
          uploadItem: {
            name: 'policy.png',
            type: 'image/png',
            dataUrl: 'data:image/png;base64,ZmFrZQ==',
          },
        },
        fetchMock,
      ),
    ).rejects.toThrow('POLICY_OCR_UPSTREAM_UNAVAILABLE');
  });
});
