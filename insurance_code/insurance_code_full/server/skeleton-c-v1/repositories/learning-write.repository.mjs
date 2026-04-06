import { getState, nextId } from '../common/state.mjs';

export const findLearningCourseById = ({ courseId }) => {
  const state = getState();
  const course = (state.learningCourses || []).find((row) => Number(row.id) === Number(courseId));
  return { state, course };
};

export const findCourseCompletion = ({ userId, courseId }) => {
  const state = getState();
  return (state.courseCompletions || []).find((row) => Number(row.userId) === Number(userId) && Number(row.courseId) === Number(courseId));
};

export const createCourseCompletion = ({ userId, courseId, pointsAwarded }) => {
  const state = getState();
  if (!Array.isArray(state.courseCompletions)) state.courseCompletions = [];

  const row = {
    id: nextId(state.courseCompletions),
    userId: Number(userId),
    courseId: Number(courseId),
    pointsAwarded: Number(pointsAwarded || 0),
    createdAt: new Date().toISOString(),
  };
  state.courseCompletions.push(row);
  return row;
};
