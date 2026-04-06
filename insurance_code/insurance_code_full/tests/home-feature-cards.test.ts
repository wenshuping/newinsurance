import { describe, expect, it } from 'vitest';

import {
  buildAutoFlowTrackItems,
  pickHomeActivities,
  resolveActivityCardImage,
  resolveLearningCardImage,
  resolveLearningCardVideoUrl,
} from '../src/lib/home-feature-cards';

describe('home feature card helpers', () => {
  it('prefers uploaded activity media over fallback image fields', () => {
    expect(
      resolveActivityCardImage({
        media: [{ preview: '/uploads/activity-cover.png' }],
        image: '/uploads/fallback.png',
        cover: '/uploads/fallback-cover.png',
      })
    ).toBe('/uploads/activity-cover.png');
  });

  it('resolves learning card images from uploaded media', () => {
    expect(
      resolveLearningCardImage({
        media: [{ path: '/uploads/course-cover.jpg' }],
        image: '/uploads/course-fallback.jpg',
      })
    ).toBe('/uploads/course-cover.jpg');
  });

  it('prefers explicit cover image for video learning cards', () => {
    expect(
      resolveLearningCardImage({
        media: [{ path: '/uploads/course-video.mp4', type: 'video/mp4' }],
        image: '/uploads/course-video.mp4',
        coverUrl: '/uploads/course-cover.jpg',
      })
    ).toBe('/uploads/course-cover.jpg');
  });

  it('resolves video preview url for learning cards when no image exists', () => {
    expect(
      resolveLearningCardVideoUrl({
        media: [{ path: '/uploads/course-video.mp4', type: 'video/mp4' }],
        videoUrl: '',
      })
    ).toBe('/uploads/course-video.mp4');
  });

  it('shows up to three non-sign activities on the home page first', () => {
    const items = pickHomeActivities([
      { id: 1, title: '签到', category: 'sign', rewardPoints: 1, sortOrder: 1 },
      { id: 2, title: '活动 A', category: 'task', rewardPoints: 8, sortOrder: 2 },
      { id: 3, title: '活动 B', category: 'invite', rewardPoints: 9, sortOrder: 3 },
      { id: 4, title: '活动 C', category: 'competition', rewardPoints: 10, sortOrder: 4 },
      { id: 5, title: '活动 D', category: 'task', rewardPoints: 11, sortOrder: 5 },
    ]);

    expect(items.map((item) => item.id)).toEqual([2, 3, 4]);
  });

  it('falls back to available activities when only sign tasks exist', () => {
    const items = pickHomeActivities([
      { id: 1, title: '签到 A', category: 'sign', rewardPoints: 1, sortOrder: 1 },
      { id: 2, title: '签到 B', category: 'sign', rewardPoints: 2, sortOrder: 2 },
    ]);

    expect(items.map((item) => item.id)).toEqual([1, 2]);
  });

  it('duplicates track items for auto flow when more than two cards exist', () => {
    expect(buildAutoFlowTrackItems([{ id: 1 }, { id: 2 }, { id: 3 }])).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  it('keeps track items as-is when there are two or fewer cards', () => {
    expect(buildAutoFlowTrackItems([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
