import { runInStateTransaction } from '../common/state.mjs';
import { resolveLearningWriteContentType } from '../common/learning-course-content-type.mjs';
import { isPlatformTemplate } from '../common/template-visibility.mjs';
import {
  findActorLearningCourseOverrideBySource,
  findLearningCourseById,
  findLearningCourseIndexById,
  findCompanyOverrideCourseIndex,
  findPLearningMaterialByCourseId,
  forEachPLearningMaterialByCourseId,
  insertLearningCourse,
  insertPLearningMaterial,
  removeLearningCourseByIndex,
  removePLearningMaterialsByCourseId,
} from '../repositories/b-content-write.repository.mjs';

const toMedia = (rawMedia) =>
  Array.isArray(rawMedia)
    ? rawMedia.slice(0, 6).map((x) => (typeof x === 'string' ? { name: x, type: 'image/*', preview: x } : x))
    : [];

const mediaToUrl = (raw) => {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return String(raw.preview || raw.url || raw.path || raw.name || '');
};

const resolveActorTemplateRole = (state, actor, hasRole) => {
  const actorIdentity = {
    tenantId: Number(actor?.tenantId || 0),
    userType: String(actor?.actorType || 'agent'),
    userId: Number(actor?.actorId || 0),
  };
  if (hasRole(state, actorIdentity, 'platform_admin')) return 'platform_admin';
  if (hasRole(state, actorIdentity, 'company_admin')) return 'company_admin';
  if (hasRole(state, actorIdentity, 'team_lead')) return 'team_lead';
  return 'agent';
};

export const executeCreateBContentItem = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext.tenantId || 0);
    const actorIdentity = {
      tenantId,
      userType: String(command.actor.actorType || 'agent'),
      userId: Number(command.actor.actorId || 0),
    };
    const creatorRole = command.hasRole(state, actorIdentity, 'platform_admin')
      ? 'platform_admin'
      : command.hasRole(state, actorIdentity, 'company_admin')
        ? 'company_admin'
        : 'agent';
    const templateScope = creatorRole === 'platform_admin' ? 'platform' : 'tenant';
    const title = String(command.title || '').trim();
    if (!title) throw new Error('TITLE_REQUIRED');

    const media = toMedia(command.media);
    const rewardPoints = Number(command.rewardPoints ?? command.points ?? 0);
    const coverUrl = String(command.coverUrl || mediaToUrl(media[0]) || '').trim();
    const contentType = resolveLearningWriteContentType({
      contentType: command.contentType,
      media,
    });
    const now = new Date().toISOString();
    const item = {
      id: command.nextId(state.learningCourses || []),
      tenantId,
      title,
      category: String(command.category || '通用培训'),
      points: rewardPoints,
      rewardPoints,
      contentType,
      status: String(command.status || 'published'),
      level: String(command.level || '中级'),
      content: String(command.body || ''),
      sortOrder: Number(command.sortOrder || 1),
      coverUrl,
      media,
      createdBy: command.actor.actorId,
      creatorRole,
      templateScope,
      createdAt: now,
      updatedAt: now,
    };
    insertLearningCourse({ state, row: item });
    insertPLearningMaterial({
      state,
      row: {
        id: command.nextId(state.pLearningMaterials || []),
        sourceCourseId: Number(item.id),
        tenantId,
        title: item.title,
        body: item.content,
        rewardPoints,
        coverUrl,
        sortOrder: item.sortOrder,
        media,
        createdBy: item.createdBy,
        creatorRole,
        templateScope,
        createdAt: item.createdAt,
      },
    });
    command.persistState();
    return { ok: true, item };
  });

