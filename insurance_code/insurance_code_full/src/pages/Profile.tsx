import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Camera, ShieldCheck, Edit3, Coins, ShoppingBag, ChevronRight, BookOpen, Heart, Users, UserPlus, FileText, Calendar, Phone, LogOut } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import MyExchanges from '../components/profile/MyExchanges';
import MyActivities from '../components/profile/MyActivities';
import StudyRecords from '../components/profile/StudyRecords';
import MyFavorites from '../components/profile/MyFavorites';
import FamilyMembers from '../components/profile/FamilyMembers';
import MyFriends from '../components/profile/MyFriends';
import CourseDetail from '../components/learning/CourseDetail';
import PointsDetailPage from '../components/mall/PointsDetailPage';
import { User, api, LearningCourse, InsurancePolicy } from '../lib/api';
import { trackCEvent } from '../lib/track';
import { buildExchangeViewModels, ExchangeViewModel, MallItemRow, OrderRow, RedemptionRow, pickLatestPendingExchange } from '../lib/exchange-view-model';
import { clearLegacyProfilePolicyCount, countActivePolicies, readProfilePolicyCount, writeProfilePolicyCount } from '../lib/profile-policy-count';

function getInitials(value: string) {
  const text = String(value || '').trim();
  if (!text) return 'U';
  return text.slice(0, 1).toUpperCase();
}

interface Props {
  requireAuth: (action: () => void) => void;
  isAuthenticated: boolean;
  user: User | null;
  pointsBalance: number;
  onOpenMall: () => void;
  onGoInsurance: () => void;
  onLogout: () => void;
}

