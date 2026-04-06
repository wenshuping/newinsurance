import { runInStateTransaction, withIdempotency } from '../common/state.mjs';
import { isPlatformTemplate } from '../common/template-visibility.mjs';
import {
  DEFAULT_COURSE_SOURCE_TYPE,
  mergeVideoChannelMetaIntoMedia,
  resolveCourseSourceType,
  resolveCourseVideoChannelMeta,
  stripVideoChannelMetaFromMedia,
} from '../common/video-channel-course.mjs';
import {
  findCompanyOverrideCourseIndex,
  findLearningCourseById,
  findLearningCourseIndexById,
  insertLearningCourse,
  removeLearningCourseByIndex,
} from '../repositories/p-learning-course-write.repository.mjs';
import { resolvePLearningCourseMedia } from '../services/p-learning-course-media.service.mjs';
import { executeUploadBase64 } from './upload-write.usecase.mjs';

const MAX_BATCH_ITEMS = 20;
const COURSE_CREATE_BIZ_TYPE = 'p.learning.course.create';
const COURSE_BATCH_CREATE_BIZ_TYPE = 'p.learning.course.batch.create';
const toUniquePositiveIds = (ids) =>
  [...new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

const mediaToUrl = (raw) => {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return String(raw.preview || raw.url || raw.path || raw.name || '');
};

const applyVideoChannelCoursePayload = ({ row, media, command }) => {
  const sourceType = resolveCourseSourceType(
    {
      sourceType: command?.sourceType,
      videoChannelMeta: command?.videoChannelMeta,
      media,
    },
    DEFAULT_COURSE_SOURCE_TYPE,
  );
  const videoChannelMeta = resolveCourseVideoChannelMeta({
    sourceType: command?.sourceType,
    videoChannelMeta: command?.videoChannelMeta,
    media,
  });
  const visibleMedia = stripVideoChannelMetaFromMedia(media);
  row.sourceType = sourceType;
  row.videoChannelMeta = videoChannelMeta;
  row.coverUrl = String(command?.coverUrl || videoChannelMeta?.coverUrl || mediaToUrl(visibleMedia[0]) || row.coverUrl || '').trim();
  row.media = media;
};

const createInlineUploadHandler = (command) => {
  if (!command?.uploadDeps) return null;
  return async (item) => {
    const payload = await executeUploadBase64({
      tenantId: Number(command?.tenantContext?.tenantId || 0),
      dataUrl: String(item?.dataUrl || ''),
      type: String(item?.type || 'application/octet-stream'),
      name: String(item?.name || 'upload'),
      protocol: String(command?.protocol || 'http'),
      host: String(command?.host || '127.0.0.1:4000'),
      uploadsRoot: command.uploadDeps.uploadsRoot,
      mkdirRecursive: command.uploadDeps.mkdirRecursive,
      writeFileBuffer: command.uploadDeps.writeFileBuffer,
      nowMs: command.uploadDeps.nowMs,
      randomHex: command.uploadDeps.randomHex,
    });
    return payload.file;
  };
};

const ensureCreatePLearningCoursePermission = ({ command, state }) => {
  const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = command.canOperateTenantTemplates(state, command.actor);
  if (!isPlatformAdmin && !isCompanyActor) throw new Error('COMPANY_ACCOUNT_REQUIRED');
  return { isCompanyAdmin, isPlatformAdmin };
};

const resolveCompanyAdminCourseWriteTarget = ({ command, state, source, tenantId }) => {
  const sourceTemplateId = Number(source.sourceTemplateId || source.id || 0);
  const overrideIndex = findCompanyOverrideCourseIndex({ state, tenantId, sourceTemplateId });
  if (overrideIndex >= 0) return state.learningCourses[overrideIndex];

  const nowIso = new Date().toISOString();
  const row = {
    ...source,
    id: command.nextId(state.learningCourses || []),
    tenantId,
    sourceTemplateId,
    platformTemplate: true,
    templateTag: '平台模板',
    createdBy: Number(command.actor.actorId || source.createdBy || 0),
    creatorRole: 'company_admin',
    templateScope: 'tenant',
    createdAt: nowIso,
    updatedAt: nowIso,
    media: Array.isArray(source.media) ? source.media.slice(0, 7) : [],
  };
  insertLearningCourse({ state, row });
  return row;
};

const createPLearningCourseOnce = async ({ command, state, roleContext, persistState = true }) => {
  const title = String(command.title || '').trim();
  if (!title) throw new Error('COURSE_TITLE_REQUIRED');
  const rewardPoints = Number(command.rewardPoints ?? command.points ?? 0);
  const media = await resolvePLearningCourseMedia({
    media: Array.isArray(command.media) ? command.media : [],
    uploadItems: Array.isArray(command.uploadItems) ? command.uploadItems : [],
    uploadFile: createInlineUploadHandler(command),
    limit: 6,
  });
  const mergedMedia = mergeVideoChannelMetaIntoMedia(media, command.videoChannelMeta);
  const row = {
    id: command.nextId(state.learningCourses || []),
    tenantId: command.tenantContext.tenantId,
    title,
    category: String(command.category || '通用培训'),
    points: rewardPoints,
    rewardPoints,
    sortOrder: Number(command.sortOrder || (state.learningCourses || []).length + 1),
    contentType: String(command.contentType || 'article'),
    status: String(command.status || 'published'),
    level: String(command.level || '中级'),
    content: String(command.content || ''),
    coverUrl: '',
    media: mergedMedia,
    createdBy: Number(command.actor.actorId || 0),
    creatorRole: roleContext.isPlatformAdmin ? 'platform_admin' : roleContext.isCompanyAdmin ? 'company_admin' : 'agent',
    templateScope: roleContext.isPlatformAdmin ? 'platform' : 'tenant',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  applyVideoChannelCoursePayload({ row, media: mergedMedia, command });
  insertLearningCourse({ state, row });
  if (persistState) command.persistState();
  return { ok: true, course: row };
};

const executeCreatePLearningCourseInTransaction = async ({ command, state, persistState = true }) => {
  const roleContext = ensureCreatePLearningCoursePermission({ command, state });
  const createCourse = async () =>
    createPLearningCourseOnce({
      command,
      state,
      roleContext,
      persistState,
    });

  const rawKey = String(command.idempotencyKey || '').trim();
  if (!rawKey) {
    const payload = await createCourse();
    return { ...payload, idempotent: false };
  }

  const idempotent = await withIdempotency({
    tenantId: Number(command?.tenantContext?.tenantId || 1),
    bizType: COURSE_CREATE_BIZ_TYPE,
    bizKey: rawKey,
    execute: createCourse,
  });

  return {
    ...(idempotent.value || { ok: true, course: null }),
    idempotent: idempotent.hit,
  };
};

const buildBatchItemCommand = (command, item) => ({
  title: item?.title,
  category: item?.category,
  rewardPoints: item?.rewardPoints,
  points: item?.points,
  idempotencyKey: item?.idempotencyKey,
  contentType: item?.contentType,
  status: item?.status,
  level: item?.level,
  content: item?.content,
  sourceType: item?.sourceType,
  videoChannelMeta: item?.videoChannelMeta,
  media: Array.isArray(item?.media) ? item.media : [],
  uploadItems: Array.isArray(item?.uploadItems) ? item.uploadItems : [],
  coverUrl: item?.coverUrl,
  protocol: command.protocol,
  host: command.host,
  actor: command.actor,
  tenantContext: command.tenantContext,
  getState: command.getState,
  nextId: command.nextId,
  persistState: command.persistState,
  canOperateTenantTemplates: command.canOperateTenantTemplates,
  uploadDeps: command.uploadDeps,
});

export const executeCreatePLearningCourse = async (command) =>
  runInStateTransaction(async () =>
    executeCreatePLearningCourseInTransaction({
      command,
      state: command.getState(),
      persistState: true,
    })
  );

export const executeCreatePLearningCourseBatch = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const items = Array.isArray(command.items) ? command.items : [];
    if (!items.length) throw new Error('COURSE_BATCH_ITEMS_REQUIRED');
    if (items.length > MAX_BATCH_ITEMS) throw new Error('COURSE_BATCH_ITEMS_LIMIT_EXCEEDED');

    const createBatch = async () => {
      const results = [];
      for (let index = 0; index < items.length; index += 1) {
        try {
          const payload = await executeCreatePLearningCourseInTransaction({
            command: buildBatchItemCommand(command, items[index]),
            state,
            persistState: false,
          });
          results.push({
            index,
            ...payload,
          });
        } catch (err) {
          err.itemIndex = index;
          throw err;
        }
      }
      command.persistState();
      return {
        ok: true,
        total: results.length,
        createdCount: results.filter((item) => item.idempotent === false).length,
        items: results,
        courses: results.map((item) => item.course),
      };
    };

    const rawKey = String(command.idempotencyKey || '').trim();
    if (!rawKey) {
      const payload = await createBatch();
      return { ...payload, idempotent: false };
    }

    const idempotent = await withIdempotency({
      tenantId: Number(command?.tenantContext?.tenantId || 1),
      bizType: COURSE_BATCH_CREATE_BIZ_TYPE,
      bizKey: rawKey,
      execute: createBatch,
    });

    return {
      ...(idempotent.value || { ok: true, total: 0, createdCount: 0, items: [], courses: [] }),
      idempotent: idempotent.hit,
    };
  });

