import React, { useState, useRef } from 'react';
import { ChevronLeft, Share2, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { Course } from './InsuranceClass';
import { NOTICE_COPY } from '../../lib/noticeCopy';
import { ACTION_COPY } from '../../lib/uiCopy';

interface Props {
  course: Course;
  onBack: () => void;
}

export default function CourseDetail({ course, onBack }: Props) {
  const [videoProgress, setVideoProgress] = useState(course.progress);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setVideoProgress(progress || 0);
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">{ACTION_COPY.cCourseDetailTitle}</h1>
        <button className="p-2 -mr-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <Share2 size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Media */}
        {course.type === 'video' ? (
          <div className="w-full bg-black relative">
            <video 
              ref={videoRef}
              src={course.videoUrl || 'https://www.w3schools.com/html/mov_bbb.mp4'} 
              controls 
              className="w-full aspect-video object-contain"
              poster={course.image}
              onTimeUpdate={handleTimeUpdate}
            />
            {/* Custom Learning Progress Bar for Video */}
            <div className="bg-white px-5 pt-4 pb-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                <span>{ACTION_COPY.cCourseCurrentProgress}</span>
                <span className="text-blue-500">{Math.round(videoProgress)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${videoProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-video relative">
            <img src={course.image} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        )}

        {/* Info */}
        <div className="p-5 space-y-5">
          <div className="flex justify-between items-start gap-4">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{course.title}</h2>
          </div>
          
          <div className="flex items-center gap-2 text-orange-500 bg-orange-50 w-fit px-3 py-1.5 rounded-full">
            <Award size={18} />
            <span className="text-sm font-bold">{ACTION_COPY.cCourseRewardPrefix}{course.points}{ACTION_COPY.cExchangePointSuffix}</span>
          </div>

          <div className="pt-5 border-t border-slate-100">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
              {ACTION_COPY.cCourseContentTitle}
            </h3>
            <div className="text-slate-600 leading-relaxed space-y-4 text-sm">
              <p>{course.content}</p>
              <p>{ACTION_COPY.cCourseExtraIntro}</p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                <h4 className="font-bold text-slate-800 mb-2">{ACTION_COPY.cCourseTipsTitle}</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>{ACTION_COPY.cCourseTip1}</li>
                  <li>{ACTION_COPY.cCourseTip2}</li>
                  <li>{ACTION_COPY.cCourseTip3}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => {
            alert(`${NOTICE_COPY.cCourseCompleteRewardPrefix}${course.points}${NOTICE_COPY.cCourseCompleteRewardSuffix}`);
            onBack();
          }}
          className="w-full bg-blue-500 text-white font-bold text-lg py-3.5 rounded-full shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform"
        >
          {ACTION_COPY.cCourseCompleteAction}
        </button>
      </div>
    </motion.div>
  );
}
