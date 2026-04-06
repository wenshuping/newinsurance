import React, { useEffect, useState } from 'react';
import { ChevronLeft, Search, PlayCircle, BookOpen, FileText } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import InsuranceClass, { Course } from '../components/learning/InsuranceClass';
import FunGames from '../components/learning/FunGames';
import PracticalTools from '../components/learning/PracticalTools';
import CourseDetail from '../components/learning/CourseDetail';
import { api } from '../lib/api';
import { trackCEvent } from '../lib/track';

interface Props {
  requireAuth: (action: () => void) => void;
  isAuthenticated?: boolean;
  initialTab?: 'class' | 'games' | 'tools';
  initialCourseId?: number | null;
  onCourseChange?: (course: Course | null) => void;
  onBalanceChange?: (balance: number) => void;
}

function iconByType(type: string) {
  if (type === 'video') return PlayCircle;
  if (type === 'comic') return BookOpen;
  return FileText;
}

export default function Learning({
  requireAuth,
  isAuthenticated = false,
  initialTab = 'class',
  initialCourseId = null,
  onCourseChange,
  onBalanceChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<'class' | 'games' | 'tools'>(initialTab);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseRefreshToken, setCourseRefreshToken] = useState(0);
  const previousRouteCourseIdRef = React.useRef<number | null>(initialCourseId ?? null);

  useEffect(() => {
    trackCEvent('c_learning_enter', {
      tab: initialTab,
      courseId: initialCourseId || undefined,
    });
  }, [initialTab, initialCourseId]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!initialCourseId && previousRouteCourseIdRef.current) {
      setSelectedCourse(null);
    }
    previousRouteCourseIdRef.current = initialCourseId ?? null;
    if (!initialCourseId) return;
    if (Number(selectedCourse?.id || 0) === Number(initialCourseId)) return;
    let cancelled = false;
    api.learningCourseDetail(initialCourseId)
      .then((resp) => {
        if (cancelled || !resp?.course) return;
        setSelectedCourse({
          ...resp.course,
          icon: iconByType(resp.course.type),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialCourseId, selectedCourse]);

  const switchTab = (next: 'class' | 'games' | 'tools') => {
    setActiveTab(next);
    trackCEvent('c_learning_switch_tab', { tab: next });
  };

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    onCourseChange?.(course);
  };

  const handleBack = () => {
    setSelectedCourse(null);
    onCourseChange?.(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center p-4">
          <button className="p-1 -ml-1 text-slate-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-xl font-bold">知识学习</h1>
          <button className="p-1 -mr-1 text-slate-700">
            <Search size={24} />
          </button>
        </div>

        <div className="flex border-b border-slate-100">
          <button
            onClick={() => switchTab('class')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'class' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            保险课堂
          </button>
          <button
            onClick={() => switchTab('games')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'games' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            趣味游戏
          </button>
          <button
            onClick={() => switchTab('tools')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'tools' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            实用工具
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'class' && <InsuranceClass onSelectCourse={handleSelectCourse} refreshToken={courseRefreshToken} />}
        {activeTab === 'games' && <FunGames />}
        {activeTab === 'tools' && <PracticalTools />}
      </main>

      <AnimatePresence>
        {selectedCourse && (
          <CourseDetail
            course={selectedCourse}
            onBack={handleBack}
            requireAuth={requireAuth}
            isAuthenticated={isAuthenticated}
            onCompleted={(courseId, nextBalance) => {
              setSelectedCourse((prev) => (prev && Number(prev.id || 0) === Number(courseId || 0) ? { ...prev, progress: 100 } : prev));
              setCourseRefreshToken((prev) => prev + 1);
              if (typeof nextBalance === 'number' && Number.isFinite(nextBalance)) {
                onBalanceChange?.(nextBalance);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