export const executeUpdateBContentItem = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const source = findLearningCourseById({ state, id });
    if (!source) throw new Error('CONTENT_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION');

    const actorRole = resolveActorTemplateRole(state, command.actor, command.hasRole);
    const shouldCreatePersonalOverride =
      String(source.creatorRole || '').trim().toLowerCase() === 'company_admin' &&
      actorRole !== 'company_admin' &&
      actorRole !== 'platform_admin';

    let row = source;
    if (shouldCreatePersonalOverride) {
      row =
        findActorLearningCourseOverrideBySource({
          state,
          tenantId: Number(command.tenantContext?.tenantId || command.actor?.tenantId || source.tenantId || 0),
          sourceTemplateId: id,
          actorId: Number(command.actor?.actorId || 0),
        }) || null;
      if (!row) {
        const now = new Date().toISOString();
        row = {
          ...source,
          id: command.nextId(state.learningCourses || []),
          tenantId: Number(command.tenantContext?.tenantId || command.actor?.tenantId || source.tenantId || 0),
          sourceTemplateId: id,
          createdBy: Number(command.actor?.actorId || 0),
          creatorRole: actorRole,
          templateScope: 'tenant',
          platformTemplate: false,
          createdAt: now,
          updatedAt: now,
        };
        insertLearningCourse({ state, row });
        insertPLearningMaterial({
          state,
          row: {
            id: command.nextId(state.pLearningMaterials || []),
            sourceCourseId: Number(row.id),
            tenantId: Number(row.tenantId || 0),
            title: String(row.title || ''),
            body: String(row.content || ''),
            rewardPoints: Number(row.rewardPoints || row.points || 0),
            coverUrl: String(row.coverUrl || ''),
            sortOrder: Number(row.sortOrder || 1),
            media: Array.isArray(row.media) ? row.media : [],
            createdBy: row.createdBy,
            creatorRole: row.creatorRole,
            templateScope: row.templateScope,
            status: String(row.status || 'draft'),
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }

    const title = String(command.title ?? row?.title ?? '').trim();
    if (!title) throw new Error('TITLE_REQUIRED');
    const media = Array.isArray(command.media) ? toMedia(command.media) : Array.isArray(row?.media) ? row.media : [];
    const rewardPoints = Number(command.rewardPoints ?? command.points ?? row?.rewardPoints ?? row?.points ?? 0);
    const contentType = resolveLearningWriteContentType({
      contentType: command.contentType ?? row?.contentType,
      media,
    });

    row.title = title;
    row.category = String(command.category ?? row.category ?? '通用培训');
    row.points = rewardPoints;
    row.rewardPoints = rewardPoints;
    row.contentType = contentType;
    row.status = String(command.status ?? row.status ?? 'published');
    row.level = String(command.level ?? row.level ?? '中级');
    row.content = String(command.body ?? row.content ?? '');
    row.sortOrder = Number(command.sortOrder ?? row.sortOrder ?? 1);
    row.media = media;
    row.coverUrl = String(command.coverUrl || mediaToUrl(media[0]) || row.coverUrl || '').trim();
    row.updatedAt = new Date().toISOString();

    const material = findPLearningMaterialByCourseId({ state, courseId: row.id });
    if (!material) {
      insertPLearningMaterial({
        state,
        row: {
          id: command.nextId(state.pLearningMaterials || []),
          sourceCourseId: Number(row.id || 0),
          tenantId: Number(row.tenantId || 0),
          title: row.title,
          body: row.content,
          rewardPoints,
          coverUrl: row.coverUrl,
          sortOrder: row.sortOrder,
          media: row.media,
          createdBy: row.createdBy,
          creatorRole: row.creatorRole,
          templateScope: row.templateScope,
          status: row.status,
          createdAt: row.createdAt || row.updatedAt,
          updatedAt: row.updatedAt,
        },
      });
    }
    forEachPLearningMaterialByCourseId({
      state,
      courseId: row.id,
      callback: (material) => {
        material.title = row.title;
        material.body = row.content;
        material.rewardPoints = rewardPoints;
        material.coverUrl = row.coverUrl;
        material.sortOrder = row.sortOrder;
        material.media = row.media;
        material.status = row.status;
        material.updatedAt = row.updatedAt;
      },
    });
    command.persistState();
    return { ok: true, item: row };
  });

const resolveDeleteTargetIndex = ({ command, state, id }) => {
  let index = findLearningCourseIndexById({ state, id });
  if (index < 0) throw new Error('CONTENT_NOT_FOUND');

  const target = state.learningCourses[index];
  const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
  if (isCompanyAdmin && isPlatformTemplate(state, target)) {
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    index = findCompanyOverrideCourseIndex({
      state,
      tenantId,
      sourceTemplateId: Number(target.sourceTemplateId || target.id || 0),
    });
    if (index < 0) throw new Error('PLATFORM_TEMPLATE_SOURCE_IMMUTABLE');
  }

  if (!command.canAccessTemplate(state, command.actor, state.learningCourses[index])) throw new Error('NO_PERMISSION');
  return index;
};

export const executeDeleteBContentItem = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const index = resolveDeleteTargetIndex({ command, state, id });
    const removed = removeLearningCourseByIndex({ state, index });
    if (!removed) throw new Error('CONTENT_NOT_FOUND');
    removePLearningMaterialsByCourseId({ state, courseId: Number(removed.id || id) });
    command.persistState();
    return { ok: true };
  });

export const executeReorderBContentItems = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const ids = [...new Set((Array.isArray(command.ids) ? command.ids : []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) throw new Error('COURSE_REORDER_IDS_REQUIRED');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const orderedRows = ids.map((id) => {
      const source = findLearningCourseById({ state, id });
      if (!source) throw new Error('CONTENT_NOT_FOUND');
      if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION');
      if (isCompanyAdmin && isPlatformTemplate(state, source)) {
        const overrideIndex = findCompanyOverrideCourseIndex({
          state,
          tenantId,
          sourceTemplateId: Number(source.sourceTemplateId || source.id || 0),
        });
        if (overrideIndex >= 0) return state.learningCourses[overrideIndex];
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
      const nextSort = index + 1;
      row.sortOrder = nextSort;
      row.updatedAt = nowIso;
      forEachPLearningMaterialByCourseId({
        state,
        courseId: row.id,
        callback: (material) => {
          material.sortOrder = nextSort;
          material.updatedAt = nowIso;
        },
      });
    });

    command.persistState();
    return { ok: true };
  });
