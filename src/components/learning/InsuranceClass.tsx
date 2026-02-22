import React, { useState } from 'react';
import { PlayCircle, BookOpen, FileText, Heart } from 'lucide-react';

export interface Course {
  id: number;
  title: string;
  desc: string;
  type: 'video' | 'comic' | 'article';
  typeLabel: string;
  icon: any;
  progress: number;
  timeLeft: string;
  image: string;
  action: string;
  color: string;
  btnColor: string;
  points: number;
  content: string;
}

interface Props {
  onSelectCourse: (course: Course) => void;
}

export default function InsuranceClass({ onSelectCourse }: Props) {
  const [activeCategory, setActiveCategory] = useState('全部');
  const categories = ['全部', '养老', '医疗', '少儿', '理财', '理赔'];

  const courses: Course[] = [
    {
      id: 1,
      title: '如何使用手机申领医保报销',
      desc: '手把手教您在手机上操作，简单又省时',
      type: 'video',
      typeLabel: '视频课',
      icon: PlayCircle,
      progress: 80,
      timeLeft: '2 分钟',
      image: 'https://picsum.photos/seed/course1/800/400',
      action: '继续学习',
      color: 'bg-black/60',
      btnColor: 'bg-blue-500 text-white',
      points: 50,
      content: '本节课程将详细演示如何通过官方APP或微信小程序，在线提交医疗报销凭证。无需线下排队，只需准备好发票、病历等材料的照片，跟着视频一步步操作即可完成申领。'
    },
    {
      id: 2,
      title: '三分钟看懂您的保单保障',
      desc: '用通俗易懂的漫画带您理清保障范围',
      type: 'comic',
      typeLabel: '趣味漫画',
      icon: BookOpen,
      progress: 0,
      timeLeft: '约 3 分钟',
      image: 'https://picsum.photos/seed/course2/800/400',
      action: '开始学习',
      color: 'bg-blue-500',
      btnColor: 'bg-blue-50 text-blue-600',
      points: 30,
      content: '买完保险却不知道保什么？这篇漫画用生动的场景和比喻，帮您快速看懂保单中的核心条款：重疾险保哪些病？医疗险怎么报销？意外险包含哪些意外？让您的保单不再是“天书”。'
    },
    {
      id: 3,
      title: '2024养老金调整政策解读',
      desc: '为您划重点，看看每月能多领多少钱',
      type: 'article',
      typeLabel: '实用图文',
      icon: FileText,
      progress: 45,
      timeLeft: '剩 5 分钟',
      image: 'https://picsum.photos/seed/course3/800/400',
      action: '继续阅读',
      color: 'bg-slate-800',
      btnColor: 'bg-blue-500 text-white',
      points: 20,
      content: '2024年国家基本养老金上调政策正式发布！本次调整采取定额调整、挂钩调整与适当倾斜相结合的办法。本文将为您详细解读调整比例、计算方法以及高龄退休人员的特殊倾斜政策。'
    }
  ];

  return (
    <div className="py-4">
      {/* Category Filter Pills */}
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide whitespace-nowrap pb-2">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${
              activeCategory === cat 
                ? 'bg-blue-500 text-white shadow-md shadow-blue-200' 
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Course List */}
      <div className="px-4 mt-4 space-y-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
          我的课程进度
        </h2>

        {courses.map(course => (
          <div 
            key={course.id} 
            onClick={() => onSelectCourse(course)}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="relative h-40 w-full">
              <img 
                src={course.image} 
                alt={course.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className={`absolute top-3 left-3 ${course.color} backdrop-blur-sm text-white px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-bold`}>
                <course.icon size={14} />
                {course.typeLabel}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); /* toggle favorite */ }}
                className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm text-slate-400 hover:text-red-500 transition-colors"
              >
                <Heart size={18} />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold mb-1">{course.title}</h3>
              <p className="text-slate-500 text-sm mb-4">{course.desc}</p>
              
              <div className="mb-4">
                <div className={`flex justify-between items-center mb-1.5 text-xs font-bold ${course.progress > 0 ? 'text-blue-500' : 'text-slate-400'}`}>
                  <span>学习进度 {course.progress}%</span>
                  <span>{course.timeLeft}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${course.progress}%` }}
                  ></div>
                </div>
              </div>
              
              <button className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${course.btnColor}`}>
                {course.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