export const executeUpdatePLearningCourse = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const source = findLearningCourseById({ state, id });
    if (!source) throw new Error('COURSE_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const tenantId = Number(command.tenantContext.tenantId || 0);
    let row = source;
    if (isCompanyAdmin && isPlatformTemplate(state, source)) {
      row = resolveCompanyAdminCourseWriteTarget({ command, state, source, tenantId });
    }

    const title = String(command.title ?? row.title ?? '').trim();
    if (!title) throw new Error('COURSE_TITLE_REQUIRED');
    row.title = title;
    row.category = String(command.category ?? row.category ?? '通用培训');
    row.points = Number(command.points ?? command.rewardPoints ?? row.points ?? 0);
    row.rewardPoints = row.points;
    row.sortOrder = Number(command.sortOrder ?? row.sortOrder ?? 1);
    row.contentType = String(command.contentType ?? row.contentType ?? 'article');
    row.status = String(command.status ?? row.status ?? 'published');
    row.level = String(command.level ?? row.level ?? '中级');
    row.content = String(command.content ?? row.content ?? '');
    const nextMediaBase = Array.isArray(command.media) ? command.media.slice(0, 6) : row.media;
    const nextVideoChannelMeta =
      command.videoChannelMeta !== undefined ? command.videoChannelMeta : row.videoChannelMeta;
    const mergedMedia = mergeVideoChannelMetaIntoMedia(nextMediaBase, nextVideoChannelMeta);
    applyVideoChannelCoursePayload({
      row,
      media: mergedMedia,
      command: {
        ...row,
        coverUrl: command.coverUrl,
        sourceType: command.sourceType ?? row.sourceType,
        videoChannelMeta: nextVideoChannelMeta,
      },
    });
    row.updatedAt = new Date().toISOString();
    command.persistState();
    return { ok: true, course: row };
  });

