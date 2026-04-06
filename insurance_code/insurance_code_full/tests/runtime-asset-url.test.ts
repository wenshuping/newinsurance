import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveRuntimeAssetUrl } from '../src/lib/runtime-asset-url';

const originalWindow = global.window;

function mockWindow(href: string) {
  Object.defineProperty(global, 'window', {
    configurable: true,
    value: {
      location: {
        href,
        origin: new URL(href).origin,
      },
    },
  });
}

describe('resolveRuntimeAssetUrl', () => {
  afterEach(() => {
    if (originalWindow === undefined) {
      delete (global as any).window;
      return;
    }
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('rewrites loopback upload urls to the current origin', () => {
    mockWindow('http://10.53.1.245:3003/learning');

    expect(resolveRuntimeAssetUrl('http://127.0.0.1:4100/uploads/demo/video.mp4')).toBe(
      'http://10.53.1.245:3003/uploads/demo/video.mp4'
    );
  });

  it('keeps public cdn urls unchanged', () => {
    mockWindow('http://10.53.1.245:3003/learning');

    expect(resolveRuntimeAssetUrl('https://cdn.example.com/videos/demo.mp4')).toBe(
      'https://cdn.example.com/videos/demo.mp4'
    );
  });

  it('resolves relative upload paths against the current origin', () => {
    mockWindow('http://10.53.1.245:3003/learning');

    expect(resolveRuntimeAssetUrl('/uploads/demo/video.mp4')).toBe('http://10.53.1.245:3003/uploads/demo/video.mp4');
  });
});