export default function Profile({ requireAuth, isAuthenticated, user, pointsBalance, onOpenMall, onGoInsurance, onLogout }: Props) {
  const [showMyExchanges, setShowMyExchanges] = useState(false);
  const [showPointsDetail, setShowPointsDetail] = useState(false);
  const [showStudyRecords, setShowStudyRecords] = useState(false);
  const [showMyActivities, setShowMyActivities] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showFamilyMembers, setShowFamilyMembers] = useState(false);
  const [showMyFriends, setShowMyFriends] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<LearningCourse | null>(null);
  const [latestPendingExchange, setLatestPendingExchange] = useState<ExchangeViewModel | null>(null);
  const [exchangeList, setExchangeList] = useState<ExchangeViewModel[]>([]);
  const [familyCount, setFamilyCount] = useState(0);
  const [policyCount, setPolicyCount] = useState(() => readProfilePolicyCount(Number(user?.id || 0)));
  const [todayTaskDone, setTodayTaskDone] = useState(0);
  const [activityHistoryCount, setActivityHistoryCount] = useState(0);
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Array<{ id: number; name: string; avatar: string; score: number; coveredTypes: string[] }>>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const currentUserId = Number(user?.id || 0);

  useEffect(() => {
    if (!isAuthenticated) {
      setLatestPendingExchange(null);
      setExchangeList([]);
      setTodayTaskDone(0);
      setActivityHistoryCount(0);
      Promise.allSettled([api.activities(), api.learningCourses()]).then((all) => {
        const [r4, r5] = all;
        if (r4.status === 'fulfilled') {
          setTodayTaskDone(r4.value.taskProgress?.completed || 0);
        }
        if (r5.status === 'fulfilled') {
          setCourses(r5.value.courses || []);
        }
      });
      return;
    }

    Promise.allSettled([
      api.redemptions(),
      api.orders(),
      api.activities(),
      api.activityHistory().catch(() => ({ list: [], total: 0 })),
      api.learningCourses(),
      api.mallItems().catch(() => ({ items: [] as MallItemRow[] })),
    ]).then((all) => {
      const [r1, r2, r4, rActivitiesHistory, r5, rMallItems] = all;

      if (r1.status === 'fulfilled') {
        const built = buildExchangeViewModels(
          Array.isArray(r1.value.list) ? (r1.value.list as RedemptionRow[]) : [],
          r2.status === 'fulfilled' && Array.isArray(r2.value.list) ? (r2.value.list as OrderRow[]) : [],
          rMallItems.status === 'fulfilled' && Array.isArray(rMallItems.value.items) ? (rMallItems.value.items as MallItemRow[]) : [],
        );
        setExchangeList(built);
        setLatestPendingExchange(pickLatestPendingExchange(built));
      } else {
        setExchangeList([]);
        setLatestPendingExchange(null);
      }

      if (r4.status === 'fulfilled') {
        setTodayTaskDone(r4.value.taskProgress?.completed || 0);
      }

      if (rActivitiesHistory.status === 'fulfilled') {
        setActivityHistoryCount(Number(rActivitiesHistory.value.total || 0));
      }

      if (r5.status === 'fulfilled') {
        setCourses(r5.value.courses || []);
      }
      });
  }, [isAuthenticated]);

  useEffect(() => {
    clearLegacyProfilePolicyCount();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || currentUserId <= 0) {
      setPolicyCount(0);
      return;
    }
    setPolicyCount(readProfilePolicyCount(currentUserId));
  }, [currentUserId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || currentUserId <= 0) {
      setFamilyMembers([]);
      setFamilyCount(0);
      setPolicies([]);
      setPolicyCount(0);
      return;
    }

    Promise.allSettled([api.insuranceOverview(), api.insurancePolicies()]).then((all) => {
      const [rOverview, rPolicies] = all;
      if (rOverview.status === 'fulfilled') {
        const members = rOverview.value.familyMembers || [];
        setFamilyMembers(members);
        setFamilyCount(members.length);
      }
      if (rPolicies.status === 'fulfilled') {
        const list = rPolicies.value.policies || [];
        setPolicies(list);
        const nextPolicyCount = countActivePolicies(list);
        setPolicyCount(nextPolicyCount);
        writeProfilePolicyCount(currentUserId, nextPolicyCount);
      }
    });
  }, [currentUserId, isAuthenticated]);

  const exchangePoints = useMemo(() => Number(latestPendingExchange?.pointsCost || latestPendingExchange?.points || 0), [latestPendingExchange]);

  const openCourseWithTrack = (source: string, course: LearningCourse) => {
    trackCEvent('c_learning_open_detail', {
      source,
      courseId: Number(course.id || 0),
      category: String(course.category || ''),
      type: String(course.type || ''),
    });
    setSelectedCourse(course);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="bg-white px-6 pt-10 pb-8 rounded-b-3xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">个人中心</h1>
          <button className="p-2 rounded-full bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors">
            <Settings size={24} />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-blue-50 bg-blue-100 text-3xl font-bold text-blue-600 shadow-md">
              {getInitials(user?.name || '微信用户')}
            </div>
            <button className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full border-2 border-white shadow-sm text-white active:scale-95 transition-transform">
              <Camera size={14} />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{user?.name || '微信昵称'}</h2>
            {user?.mobile ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Phone size={13} />
                </div>
                <span className="font-medium tracking-wide">{user.mobile}</span>
              </div>
            ) : null}
            {!isAuthenticated ? (
              <button
                onClick={() => requireAuth(() => {})}
                className="flex items-center gap-1 px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold shadow-md mb-2 active:scale-95 transition-transform"
              >
                <ShieldCheck size={18} />
                去实名
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-600 rounded-lg text-xs font-bold mb-2 w-fit">
                <ShieldCheck size={14} />
                已实名
              </div>
            )}
            <button className="flex items-center gap-1 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100 active:bg-blue-100 transition-colors">
              <Edit3 size={14} />
              编辑资料
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="px-4 mt-6">
          <div
            onClick={onOpenMall}
            className="bg-white p-5 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center shrink-0 text-orange-500">
                <Coins size={32} />
              </div>
              <div>
                <p className="text-slate-500 text-sm mb-0.5 font-medium">我的积分</p>
                <p className="text-3xl font-bold text-slate-900">{pointsBalance}</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                requireAuth(() => {
                  trackCEvent('c_profile_open_points_detail', {});
                  setShowPointsDetail(true);
                });
              }}
              className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-orange-200 active:scale-95 transition-transform"
            >
              查看积分
            </button>
          </div>
        </section>

        <section className="px-4 mt-6">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3
                onClick={() => {
                  trackCEvent('c_profile_open_my_exchanges', {});
                  setShowMyExchanges(true);
                }}
                className="text-lg font-bold flex items-center gap-2 cursor-pointer active:opacity-70"
              >
                <ShoppingBag className="text-blue-500" size={20} />
                我的兑换
              </h3>
              <button onClick={onOpenMall} className="text-blue-500 font-bold flex items-center text-sm active:opacity-70">
                积分商城
                <ChevronRight size={16} />
              </button>
            </div>

            {latestPendingExchange ? (
              <button
                onClick={() => {
                  trackCEvent('c_profile_open_my_exchanges', {});
                  setShowMyExchanges(true);
                }}
                className="group flex w-full flex-col text-left cursor-pointer"
              >
                <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm shadow-slate-200/70">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-[24px] bg-slate-100">
                    {latestPendingExchange.image ? (
                      <img
                        src={latestPendingExchange.image}
                        alt={latestPendingExchange.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-active:scale-[1.02]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <>
                        <div className="h-full w-full bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-400" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_32%),linear-gradient(to_top,rgba(15,23,42,0.72),rgba(15,23,42,0.08),transparent)]" />
                        <div className="absolute inset-0 flex items-center justify-center text-white/35">
                          <ShoppingBag size={92} strokeWidth={1.4} />
                        </div>
                      </>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/58 via-slate-900/12 to-transparent" />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-4 text-white">
                      <span className="inline-flex rounded-full border border-white/20 bg-white/18 px-3 py-1 text-[12px] font-semibold backdrop-blur">
                        {latestPendingExchange.status}
                      </span>
                      <span className="text-[14px] font-semibold">
                        {exchangePoints > 0 ? `${exchangePoints}积分` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-4">
                    <h4 className="line-clamp-2 text-[18px] font-bold leading-7 text-slate-950">
                      {latestPendingExchange.name}
                    </h4>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="line-clamp-1 text-sm text-slate-400">
                        {latestPendingExchange.date || '兑换记录'}
                      </p>
                      <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600">
                        点击查看
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={() => {
                  trackCEvent('c_profile_open_my_exchanges', {});
                  setShowMyExchanges(true);
                }}
                className="w-full rounded-[22px] border border-dashed border-sky-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-5 text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">暂无待核销兑换</p>
                    <p className="mt-1 text-sm text-slate-500">点击查看历史兑换记录或前往积分商城继续兑换</p>
                  </div>
                  <div className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-bold text-sky-600 shadow-sm">
                    查看记录
                  </div>
                </div>
              </button>
            )}
          </div>
        </section>

        <section className="px-4 mt-6 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
            <button
              onClick={() => {
                trackCEvent('c_profile_open_study_records', {});
                setShowStudyRecords(true);
              }}
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <BookOpen className="text-blue-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">学习记录</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={() => {
                trackCEvent('c_profile_open_favorites', {});
                setShowFavorites(true);
              }}
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <Heart className="text-rose-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">我的收藏</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={() =>
                requireAuth(() => {
                  trackCEvent('c_profile_open_my_friends', {});
                  setShowMyFriends(true);
                })
              }
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <UserPlus className="text-sky-500 mr-4" size={24} />
              <div className="flex-1 text-left">
                <span className="text-base font-medium block">我的朋友</span>
                <span className="text-[10px] text-slate-400">查看通过分享链接实名的朋友与上游来源</span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={() => {
                trackCEvent('c_profile_open_family_members', {});
                setShowFamilyMembers(true);
              }}
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <Users className="text-green-500 mr-4" size={24} />
              <div className="flex-1 text-left">
                <span className="text-base font-medium block">家庭成员管理</span>
                <span className="text-[10px] text-slate-400">已添加 {familyCount} 位成员</span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={() => {
                trackCEvent('c_profile_open_policies', {});
                onGoInsurance();
              }}
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <FileText className="text-amber-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">我的保单</span>
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2">在保 {policyCount}</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={() =>
                requireAuth(() => {
                  trackCEvent('c_profile_open_my_activities', {});
                  setShowMyActivities(true);
                })
              }
              className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors"
            >
              <Calendar className="text-orange-400 mr-4" size={24} />
              <div className="flex-1 text-left">
                <span className="text-base font-medium block">我的活动</span>
                <span className="text-[10px] text-slate-400">
                  {isAuthenticated ? `累计已完成 ${activityHistoryCount} 项` : `今日已完成 ${todayTaskDone} 项`}
                </span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button
              onClick={onLogout}
              className="w-full flex items-center px-5 py-4 active:bg-rose-50 transition-colors"
            >
              <LogOut className="text-rose-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left text-rose-600">退出登录</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
          </div>
        </section>

        <section className="px-4 mt-6 mb-8">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h4 className="text-blue-600 font-bold text-lg mb-1">需要帮助吗？</h4>
              <p className="text-slate-500 text-sm">点击拨打 24小时客服热线</p>
            </div>
            <button className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-transform">
              <Phone size={24} />
            </button>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedCourse && <CourseDetail course={selectedCourse as any} onBack={() => setSelectedCourse(null)} />}
        {showMyExchanges && <MyExchanges initialExchanges={exchangeList} onClose={() => setShowMyExchanges(false)} />}
        {showPointsDetail && <PointsDetailPage onClose={() => setShowPointsDetail(false)} initialBalance={pointsBalance} />}
        {showMyActivities && <MyActivities onClose={() => setShowMyActivities(false)} />}
        {showStudyRecords && (
          <StudyRecords
            onClose={() => setShowStudyRecords(false)}
            courses={courses}
            onOpenCourse={(c) => openCourseWithTrack('profile_study_records', c)}
          />
        )}
        {showFavorites && (
          <MyFavorites
            onClose={() => setShowFavorites(false)}
            courses={courses}
            onOpenCourse={(c) => openCourseWithTrack('profile_favorites', c)}
          />
        )}
        {showMyFriends && <MyFriends onClose={() => setShowMyFriends(false)} />}
        {showFamilyMembers && (
          <FamilyMembers
            onClose={() => setShowFamilyMembers(false)}
            members={familyMembers}
            policies={policies}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
