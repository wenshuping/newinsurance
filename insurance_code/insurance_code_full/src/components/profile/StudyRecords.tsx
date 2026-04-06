import React, { useMemo, useState } from 'react';
import { ChevronLeft, PlayCircle, CheckCircle2, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import type { LearningCourse } from '../../lib/api';
import { resolveLearningCoursePreview } from '../../lib/learning-course-preview';

interface Props {
  onClose: () => void;
  courses: LearningCourse[];
  onOpenCourse: (course: LearningCourse) => void;
}

export default function StudyRecords({ onClose, courses, onOpenCourse }: Props) {
  const [tab, setTab] = useState<'all' | 'done' | 'doing'>('all');

  const filtered = useMemo(() => {
    if (tab === 'done') return courses.filter((x) => x.progress >= 100);
    if (tab === 'doing') return courses.filter((x) => x.progress > 0 && x.progress < 100);
    return courses;
  }, [courses, tab]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold pr-8">学习记录</h1>
        </div>
        <div className="mt-3 flex border-b border-slate-100">
          {[
            ['all', '全部'],
            ['done', '已学完'],
            ['doing', '学习中'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`flex-1 py-3 text-sm font-bold border-b-2 ${tab === id ? 'border-sky-500 text-sky-500' : 'border-transparent text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {filtered.map((course) => {
          const done = course.progress >= 100;
          const preview = resolveLearningCoursePreview(course);
          return (
            <article key={course.id} className="bg-white rounded-[28px] p-4 border border-slate-100 shadow-sm min-h-[232px]">
              <div className="flex gap-4 items-stretch">
                <div className="relative w-28 h-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  {preview.kind === 'image' ? (
                    <img
                      src={preview.imageUrl}
                      alt={course.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : preview.kind === 'video' ? (
                    <video
                      src={preview.videoUrl}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-50 text-slate-400">
                      {course.type === 'video' ? <PlayCircle size={28} /> : <FileText size={28} />}
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                    {course.type === 'video' ? '视频课' : '图文课'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col min-h-28">
                  <div className="min-h-[3.5rem]">
                    <h3 className="text-[22px] leading-7 font-bold line-clamp-2 text-slate-950">{course.title}</h3>
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${done ? 'text-emerald-600' : 'text-sky-600'}`}>
                    {done ? `已获得 +${course.points} 积分` : `学习可得 +${course.points} 积分`}
                  </p>
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{done ? '学习状态' : '学习进度'}</span>
                      <span className={`font-bold ${done ? 'text-emerald-600' : 'text-sky-600'}`}>{done ? '已学完' : `${course.progress}%`}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${Math.max(0, Math.min(100, course.progress))}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onOpenCourse(course)}
                className={`mt-4 w-full rounded-2xl py-3 text-base font-bold flex items-center justify-center gap-2 ${done ? 'bg-slate-100 text-slate-700' : 'bg-sky-500 text-white'}`}
              >
                {done ? <CheckCircle2 size={16} /> : <PlayCircle size={16} />}
                {done ? '再次学习' : '继续学习'}
              </button>
            </article>
          );
        })}

        {filtered.length === 0 && <p className="text-sm text-slate-500">暂无记录</p>}
      </main>
    </motion.div>
  );
}