const deleteLearningCourseById = ({ command, state, id, strict = true }) => {
  let index = findLearningCourseIndexById({ state, id });
  if (index < 0) {
    if (!strict) return false;
    throw new Error('COURSE_NOT_FOUND');
  }

  const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
  const target = state.learningCourses[index];
  if (isCompanyAdmin && isPlatformTemplate(state, target)) {
    const tenantId = Number(command.tenantContext.tenantId || 0);
    index = findCompanyOverrideCourseIndex({
      state,
      tenantId,
      sourceTemplateId: Number(target.sourceTemplateId || target.id || 0),
    });
    if (index < 0) throw new Error('PLATFORM_TEMPLATE_SOURCE_IMMUTABLE');
  }

  if (!command.canAccessTemplate(state, command.actor, state.learningCourses[index])) throw new Error('NO_PERMISSION');
  const removed = removeLearningCourseByIndex({ state, index });
  if (!removed) {
    if (!strict) return false;
    throw new Error('COURSE_NOT_FOUND');
  }
  return true;
};

export const executeDeletePLearningCourse = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    deleteLearningCourseById({ command, state, id, strict: true });
    command.persistState();
    return { ok: true };
  });

export const executeDeletePLearningCourseBatch = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const ids = toUniquePositiveIds(command.ids);
    if (!ids.length) throw new Error('COURSE_BATCH_DELETE_IDS_REQUIRED');

    const deletedIds = [];
    for (const id of ids) {
      if (deleteLearningCourseById({ command, state, id, strict: false })) {
        deletedIds.push(id);
      }
    }

    command.persistState();
    return {
      ok: true,
      deletedCount: deletedIds.length,
      ids: deletedIds,
    };
  });

export const executeReorderPLearningCourses = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const ids = toUniquePositiveIds(command.ids);
    if (!ids.length) throw new Error('COURSE_REORDER_IDS_REQUIRED');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const tenantId = Number(command.tenantContext.tenantId || 0);
    const orderedRows = ids.map((id) => {
      const source = findLearningCourseById({ state, id });
      if (!source) throw new Error('COURSE_NOT_FOUND');
      if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION');
      if (isCompanyAdmin && isPlatformTemplate(state, source)) {
        return resolveCompanyAdminCourseWriteTarget({ command, state, source, tenantId });
      }
      return source;
    });

    const requestedIds = new Set(ids);
    const targetIds = new Set(orderedRows.map((row) => Number(row.id || 0)));
    const remainingRows = (state.learningCourses || [])
      .filter((row) => command.canAccessTemplate(state, command.actor, row))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0))
      .filter((row) => {
        const rowId = Number(row.id || 0);
        return !requestedIds.has(rowId) && !targetIds.has(rowId);
      });

    const finalRows = [...orderedRows, ...remainingRows];
    const nowIso = new Date().toISOString();
    finalRows.forEach((row, index) => {
      row.sortOrder = index + 1;
      row.updatedAt = nowIso;
    });

    command.persistState();
    return { ok: true };
  });
