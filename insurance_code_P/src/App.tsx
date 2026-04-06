/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Shield,
  List,
  UserPlus,
  Users,
  Megaphone,
  BookOpen,
  ShoppingCart,
  Tags,
  Target,
  BarChart2,
  Monitor,
  Receipt,
  ShieldCheck,
  Bell,
  HelpCircle,
  Plus,
  Search,
  FileText,
  Send,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Info,
  Bold,
  Italic,
  List as ListIcon,
  Link,
  Image as ImageIcon,
  X,
  UploadCloud,
  PlayCircle,
  Star,
  Upload,
  Edit,
  Eye,
  Trash2,
  Tag,
  Database,
  TrendingUp,
  Verified,
  Filter,
  PlusCircle,
  MoreHorizontal,
  Clock,
  ShieldAlert,
  History,
  Save,
  User
} from 'lucide-react';
import {
  pApi,
  onAuthInvalid,
  trackEvent,
  type PActivity,
  type PCustomer,
  type PEmployee,
  type PEventDefinition,
  type PLearningCourse,
  type PMallActivity,
  type PMallProduct,
  type PPermissionMatrix,
  type PCompanyAdminPagePermissionModule,
  type PEmployeeRolePagePermissionModule,
  type PReconciliationReport,
  type PLoginSession,
  type PMetricCard,
  type PMetricEnd,
  type PMetricRule,
  type PPointsRuleConfig,
  type PStrategy,
  type PStatsOverview,
  type PActivityEffectOverview,
  type PTag,
  type PTagRule,
  type PTagRuleJob,
  type PTagRuleJobLog,
  type PTeam,
  type PTenant,
} from './lib/api';
import { showApiError } from './lib/ui-error';
import { ERROR_COPY } from './lib/errorCopy';
import { VALIDATION_COPY } from './lib/validationCopy';
import { NOTICE_COPY } from './lib/noticeCopy';
import { ACTION_COPY } from './lib/uiCopy';
import { pruneActivitySelection, toggleActivitySelection, togglePageActivitySelection } from './lib/activitySelection';
import { buildBatchDeleteResultMessage, resolveBatchDeleteAction } from './lib/batchDeleteFlow';
import { pruneLearningSelection, toggleLearningSelection, togglePageLearningSelection } from './lib/learningSelection';
import { validateLearningMaterialSubmit } from './lib/learningMaterialValidation';
import {
  ACTIVITY_TYPE_OPTIONS,
  EMPLOYEE_ROLE_OPTIONS,
  EVENT_COLLECT_METHOD_OPTIONS,
  EVENT_TYPE_OPTIONS,
  METRIC_END_OPTIONS,
  METRIC_PERIOD_OPTIONS,
  employeeRoleLabel,
  eventCollectMethodLabel,
  eventTypeLabel,
  eventTypePillClass,
  type ActivityTypeOptionValue,
} from './lib/selectOptions';
import { PublicCustomerPoolPage } from './components/PublicCustomerPoolPage';
import {
  activeStatusLabel,
  activeStatusPillClass,
  CONTENT_STATUS_OPTIONS,
  contentStatusSoftPillClass,
  ENABLED_STATUS_OPTIONS,
  ENABLED_STATUS_FILTER_OPTIONS,
  enabledStatusLabel,
  enabledStatusPillClass,
  enabledRuntimeStatusLabel,
  enabledToggleActionLabel,
  ONLINE_STATUS_FILTER_OPTIONS,
  ONLINE_STATUS_OPTIONS,
  onlineStatusClass,
  onlineStatusLabel,
  RUNNING_STATUS_OPTIONS,
  runningStatusLabel,
  runningStatusSoftPillClass,
  TAG_RULE_STATUS_OPTIONS,
  TAG_STATUS_FILTER_OPTIONS,
  TENANT_STATUS_OPTIONS,
  tenantStatusLabel,
  tenantStatusPillClass,
  tenantStatusTextClass,
  tagRuleStatusLabel,
  tagRuleStatusTextClass,
  tagStatusLabel,
  tagStatusPillClass,
  tagToggleActionLabel,
  toActivityOnlineStatus,
  toContentStatusLabel,
  toOnlineStatus,
  toRunningStatus,
  toRunningStatusLabel,
  type EnabledStatusFilter,
  type OnlineStatusFilter,
  type TagStatusFilter,
} from './lib/templateStatus';

const ROOT_VIEW_MAP: Record<string, string> = {
  'activity-detail': 'activity',
  create: 'activity',
  'learning-detail': 'learning',
  'learning-create': 'learning',
  'shop-add-product': 'shop',
  'shop-add-activity': 'shop',
  'shop-product-detail': 'shop',
  'shop-activity-detail': 'shop',
  'strategy-config': 'strategy',
  'tenant-detail': 'tenants',
  'edit-tenant': 'tenants',
};

function toRootView(view: string) {
  return ROOT_VIEW_MAP[String(view || '')] || String(view || '');
}

function normalizeEmployeePermissionRole(role: string) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'support') return 'team_lead';
  if (normalized === 'salesperson') return 'agent';
  return normalized;
}

function getDefaultPAllowedViews(session: PLoginSession | null) {
  if (!session) return null;
  const roleKey = normalizeEmployeePermissionRole(String(session.role || ''));
  if (roleKey === 'platform_admin' || roleKey === 'company_admin') return null;
  if (roleKey === 'team_lead' || roleKey === 'agent') return ['activity', 'learning', 'shop'];
  return ['activity'];
}

function getDefaultPView(session: PLoginSession | null) {
  if (!session) return 'login' as const;
  const roleKey = normalizeEmployeePermissionRole(String(session.role || ''));
  return roleKey === 'platform_admin' || roleKey === 'company_admin' ? ('tenants' as const) : ('activity' as const);
}

async function fetchPSidebarAllowedViews(session: PLoginSession | null) {
  if (!session) return null;
  const roleKey = normalizeEmployeePermissionRole(String(session.role || ''));
  const fallback = getDefaultPAllowedViews(session);
  if (roleKey === 'platform_admin') return null;

  const tenantId = Number(session.tenantId || 1);
  const res =
    roleKey === 'company_admin'
      ? await pApi.companyAdminPagePermissions(tenantId)
      : roleKey === 'team_lead' || roleKey === 'agent'
        ? await pApi.employeeRolePagePermissions({ tenantId, roleKey })
        : null;
  const grants = Array.isArray((res as any)?.grants) ? (res as any).grants : [];
  const next = grants.filter((row: any) => Boolean(row?.enabled)).map((row: any) => String(row?.pageId || ''));
  return next.length ? next : fallback;
}

function getAvatarText(value?: string) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 1).toUpperCase() : 'U';
}

function getSessionRoleLabel(role?: string) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'platform_admin') return '平台管理员';
  if (normalized === 'company_admin') return '公司管理员';
  if (normalized === 'team_lead') return '团队主管';
  if (normalized === 'agent') return '业务员';
  if (normalized === 'support') return '支持人员';
  return '当前账号';
}

function formatDisplaySortOrder(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) && next > 0 ? String(next) : '未排';
}

const TEMPLATE_DELIVERY_RULE_NOTE =
  '硬口径：只有源模板状态为“有效 / 进行中 / 已发布”时，才允许向下一级下发；否则一律不下发。下一级收到后统一按“失效”展示，且“失效”模板不得继续向更下一级和客户端透传。';

type UploadMediaItem = {
  name: string;
  type: string;
  preview: string;
  url?: string;
  path?: string;
};

type LearningVideoChannelMetaForm = {
  finderUserName: string;
  feedToken: string;
  feedId: string;
  nonceId: string;
  miniProgramAppId: string;
  miniProgramPath: string;
  miniProgramEnvVersion: 'release' | 'trial' | 'develop';
  coverUrl: string;
};

type VideoChannelLaunchTarget = 'activity' | 'profile';
const DEFAULT_VIDEO_CHANNEL_MINI_PROGRAM_APP_ID = 'wx91b1b13910c93f4f';

function createEmptyLearningVideoChannelMeta(): LearningVideoChannelMetaForm {
  return {
    finderUserName: '',
    feedToken: '',
    feedId: '',
    nonceId: '',
    miniProgramAppId: DEFAULT_VIDEO_CHANNEL_MINI_PROGRAM_APP_ID,
    miniProgramPath: '',
    miniProgramEnvVersion: 'release',
    coverUrl: '',
  };
}

function resolveVideoChannelLaunchTarget(raw: any): VideoChannelLaunchTarget {
  const path = String(raw?.miniProgramPath || '').trim();
  if (path.includes('pages/video-channel-profile/index')) return 'profile';
  return 'activity';
}

function buildVideoChannelMiniProgramPath(
  target: VideoChannelLaunchTarget,
  meta: Pick<LearningVideoChannelMetaForm, 'finderUserName' | 'feedId' | 'nonceId'>
) {
  const finderUserName = String(meta.finderUserName || '').trim();
  const feedId = String(meta.feedId || '').trim();
  const nonceId = String(meta.nonceId || '').trim();
  if (!finderUserName) return '';
  if (target === 'profile') {
    return `pages/video-channel-profile/index?finderUserName=${encodeURIComponent(finderUserName)}`;
  }
  if (!feedId) return '';
  const query = new URLSearchParams({
    finderUserName,
    feedId,
  });
  if (nonceId) query.set('nonceId', nonceId);
  return `pages/video-channel/index?${query.toString()}`;
}

function finalizeLearningVideoChannelMeta(
  target: VideoChannelLaunchTarget,
  raw: LearningVideoChannelMetaForm
): LearningVideoChannelMetaForm {
  const next = {
    ...createEmptyLearningVideoChannelMeta(),
    ...raw,
  };
  const generatedPath = buildVideoChannelMiniProgramPath(target, next);
  const hasLegacyEmbedCompatMeta =
    Boolean(String(next.feedToken || '').trim())
    && !String(next.finderUserName || '').trim()
    && !String(next.feedId || '').trim();
  return {
    ...next,
    miniProgramPath: generatedPath || (hasLegacyEmbedCompatMeta ? String(next.miniProgramPath || '').trim() : ''),
  };
}

function normalizeLearningVideoChannelMeta(raw: any): LearningVideoChannelMetaForm {
  const base = createEmptyLearningVideoChannelMeta();
  const envVersion = String(raw?.miniProgramEnvVersion || base.miniProgramEnvVersion).toLowerCase();
  const normalized: LearningVideoChannelMetaForm = {
    finderUserName: String(raw?.finderUserName || ''),
    feedToken: String(raw?.feedToken || ''),
    feedId: String(raw?.feedId || ''),
    nonceId: String(raw?.nonceId || ''),
    miniProgramAppId: String(raw?.miniProgramAppId || base.miniProgramAppId || ''),
    miniProgramPath: String(raw?.miniProgramPath || ''),
    miniProgramEnvVersion: envVersion === 'develop' || envVersion === 'trial' ? envVersion : 'release',
    coverUrl: String(raw?.coverUrl || ''),
  };
  return finalizeLearningVideoChannelMeta(resolveVideoChannelLaunchTarget(raw), normalized);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadMediaFiles(files: File[]): Promise<UploadMediaItem[]> {
  const result: UploadMediaItem[] = [];
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    const uploaded = await pApi.uploadMediaBase64({
      name: file.name,
      type: file.type || 'application/octet-stream',
      dataUrl,
    });
    result.push({
      name: uploaded.file.name || file.name,
      type: uploaded.file.type || file.type || 'application/octet-stream',
      preview: uploaded.file.url,
      url: uploaded.file.url,
      path: uploaded.file.path,
    });
  }
  return result;
}

const Sidebar = ({
  currentView,
  onViewChange,
  session,
  allowedViews,
  onLogout,
}: {
  currentView: string;
  onViewChange: (view: string) => void;
  session: PLoginSession;
  allowedViews?: string[] | null;
  onLogout: () => void;
}) => {
  const allowAll = !Array.isArray(allowedViews) || allowedViews.length === 0;
  const allowedSet = new Set((allowedViews || []).map((x) => String(x || '')));
  const canView = (viewId: string) => allowAll || allowedSet.has(String(viewId || ''));
  const filterItems = (items: any[]) => items.filter((item) => !item?.id || canView(String(item.id)));
  const avatarText = getAvatarText(session.name || session.account);
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Shield size={20} />
          </div>
          <h1 className="text-gray-900 text-lg font-bold tracking-tight">保险管理平台</h1>
        </div>
        <p className="text-gray-500 text-xs font-medium pl-10">企业级营销中心</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-6 overflow-y-auto pb-4">
        <NavSection title="租户管理" onViewChange={onViewChange} items={filterItems([
          { icon: <List size={20} />, label: '租户列表', id: 'tenants', active: currentView === 'tenants' },
          { icon: <UserPlus size={20} />, label: '创建租户', id: 'create-tenant', active: currentView === 'create-tenant' },
          { icon: <Users size={20} />, label: '员工管理', id: 'employees', active: currentView === 'employees' },
          { icon: <User size={20} />, label: '公共客户池', id: 'customer-pool', active: currentView === 'customer-pool' },
        ])} />
        <NavSection title="内容与营销" onViewChange={onViewChange} items={filterItems([
          { icon: <Megaphone size={20} />, label: '活动中心', id: 'activity', active: currentView === 'activity' || currentView === 'create' || currentView === 'activity-detail' },
          { icon: <BookOpen size={20} />, label: '知识学习', id: 'learning', active: currentView === 'learning' || currentView === 'learning-create' || currentView === 'learning-detail' },
          { icon: <ShoppingCart size={20} />, label: '积分商城', id: 'shop', active: currentView === 'shop' || currentView === 'shop-add-product' || currentView === 'shop-add-activity' || currentView === 'shop-product-detail' || currentView === 'shop-activity-detail' },
          { icon: <Star size={20} />, label: '积分规则', id: 'points-rules', active: currentView === 'points-rules' },
        ])} />
        <NavSection title="策略引擎" onViewChange={onViewChange} items={filterItems([
          { icon: <Tag size={20} />, label: '标签列表', id: 'tag-list', active: currentView === 'tag-list' },
          { icon: <Tags size={20} />, label: '标签规则库', id: 'tags', active: currentView === 'tags' },
          { icon: <Clock size={20} />, label: '事件管理', id: 'event-management', active: currentView === 'event-management' },
          { icon: <Database size={20} />, label: '指标配置', id: 'metric-config', active: currentView === 'metric-config' },
          { icon: <Target size={20} />, label: '策略引擎', id: 'strategy', active: currentView === 'strategy' || currentView === 'strategy-config' },
        ])} />
        <NavSection title="数据统计" onViewChange={onViewChange} items={filterItems([
          { icon: <BarChart2 size={20} />, label: '业绩看板', id: 'stats', active: currentView === 'stats' },
        ])} />
        <NavSection title="平台运维" onViewChange={onViewChange} items={filterItems([
          { icon: <Monitor size={20} />, label: '监控大屏', id: 'monitor', active: currentView === 'monitor' },
          { icon: <Receipt size={20} />, label: '财务对账', id: 'finance', active: currentView === 'finance' },
          { icon: <ShieldCheck size={20} />, label: '权限管理', id: 'permissions', active: currentView === 'permissions' },
        ])} />
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center overflow-hidden">
            {avatarText}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{session.name}</p>
            <p className="text-xs text-gray-500 truncate">{session.account}</p>
          </div>
          <button onClick={onLogout} className="text-xs text-red-500 font-semibold hover:text-red-600 cursor-pointer">退出</button>
        </div>
      </div>
    </aside>
  );
};

const NavSection = ({ title, items, onViewChange }: { title: string, items: any[], onViewChange: (id: string) => void }) => (
  <div className="space-y-1">
    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</div>
    {items.map((item, idx) => (
      <a
        key={idx}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          if (item.id) onViewChange(item.id);
        }}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          item.active
            ? 'text-blue-600 bg-blue-50 font-bold'
            : 'text-gray-600 hover:bg-gray-50 font-medium'
        }`}
      >
        <span className={item.active ? 'text-blue-600' : 'text-gray-500'}>{item.icon}</span>
        <span className="text-sm">{item.label}</span>
      </a>
    ))}
  </div>
);

const Header = () => (
  <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
    <div className="flex items-center gap-2 text-sm">
      <a href="#" className="text-gray-500 hover:text-blue-600 transition-colors">内容与营销</a>
      <span className="text-gray-300">/</span>
      <span className="text-gray-900 font-medium">活动中心</span>
    </div>
    <div className="flex items-center gap-4">
      <button className="text-gray-500 hover:text-gray-900 relative">
        <Bell size={20} />
        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
      <button className="text-gray-500 hover:text-gray-900">
        <HelpCircle size={20} />
      </button>
    </div>
  </header>
);

const LoginPage = ({
  onLogin,
}: {
  onLogin: (payload: { account: string; password: string }) => Promise<void>;
}) => {
  const [account, setAccount] = useState('company001');
  const [password, setPassword] = useState('123456');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">P端管理后台登录</h1>
            <p className="text-xs text-gray-500 mt-1">账号密码登录后进入管理台</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">账号</span>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              placeholder="company001"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              placeholder="123456"
            />
          </label>
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}
          <button
            onClick={async () => {
              try {
                setSubmitting(true);
                setError('');
                await onLogin({ account: account.trim(), password: password.trim() });
              } catch (err: any) {
                setError(err?.message || ERROR_COPY.loginFailed);
              } finally {
                setSubmitting(false);
              }
            }}
            className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? '登录中...' : '登录'}
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 leading-6">
          测试账号：platform001 / company001 / agent001
          <br />
          统一密码：123456
        </div>
      </div>
    </div>
  );
};

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  const handleConfirm = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onCancel} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed">
            {cancelText}
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {submitting ? '处理中...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const MainContent = ({
  onCreateClick,
  canCreate,
  onNoPermission,
  onOpenDetail,
  onEdit,
  onDelete,
  onMove,
  onBatchDelete,
  movingActivityId,
  activityRows,
}: {
  onCreateClick: () => void;
  canCreate: boolean;
  onNoPermission: () => void;
  onOpenDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (sourceId: number, targetId: number) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<{ confirmed: boolean; deletedCount: number }>;
  movingActivityId: number | null;
  activityRows: Array<{
    id: string;
    rawId: number;
    order: number;
    name: string;
    type: string;
    version: string;
    status: 'online' | 'draft' | 'offline';
    updateTime: string;
    isPlatformTemplate?: boolean;
    templateTag?: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
  }>;
}) => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<OnlineStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const pageSize = 6;
  const isActivityDeleteDisabled = (activity: { status: 'online' | 'draft' | 'offline' }) => activity.status === 'online';
  const filteredRows = activityRows.filter((activity) => {
    const q = searchText.trim().toLowerCase();
    const keywordPass =
      !q ||
      String(activity.name).toLowerCase().includes(q) ||
      String(activity.id).toLowerCase().includes(q) ||
      String(activity.type).toLowerCase().includes(q) ||
      String(activity.templateTag || '').toLowerCase().includes(q);
    const statusPass = statusFilter === 'all' ? true : activity.status === statusFilter;
    return keywordPass && statusPass;
  });
  useEffect(() => {
    setPage(1);
  }, [searchText, statusFilter, activityRows.length]);
  useEffect(() => {
    setSelectedIds((prev) => pruneActivitySelection(prev, activityRows.map((activity) => String(activity.id || ''))));
  }, [activityRows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = pageRows.map((activity) => String(activity.id || '')).filter(Boolean);
  const pageSelectableIds = pageRows.filter((activity) => !isActivityDeleteDisabled(activity)).map((activity) => String(activity.id || '')).filter(Boolean);
  const selectedIdSet = new Set(selectedIds);
  const selectedCount = selectedIds.length;
  const allPageSelected = pageSelectableIds.length > 0 && pageSelectableIds.every((id) => selectedIdSet.has(id));
  const startNo = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endNo = Math.min(safePage * pageSize, filteredRows.length);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5);
  const exitBatchDeleteMode = () => {
    setIsSelecting(false);
    setSelectedIds([]);
  };
  const handleBatchDeleteClick = async () => {
    const action = resolveBatchDeleteAction({ isSelecting, selectedCount });
    if (action === 'enter-select') {
      setIsSelecting(true);
      return;
    }
    if (action === 'idle-select') {
      window.alert('请先勾选要删除的活动');
      return;
    }
    const result = await onBatchDelete(selectedIds);
    if (result.confirmed && result.deletedCount > 0) {
      exitBatchDeleteMode();
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Title & Main Actions */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">活动中心</h2>
            <p className="text-gray-500 mt-1">管理并监控所有营销活动的生命周期与版本</p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 max-w-4xl">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-blue-700">{TEMPLATE_DELIVERY_RULE_NOTE}</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!canCreate) return onNoPermission();
              onCreateClick();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus size={20} />
            <span>{ACTION_COPY.createActivity}</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">搜索活动</label>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="输入活动名称或关键字..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-600 text-sm placeholder:text-gray-400 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">活动状态</label>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter((e.target.value || 'all') as any)}
                  className="w-full pl-4 pr-10 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-600 text-sm appearance-none outline-none text-gray-700 cursor-pointer"
                >
                  {ONLINE_STATUS_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer">{ACTION_COPY.query}</button>
              <button
                onClick={() => {
                  setSearchText('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors cursor-pointer"
              >
                {ACTION_COPY.reset}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-8">
            {[{ value: 'all', label: '全部活动' }, ...ONLINE_STATUS_OPTIONS].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value as any)}
                className={`px-1 pb-4 border-b-2 text-sm cursor-pointer transition-colors ${
                  statusFilter === tab.value
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-gray-500 hover:text-gray-900 font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {isSelecting ? (
            <button
              onClick={() => setSelectedIds((prev) => togglePageActivitySelection(prev, pageSelectableIds))}
              disabled={pageSelectableIds.length === 0}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pageSelectableIds.length === 0 ? 'bg-blue-100 text-blue-300 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 cursor-pointer'}`}
            >
              {allPageSelected ? '取消本页全选' : '全选本页'}
            </button>
          ) : null}
          {isSelecting ? (
            <button
              onClick={exitBatchDeleteMode}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              取消
            </button>
          ) : null}
          <button
            onClick={() => void handleBatchDeleteClick()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            <Trash2 size={16} />
            批量删除{isSelecting && selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {isSelecting ? (
                  <th className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={() => setSelectedIds((prev) => togglePageActivitySelection(prev, pageSelectableIds))}
                      disabled={pageSelectableIds.length === 0}
                      className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${pageSelectableIds.length === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                      aria-label="全选当前页活动"
                    />
                  </th>
                ) : null}
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">排序</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">活动名称</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">模板类型</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">当前版本</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">更新时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">调序</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.map((activity) => {
                const isSelected = isSelecting && selectedIdSet.has(activity.id);
                const filteredIndex = filteredRows.findIndex((row) => row.rawId === activity.rawId);
                const prevRow = filteredIndex > 0 ? filteredRows[filteredIndex - 1] : null;
                const nextRow = filteredIndex >= 0 && filteredIndex < filteredRows.length - 1 ? filteredRows[filteredIndex + 1] : null;
                const isMoving = movingActivityId === activity.rawId;
                const deleteDisabled = isActivityDeleteDisabled(activity);
                return (
                <tr key={activity.id} className={`${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/50'} transition-colors`}>
                  {isSelecting ? (
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelectedIds((prev) => toggleActivitySelection(prev, activity.id))}
                        disabled={deleteDisabled}
                        className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${deleteDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                        aria-label={`勾选活动 ${activity.name}`}
                        title={deleteDisabled ? '进行中的活动不能删除' : undefined}
                      />
                    </td>
                  ) : null}
                  <td className="px-6 py-4">
                    <span className="inline-flex h-9 min-w-12 items-center justify-center rounded-lg bg-blue-50 px-3 text-sm font-bold text-blue-500">
                      {Math.max(1, filteredIndex + 1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${activity.iconBg} flex items-center justify-center ${activity.iconColor}`}>
                        {activity.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900">{activity.name}</p>
                          {activity.isPlatformTemplate ? (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                              {activity.templateTag || '平台模板'}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">ID: {activity.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                      {activity.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-medium text-gray-700">{activity.version}</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={activity.status} />
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-500">{activity.updateTime}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canCreate) return onNoPermission();
                          if (!prevRow || isMoving) return;
                          void onMove(activity.rawId, prevRow.rawId);
                        }}
                        disabled={!prevRow || isMoving}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                          !prevRow || isMoving
                            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                            : 'cursor-pointer border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                        aria-label={`上移活动 ${activity.name}`}
                      >
                        <ChevronUp size={20} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!canCreate) return onNoPermission();
                          if (!nextRow || isMoving) return;
                          void onMove(activity.rawId, nextRow.rawId);
                        }}
                        disabled={!nextRow || isMoving}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                          !nextRow || isMoving
                            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                            : 'cursor-pointer border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                        aria-label={`下移活动 ${activity.name}`}
                      >
                        <ChevronDown size={20} strokeWidth={2.5} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-3 text-sm font-bold">
                      <button onClick={() => onEdit(activity.id)} className="text-blue-600 hover:underline cursor-pointer">编辑</button>
                      <button
                        onClick={() => {
                          if (deleteDisabled) {
                            window.alert('进行中的活动不能删除，请先下线后再删除');
                            return;
                          }
                          onDelete(activity.id);
                        }}
                        className={deleteDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:underline cursor-pointer'}
                        title={deleteDisabled ? '进行中的活动不能删除' : undefined}
                      >
                        删除
                      </button>
                      <button className="text-blue-600 hover:underline cursor-pointer">版本</button>
                      <button onClick={() => onOpenDetail(activity.id)} className="text-blue-600 hover:underline cursor-pointer transition-colors">查看</button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isSelecting ? 9 : 8} className="px-6 py-10 text-center text-sm text-gray-500">
                    暂无匹配活动
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-6 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium">显示 {startNo} 到 {endNo} 共 {filteredRows.length} 条记录</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-white transition-colors text-gray-500 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold cursor-pointer ${safePage === n ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' : 'border border-gray-200 hover:bg-white text-gray-700'}`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-white transition-colors text-gray-500 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'online') {
    return (
      <div className="flex items-center gap-1.5 text-green-600">
        <span className="w-2 h-2 rounded-full bg-green-600"></span>
        <span className="text-sm font-bold">进行中</span>
      </div>
    );
  }
  if (status === 'draft') {
    return (
      <div className="flex items-center gap-1.5 text-gray-400">
        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
        <span className="text-sm font-bold">草稿</span>
      </div>
    );
  }
  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 text-red-500">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <span className="text-sm font-bold">已下线</span>
      </div>
    );
  }
  return null;
};

const ActivityDetailPage = ({
  onBack,
  onEdit,
  activity,
}: {
  onBack: () => void;
  onEdit: () => void;
  activity: {
    id: number | string;
    title: string;
    status: 'online' | 'draft' | 'offline';
    rewardPoints: number;
    content?: string;
    media?: Array<{ name?: string; type?: string; preview?: string }>;
    participants?: number;
    updatedAt?: string;
    createdAt?: string;
  } | null;
}) => {
  const activityName = activity?.title || '未找到活动';
  const statusText = onlineStatusLabel(activity?.status || 'online');
  const statusClass = onlineStatusClass(activity?.status || 'online');
  const detailText = activity?.content?.trim() || '暂无活动文案';
  const mediaList = Array.isArray(activity?.media) ? activity!.media! : [];
  const mainMedia = mediaList[0];
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
            <ArrowLeft size={16} />
            返回活动中心
          </button>
          <h2 className="text-xl font-bold text-gray-900">活动详情</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700">编辑活动</button>
          <button className="px-4 h-10 rounded-lg border border-red-200 text-sm font-semibold text-red-600 bg-red-50">停止活动</button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-8">
        {!activity ? (
          <div className="max-w-3xl mx-auto rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <h3 className="text-lg font-bold text-gray-900">未找到真实活动数据</h3>
            <p className="mt-2 text-sm text-gray-500">当前详情页不再回退到本地演示活动。请返回活动中心，从真实列表重新进入。</p>
          </div>
        ) : (
        <div className="max-w-[1220px] mx-auto space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-black text-gray-900">{activityName}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass}`}>{statusText}</span>
            </div>
            <div className="mt-2 text-sm text-gray-500 flex items-center gap-5">
              <span>创建日期：{(activity?.createdAt || '').slice(0, 10) || '-'}</span>
              <span>单次奖励：{Number(activity?.rewardPoints || 0)} 积分</span>
              <span>最近更新：{(activity?.updatedAt || '').slice(0, 16).replace('T', ' ') || '-'}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">累计参与人数</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{Number(activity?.participants || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">单次奖励</p>
              <p className="mt-2 text-3xl font-black text-blue-600">{Number(activity?.rewardPoints || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">素材数量</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{mediaList.length}</p>
            </div>
          </div>
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="h-12 px-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">活动内容配置</h4>
              <button className="text-sm text-blue-600 font-semibold">全屏预览</button>
            </div>
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="aspect-video rounded-lg bg-gray-100 border border-gray-200 overflow-hidden">
                {mainMedia?.type?.startsWith('image') && (mainMedia as any)?.preview ? (
                  <img
                    src={String((mainMedia as any)?.preview || '')}
                    alt="活动主图"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                    {mainMedia?.name || '未上传预览图'}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">活动文案</p>
                  <p className="mt-2 text-sm text-gray-700 leading-7 whitespace-pre-wrap">{detailText}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mediaList.length ? mediaList.slice(0, 2).map((m, idx) => (
                    <div key={`${m.name || 'media'}-${idx}`} className="p-3 border border-gray-200 rounded-lg text-sm text-gray-700">
                      素材：{m.name || '-'}（{m.type || '-'}）
                    </div>
                  )) : (
                    <div className="sm:col-span-2 p-4 border border-dashed border-gray-200 rounded-lg text-sm text-gray-500">
                      当前活动未上传任何展示素材。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
        )}
      </main>
    </div>
  );
};

const CreateActivity = ({
  onBack,
  onSubmit,
  mode = 'create',
  initialValues,
}: {
  onBack: () => void;
  onSubmit: (payload: {
    title: string;
    category: string;
    rewardPoints: number;
    content: string;
    status: 'online' | 'draft' | 'offline';
    media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
  }) => Promise<void>;
  mode?: 'create' | 'edit';
  initialValues?: {
    title?: string;
    category?: string;
    rewardPoints?: number;
    content?: string;
    status?: 'online' | 'draft' | 'offline' | string;
    media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
  } | null;
}) => {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [rewardPoints, setRewardPoints] = useState(Number(initialValues?.rewardPoints || 0));
  const [content, setContent] = useState(initialValues?.content || '');
  const [status, setStatus] = useState<'online' | 'draft' | 'offline'>(
    toOnlineStatus(initialValues?.status || 'online')
  );
  const [uploads, setUploads] = useState<UploadMediaItem[]>(
    Array.isArray(initialValues?.media)
      ? initialValues!.media!.map((m, idx) => ({
          name: String(m?.name || `素材-${idx + 1}`),
          type: String(m?.type || 'image/*'),
          preview: String(m?.preview || m?.url || m?.path || ''),
          url: String(m?.url || ''),
          path: String(m?.path || ''),
        }))
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    setTitle(initialValues?.title || '');
    setRewardPoints(Number(initialValues?.rewardPoints || 0));
    setContent(initialValues?.content || '');
    setStatus(toOnlineStatus(initialValues?.status || 'online'));
    setUploads(
      Array.isArray(initialValues?.media)
        ? initialValues!.media!.map((m, idx) => ({
            name: String(m?.name || `素材-${idx + 1}`),
            type: String(m?.type || 'image/*'),
            preview: String(m?.preview || m?.url || m?.path || ''),
            url: String(m?.url || ''),
            path: String(m?.path || ''),
          }))
        : []
    );
  }, [initialValues]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="flex items-center text-gray-500 hover:text-blue-600 transition-colors gap-1 text-sm font-medium cursor-pointer"
          >
            <ArrowLeft size={18} />
            返回列表
          </button>
          <div className="h-4 w-[1px] bg-gray-200"></div>
          <h2 className="text-lg font-bold text-gray-900">{mode === 'edit' ? '编辑活动' : '创建新活动'}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer">
            <Bell size={20} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 cursor-pointer">
            <HelpCircle size={20} />
          </button>
        </div>
      </header>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Section: Basic Info */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Info size={20} className="text-blue-600" />
                基础信息
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700 mb-2 block">活动标题 <span className="text-red-500">*</span></span>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all px-4 py-2 outline-none" 
                      placeholder="请输入活动标题，例如：春季健康险促销周" 
                    />
                  </label>
                </div>
                <div className="md:col-span-1">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700 mb-2 block">积分</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={rewardPoints}
                        onChange={(e) => setRewardPoints(Number(e.target.value || 0))}
                        className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 pr-12 transition-all px-4 py-2 outline-none" 
                        placeholder="0" 
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">积分</span>
                    </div>
                  </label>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                <Info size={14} />
                用户参与并完成活动后将自动获得设定的积分奖励
              </p>
              <div className="mt-4 max-w-xs">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-2 block">活动状态</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'online' | 'draft' | 'offline')}
                    className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all px-4 py-2 outline-none"
                  >
                    {ONLINE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          {/* Section: Activity Content */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                活动内容
              </h3>
            </div>
            <div className="p-6">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-2 block">活动内容文字</span>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Simple Rich Text Toolbar Simulation */}
                  <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer text-gray-600"><Bold size={18} /></button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer text-gray-600"><Italic size={18} /></button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer text-gray-600"><ListIcon size={18} /></button>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer text-gray-600"><Link size={18} /></button>
                    <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
                    <button className="p-1.5 hover:bg-gray-200 rounded transition-colors cursor-pointer text-gray-600"><ImageIcon size={18} /></button>
                  </div>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full border-none focus:ring-0 bg-white text-gray-900 p-4 resize-none outline-none" 
                    placeholder="在此输入详细的活动说明、条款规则等内容..." 
                    rows={8}
                  ></textarea>
                </div>
              </label>
            </div>
          </section>

          {/* Section: Media Upload */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <UploadCloud size={20} className="text-blue-600" />
                素材上传
              </h3>
            </div>
            <div className="p-6">
              <span className="text-sm font-medium text-gray-700 mb-2 block">图片/视频</span>
              <div className="grid grid-cols-4 gap-4">
                {uploads.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="relative group aspect-video rounded-lg overflow-hidden border border-gray-200 bg-white">
                    {file.type.startsWith('video') ? (
                      <video src={file.preview} className="w-full h-full object-cover" />
                    ) : (
                      <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-1 right-1">
                      <button
                        onClick={() => setUploads((prev) => prev.filter((_, i) => i !== idx))}
                        className="bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/40 text-[10px] text-white backdrop-blur-sm truncate">
                      {file.name}
                    </div>
                  </div>
                ))}
                <label className="aspect-video cursor-pointer border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-600 hover:bg-blue-50 transition-all group">
                  <Plus className="text-gray-400 group-hover:text-blue-600" size={24} />
                  <span className="text-xs text-gray-500 group-hover:text-blue-600 font-medium">点击上传素材</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = (Array.from(e.target.files || []) as File[]).slice(0, 6);
                      if (!files.length || uploading) return;
                      try {
                        setUploading(true);
                        const mapped = await uploadMediaFiles(files);
                        setUploads((prev) => [...prev, ...mapped].slice(0, 6));
                      } catch (err: any) {
                        setSubmitError(err?.message || ERROR_COPY.mediaUploadFailed);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
              </div>
                <p className="mt-3 text-xs text-gray-500">
                  {uploading ? '素材上传中...' : '支持 JPG, PNG, MP4 格式，单文件不超过 50MB。建议尺寸 1200x675px。'}
                </p>
            </div>
          </section>

          {/* Spacing for Bottom Bar */}
          <div className="h-12"></div>
        </div>
      </div>

      {/* Footer Action Bar */}
      <footer className="bg-white border-t border-gray-200 px-8 py-4 shrink-0 flex items-center justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors cursor-pointer"
        >
          取消
        </button>
        <button
          disabled={submitting || uploading}
          onClick={async () => {
            if (!title.trim()) {
              setSubmitError(VALIDATION_COPY.activityTitleRequired);
              return;
            }
            try {
              setSubmitting(true);
              setSubmitError('');
              await onSubmit({
                title: title.trim(),
                category: 'task',
                rewardPoints: Number(rewardPoints || 0),
                content: content.trim(),
                status,
                media: uploads.map((x) => ({ name: x.name, type: x.type, preview: x.preview })),
              });
            } catch (err: any) {
              setSubmitError(err?.message || ERROR_COPY.publishFailed);
            } finally {
              setSubmitting(false);
            }
          }}
          className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 focus:ring-4 focus:ring-blue-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Send size={18} />
          {submitting ? (mode === 'edit' ? '保存中...' : '发布中...') : uploading ? '素材上传中...' : mode === 'edit' ? '保存修改' : '发布活动'}
        </button>
      </footer>
      {submitError ? (
        <div className="fixed bottom-6 right-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {submitError}
        </div>
      ) : null}
    </div>
  );
};

const TenantListPage = ({
  tenants,
  loadError,
  onCreate,
  onOpenDetail,
  onEdit,
  onDelete,
}: {
  tenants: PTenant[];
  loadError?: string;
  onCreate: () => void;
  onOpenDetail: (tenant: PTenant) => void;
  onEdit: (tenant: PTenant) => void;
  onDelete: (tenant: PTenant) => void;
}) => {
  const rows = tenants;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f7fb]">
      <header className="h-16 border-b border-gray-200 bg-white px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">租户管理</h2>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">{rows.length} 条记录</span>
        </div>
        <button
          onClick={onCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <Plus size={18} />
          创建新租户
        </button>
      </header>
      <main className="flex-1 overflow-auto p-8">
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="搜索租户名称、ID或管理员邮箱..."
              />
            </div>
            <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 flex items-center gap-2">
              <Filter size={16} />
              更多筛选
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">租户名称</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">类型</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">管理员邮箱</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">租户ID</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length ? (
                rows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{row.type === 'company' ? '公司' : '个人'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{String((row as any).adminEmail || '-')}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">TNT-{row.id}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${tenantStatusPillClass(row.status)}`}>
                        {tenantStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button onClick={() => onOpenDetail(row)} className="text-blue-600 hover:text-blue-700 text-sm font-bold">详情</button>
                        <button onClick={() => onEdit(row)} className="text-blue-600 hover:text-blue-700 text-sm font-bold">修改</button>
                        <button onClick={() => onDelete(row)} className="text-red-600 hover:text-red-700 text-sm font-bold">删除</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8">
                      <p className="text-base font-semibold text-gray-900">当前没有可展示的真实租户数据</p>
                      <p className="mt-2 text-sm text-gray-500">
                        {loadError || '请先确认 P 端已连接到正确的租户接口，再刷新当前页面。'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

const CreateTenantPage = ({
  onCancel,
  onSubmit,
  mode = 'create',
  initialValues,
}: {
  onCancel: () => void;
  onSubmit: (payload: {
    name: string;
    type: 'company' | 'individual';
    status?: 'active' | 'inactive';
    adminEmail?: string;
    initialPassword?: string;
  }) => Promise<void>;
  mode?: 'create' | 'edit';
  initialValues?: Partial<{
    name: string;
    type: 'company' | 'individual';
    status: 'active' | 'inactive';
    adminEmail: string;
    initialPassword: string;
  }> | null;
}) => {
  const [tenantType, setTenantType] = useState<'company' | 'personal'>(initialValues?.type === 'individual' ? 'personal' : 'company');
  const [plan, setPlan] = useState<'basic' | 'pro' | 'enterprise'>('basic');
  const [tenantName, setTenantName] = useState(initialValues?.name || '');
  const [tenantStatus, setTenantStatus] = useState<'active' | 'inactive'>(initialValues?.status === 'inactive' ? 'inactive' : 'active');
  const [adminEmail, setAdminEmail] = useState(initialValues?.adminEmail || '');
  const [initialPassword, setInitialPassword] = useState(initialValues?.initialPassword || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  useEffect(() => {
    setTenantType(initialValues?.type === 'individual' ? 'personal' : 'company');
    setTenantName(initialValues?.name || '');
    setTenantStatus(initialValues?.status === 'inactive' ? 'inactive' : 'active');
    setAdminEmail(initialValues?.adminEmail || '');
    setInitialPassword(initialValues?.initialPassword || '');
  }, [initialValues]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f7fb]">
      <header className="h-16 border-b border-gray-200 bg-white px-8 flex items-center justify-between shrink-0">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">{mode === 'edit' ? '编辑租户' : '创建新租户'}</h2>
      </header>
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700 mb-3">租户类别</p>
            <div className="rounded-xl p-1 bg-gray-100 flex">
              <button
                onClick={() => setTenantType('company')}
                className={`flex-1 py-2 text-sm rounded-lg font-semibold ${tenantType === 'company' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
              >
                公司
              </button>
              <button
                onClick={() => setTenantType('personal')}
                className={`flex-1 py-2 text-sm rounded-lg font-semibold ${tenantType === 'personal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
              >
                个人代理
              </button>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-gray-700">
              {tenantType === 'company' ? '公司名称' : '代理名称'}
              <input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder={tenantType === 'company' ? 'e.g. Acme Corporation' : 'e.g. Liam Henderson'}
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              营业执照代码
              <input className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="BL-12345-X" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              管理员邮箱
              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="admin@company.com"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              初始密码
              <input
                type="password"
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="至少 6 位字符"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              状态
              <select
                value={tenantStatus}
                onChange={(e) => setTenantStatus((e.target.value || 'active') as 'active' | 'inactive')}
                className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {TENANT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="px-6 pb-6">
            <p className="text-sm font-bold text-gray-700 mb-3">订阅套餐</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'basic', name: '基础版', desc: '支持 10 个用户', price: '$49/mo' },
                { key: 'pro', name: '专业版', desc: '支持 50 个用户', price: '$199/mo' },
                { key: 'enterprise', name: '企业版', desc: '无限制用户', price: '定制' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setPlan(item.key as any)}
                  className={`p-4 rounded-xl border text-left ${plan === item.key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="text-base font-bold text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                  <div className="text-2xl font-black text-blue-600 mt-3">{item.price}</div>
                </button>
              ))}
            </div>
          </div>
          {submitError && (
            <div className="mx-6 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</div>
          )}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600">
              取消
            </button>
            <button
              disabled={submitting}
              onClick={async () => {
                const name = tenantName.trim();
                if (!name) {
                  setSubmitError(VALIDATION_COPY.tenantNameRequired);
                  return;
                }
                if (mode === 'create') {
                  const email = adminEmail.trim();
                  if (!email) {
                    setSubmitError(VALIDATION_COPY.adminEmailRequired);
                    return;
                  }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    setSubmitError(VALIDATION_COPY.adminEmailInvalid);
                    return;
                  }
                  if (String(initialPassword || '').trim().length < 6) {
                    setSubmitError(VALIDATION_COPY.initPasswordMin6);
                    return;
                  }
                }
                try {
                  setSubmitting(true);
                  setSubmitError('');
                  await onSubmit({
                    name,
                    type: tenantType === 'company' ? 'company' : 'individual',
                    status: tenantStatus,
                    adminEmail: adminEmail.trim() || undefined,
                    initialPassword: initialPassword.trim() || undefined,
                  });
                } catch (err: any) {
                  setSubmitError(err?.message || (mode === 'edit' ? ERROR_COPY.tenantUpdateFailed : ERROR_COPY.tenantCreateFailed));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? (mode === 'edit' ? '保存中...' : '创建中...') : mode === 'edit' ? '保存修改' : '创建租户'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

const MallManagementPage = ({
  onAddProduct,
  onAddActivity,
  canCreate,
  onNoPermission,
  onMoveProduct,
  onMoveActivity,
  onViewProduct,
  onViewActivity,
  onEditProduct,
  onDeleteProduct,
  onEditActivity,
  onDeleteActivity,
  products,
  activities,
}: {
  onAddProduct: () => void;
  onAddActivity: () => void;
  canCreate: boolean;
  onNoPermission: () => void;
  onMoveProduct: (sourceId: number, targetId: number) => Promise<void>;
  onMoveActivity: (sourceId: number, targetId: number) => Promise<void>;
  onViewProduct: (id: number) => void;
  onViewActivity: (id: number) => void;
  onEditProduct: (id: number) => void;
  onDeleteProduct: (id: number) => void;
  onEditActivity: (id: number) => void;
  onDeleteActivity: (id: number) => void;
  products: PMallProduct[];
  activities: PMallActivity[];
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'activities'>('products');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [movingRowKey, setMovingRowKey] = useState('');
  const pageSize = 10;
  const productRows = products.map((row) => ({
    id: row.id,
    sortOrder: Number((row as any).sortOrder || 0),
    name: (row as any).title || (row as any).name || `商品-${row.id}`,
    points: Number((row as any).points ?? (row as any).pointsCost ?? 0).toLocaleString(),
    stock: Number(row.stock || 0),
    status: toRunningStatus((row as any).status === 'active' || (row as any).shelfStatus === 'on' ? 'active' : (row as any).status),
    updatedAtSort: (() => {
      const raw = (row as any).updatedAt || (row as any).createdAt || '';
      const parsed = Date.parse(String(raw || ''));
      return Number.isFinite(parsed) ? parsed : 0;
    })(),
    updatedAt: String((row as any).updatedAt || (row as any).createdAt || '').slice(0, 16).replace('T', ' '),
    isPlatformTemplate: Boolean((row as any).isPlatformTemplate),
    templateTag: String((row as any).templateTag || ''),
    media: Array.isArray((row as any).media) ? (row as any).media : [],
  }));
  const activityRows = activities.map((row) => ({
    id: row.id,
    sortOrder: Number((row as any).sortOrder || 0),
    name: row.title,
    type: (row as any).type || (row as any).category || 'task',
    reward: Number((row as any).rewardPoints || 0).toLocaleString(),
    status: toRunningStatus((row as any).status),
    updatedAtSort: (() => {
      const raw = (row as any).updatedAt || (row as any).createdAt || '';
      const parsed = Date.parse(String(raw || ''));
      return Number.isFinite(parsed) ? parsed : 0;
    })(),
    updatedAt: String((row as any).updatedAt || (row as any).createdAt || '').slice(0, 16).replace('T', ' '),
    isPlatformTemplate: Boolean((row as any).isPlatformTemplate),
    templateTag: String((row as any).templateTag || ''),
    media: Array.isArray((row as any).media) ? (row as any).media : [],
  }));
  const sourceRows = (activeTab === 'products' ? productRows : activityRows)
    .sort((a, b) => Number((a as any).sortOrder || 0) - Number((b as any).sortOrder || 0) || Number((a as any).id || 0) - Number((b as any).id || 0))
    .map((row, idx) => ({ ...row, order: idx + 1 }));
  const q = searchText.trim().toLowerCase();
  const filteredRows = sourceRows.filter((row) => {
    if (!q) return true;
    return (
      String((row as any).name || '').toLowerCase().includes(q) ||
      String((row as any).templateTag || '').toLowerCase().includes(q)
    );
  });
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchText, products.length, activities.length]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const sourceRowIndexMap = new Map(sourceRows.map((row, idx) => [Number((row as any).id || 0), idx]));
  const startNo = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endNo = Math.min(safePage * pageSize, filteredRows.length);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, safePage - 3),
    Math.max(5, safePage + 2),
  );

  const moveRow = async (rowId: number, direction: 'up' | 'down') => {
    const currentIndex = sourceRowIndexMap.get(Number(rowId || 0));
    if (typeof currentIndex !== 'number') return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sourceRows.length) return;
    const targetId = Number((sourceRows[targetIndex] as any)?.id || 0);
    if (!targetId) return;
    const nextKey = `${activeTab}:${rowId}`;
    setMovingRowKey(nextKey);
    try {
      if (activeTab === 'products') {
        await onMoveProduct(Number(rowId), targetId);
      } else {
        await onMoveActivity(Number(rowId), targetId);
      }
    } finally {
      setMovingRowKey('');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-bold text-gray-900">积分商城</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-11 w-72 rounded-xl bg-gray-100 border-none pl-10 pr-4 text-sm outline-none"
              placeholder={activeTab === 'products' ? '搜索商品...' : '搜索活动...'}
            />
          </div>
          <button className="px-5 h-11 rounded-xl bg-blue-600 text-white text-sm font-bold">个人中心</button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1180px] mx-auto space-y-6">
          <div className="flex items-center gap-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('products')}
              className={`pb-3 text-sm font-semibold ${activeTab === 'products' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            >
              商品货架
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={`pb-3 text-sm font-semibold ${activeTab === 'activities' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            >
              活动货架
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{activeTab === 'products' ? '商品货架管理' : '活动货架管理'}</h3>
              <p className="text-gray-500 mt-1">管理积分商城中所有可兑换内容</p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 max-w-4xl">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-blue-700">{TEMPLATE_DELIVERY_RULE_NOTE}</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (!canCreate) return onNoPermission();
                return activeTab === 'products' ? onAddProduct() : onAddActivity();
              }}
              className="px-5 h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              <Plus size={16} />
              {activeTab === 'products' ? '新增上架商品' : '新增上架活动'}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">展示排序</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{activeTab === 'products' ? '商品名称' : '活动名称'}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{activeTab === 'products' ? '所需积分' : '活动类型'}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">{activeTab === 'products' ? '库存' : '关联积分奖励'}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">更新时间</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">调序</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="inline-flex w-12 h-9 rounded-lg bg-gray-100 items-center justify-center text-sm font-bold text-gray-700">{row.order}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span>{row.name}</span>
                        {(row as any).isPlatformTemplate ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                            {(row as any).templateTag || '平台模板'}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">{activeTab === 'products' ? (row as any).points : (row as any).type}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{activeTab === 'products' ? (row as any).stock : (row as any).reward}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${runningStatusSoftPillClass((row as any).status)}`}>
                        {toRunningStatusLabel((row as any).status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{(row as any).updatedAt}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const rowId = Number((row as any).id || 0);
                        const sourceIndex = sourceRowIndexMap.get(rowId) ?? -1;
                        const rowKey = `${activeTab}:${rowId}`;
                        const isMoving = movingRowKey === rowKey;
                        const canMoveUp = sourceIndex > 0 && !isMoving;
                        const canMoveDown = sourceIndex >= 0 && sourceIndex < sourceRows.length - 1 && !isMoving;
                        return (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => moveRow(rowId, 'up')}
                              disabled={!canMoveUp}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            >
                              <ChevronUp size={20} />
                            </button>
                            <button
                              onClick={() => moveRow(rowId, 'down')}
                              disabled={!canMoveDown}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                            >
                              <ChevronDown size={20} />
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-4 text-sm font-bold">
                        <button
                          onClick={() => (activeTab === 'products' ? onViewProduct(Number((row as any).id || 0)) : onViewActivity(Number((row as any).id || 0)))}
                          className="text-blue-600"
                        >
                          查看
                        </button>
                        <button
                          onClick={() =>
                            activeTab === 'products'
                              ? onEditProduct(Number((row as any).id || 0))
                              : onEditActivity(Number((row as any).id || 0))
                          }
                          className="text-blue-600"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() =>
                            activeTab === 'products'
                              ? onDeleteProduct(Number((row as any).id || 0))
                              : onDeleteActivity(Number((row as any).id || 0))
                          }
                          className="text-red-500"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">暂无数据</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium">显示 {startNo} 到 {endNo} 共 {filteredRows.length} 条记录，按展示顺序排序</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-white transition-colors text-gray-500 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold cursor-pointer ${safePage === n ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' : 'border border-gray-200 hover:bg-white text-gray-700'}`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-white transition-colors text-gray-500 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const MallProductDetailPage = ({
  onBack,
  onEdit,
  item,
}: {
  onBack: () => void;
  onEdit: () => void;
  item: PMallProduct | null;
}) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center gap-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"><ArrowLeft size={16} />返回货架</button>
      <h2 className="text-xl font-bold text-gray-900">商品货架详情</h2>
      <button onClick={onEdit} className="ml-auto px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700">编辑商品</button>
    </header>
    <main className="flex-1 overflow-auto p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">基础信息</div>
          <div className="p-6 space-y-5">
            <h3 className="text-3xl font-black text-gray-900">{item?.title || '未找到商品'}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">所需积分：</span><span className="font-semibold">{Number(item?.points || 0)}</span></div>
              <div><span className="text-gray-500">库存：</span><span className="font-semibold">{Number(item?.stock || 0)}</span></div>
              <div><span className="text-gray-500">上架排序：</span><span className="font-semibold">{formatDisplaySortOrder(item?.sortOrder)}</span></div>
              <div><span className="text-gray-500">商品分类：</span><span className="font-semibold">{String((item as any)?.category || '-')}</span></div>
              <div><span className="text-gray-500">状态：</span><span className="font-semibold">{toRunningStatusLabel(String(item?.status || 'draft'))}</span></div>
              <div><span className="text-gray-500">更新时间：</span><span className="font-semibold">{String(item?.updatedAt || '').slice(0, 16).replace('T', ' ') || '-'}</span></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">商品描述</p>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 min-h-28 whitespace-pre-wrap">
                {String((item as any)?.description || '暂无商品描述')}
              </div>
            </div>
          </div>
        </section>
        <section className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">商品图片</div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                {(Array.isArray((item as any)?.media) && (item as any).media.length ? (item as any).media : [{ name: '暂无素材', type: '-' }]).map((m: any, idx: number) => (
                  <div key={`${m.name}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    {String(m.type || '').startsWith('video') ? (
                      <video controls src={String(m.preview || '')} className="w-full h-full object-cover" />
                    ) : String(m.type || '').startsWith('image') && m.preview ? (
                      <img src={String(m.preview || '')} alt={m.name || '商品素材'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-2 text-center">{m.name || '暂无素材'}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">兑换设置</div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>限制每人兑换数量</span><span className="font-semibold">{(item as any)?.limitPerUser ? '开启' : '关闭'}</span></div>
              <div className="flex items-center justify-between"><span>仅限VIP用户兑换</span><span className="font-semibold">{(item as any)?.vipOnly ? '开启' : '关闭'}</span></div>
              <div className="flex items-center justify-between"><span>开启活动倒计时</span><span className="font-semibold">{(item as any)?.enableCountdown ? '开启' : '关闭'}</span></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
);

const MallActivityDetailPage = ({
  onBack,
  onEdit,
  item,
}: {
  onBack: () => void;
  onEdit: () => void;
  item: PMallActivity | null;
}) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center gap-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"><ArrowLeft size={16} />返回货架</button>
      <h2 className="text-xl font-bold text-gray-900">活动货架详情</h2>
      <button onClick={onEdit} className="ml-auto px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700">编辑活动</button>
    </header>
    <main className="flex-1 overflow-auto p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">活动配置</div>
          <div className="p-6 space-y-5">
            <h3 className="text-3xl font-black text-gray-900">{(item as any)?.displayTitle || item?.title || '未找到活动'}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">活动名称：</span><span className="font-semibold">{String(item?.title || '-')}</span></div>
              <div><span className="text-gray-500">活动类型：</span><span className="font-semibold">{String(item?.type || '-')}</span></div>
              <div><span className="text-gray-500">奖励积分：</span><span className="font-semibold">{Number(item?.rewardPoints || 0)}</span></div>
              <div><span className="text-gray-500">显示排序：</span><span className="font-semibold">{formatDisplaySortOrder(item?.sortOrder)}</span></div>
              <div><span className="text-gray-500">状态：</span><span className="font-semibold">{toRunningStatusLabel(String(item?.status || 'draft'))}</span></div>
              <div><span className="text-gray-500">更新时间：</span><span className="font-semibold">{String(item?.updatedAt || '').slice(0, 16).replace('T', ' ') || '-'}</span></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">活动描述</p>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 min-h-28 whitespace-pre-wrap">
                {String((item as any)?.description || '暂无活动描述')}
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">展示素材</div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3">
              {(Array.isArray((item as any)?.media) && (item as any).media.length ? (item as any).media : [{ name: '暂无素材', type: '-' }]).map((m: any, idx: number) => (
                <div key={`${m.name}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                  {String(m.type || '').startsWith('video') ? (
                    <video controls src={String(m.preview || '')} className="w-full h-full object-cover" />
                  ) : String(m.type || '').startsWith('image') && m.preview ? (
                    <img src={String(m.preview || '')} alt={m.name || '活动素材'} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-2 text-center">{m.name || '暂无素材'}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
);

const AddMallProductPage = ({
  onBack,
  onSubmit,
  mode = 'create',
  initialValues,
}: {
  onBack: () => void;
  onSubmit: (payload: {
    title: string;
    points: number;
    stock: number;
    sortOrder: number;
    category: string;
    description: string;
    limitPerUser: boolean;
    vipOnly: boolean;
    enableCountdown: boolean;
    status: 'active' | 'inactive' | 'draft';
    media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
  }) => Promise<void>;
  mode?: 'create' | 'edit';
  initialValues?: Partial<{
    title: string;
    points: number;
    stock: number;
    sortOrder: number;
    category: string;
    description: string;
    limitPerUser: boolean;
    vipOnly: boolean;
    enableCountdown: boolean;
    status: string;
    media: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
  }> | null;
}) => {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [points, setPoints] = useState(Number(initialValues?.points || 0));
  const [stock, setStock] = useState(Number(initialValues?.stock || 0));
  const [sortOrder, setSortOrder] = useState(Number(initialValues?.sortOrder || 99));
  const [category, setCategory] = useState(initialValues?.category || '实物礼品 (Gift)');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [status, setStatus] = useState<'active' | 'inactive' | 'draft'>(
    toRunningStatus(initialValues?.status || 'active')
  );
  const [limitPerUser, setLimitPerUser] = useState(Boolean(initialValues?.limitPerUser));
  const [vipOnly, setVipOnly] = useState(Boolean(initialValues?.vipOnly));
  const [enableCountdown, setEnableCountdown] = useState(Boolean(initialValues?.enableCountdown));
  const [uploads, setUploads] = useState<UploadMediaItem[]>(
    Array.isArray(initialValues?.media)
      ? initialValues!.media!.map((m, idx) => ({
          name: String(m?.name || `素材-${idx + 1}`),
          type: String(m?.type || 'image/*'),
          preview: String(m?.preview || m?.url || m?.path || ''),
          url: String(m?.url || ''),
          path: String(m?.path || ''),
        }))
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setTitle(initialValues?.title || '');
    setPoints(Number(initialValues?.points || 0));
    setStock(Number(initialValues?.stock || 0));
    setSortOrder(Number(initialValues?.sortOrder || 99));
    setCategory(initialValues?.category || '实物礼品 (Gift)');
    setDescription(initialValues?.description || '');
    setStatus(toRunningStatus(initialValues?.status || 'active'));
    setLimitPerUser(Boolean(initialValues?.limitPerUser));
    setVipOnly(Boolean(initialValues?.vipOnly));
    setEnableCountdown(Boolean(initialValues?.enableCountdown));
    setUploads(
      Array.isArray(initialValues?.media)
        ? initialValues!.media!.map((m, idx) => ({
            name: String(m?.name || `素材-${idx + 1}`),
            type: String(m?.type || 'image/*'),
            preview: String(m?.preview || m?.url || m?.path || ''),
            url: String(m?.url || ''),
            path: String(m?.path || ''),
          }))
        : []
    );
  }, [initialValues]);
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <span className="text-gray-300">|</span>
          <div className="text-sm text-gray-500">内容与营销 &gt; 积分商城 &gt; {mode === 'edit' ? '编辑商品' : '新增商品'}</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="px-6 h-10 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold">取消</button>
          <button
            onClick={async () => {
              if (!title.trim()) return;
              if (uploading) return;
              try {
                setSubmitting(true);
                await onSubmit({
                  title: title.trim(),
                  points,
                  stock,
                  sortOrder,
                  category,
                  description: description.trim(),
                  limitPerUser,
                  vipOnly,
                  enableCountdown,
                  status,
                  media: uploads.map((x) => ({ name: x.name, type: x.type, preview: x.preview, url: x.url, path: x.path })),
                });
              } finally {
                setSubmitting(false);
              }
            }}
            className="px-6 h-10 rounded-xl bg-blue-600 text-white text-sm font-bold"
          >
            {submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '保存并上架'}
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1180px] mx-auto">
          <h2 className="text-3xl font-bold text-gray-900">{mode === 'edit' ? '编辑商城商品' : '新增商城商品'}</h2>
          <p className="text-gray-500 mt-2">在积分商城中创建一个新的兑换商品，请填写详细信息。</p>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">基础信息</div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-sm font-bold text-gray-800">商品标题 *
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none" placeholder="例如：高端定制体检套餐" />
                  </label>
                  <label className="text-sm font-bold text-gray-800">所需积分 *
                    <div className="mt-2 relative">
                      <input value={points} onChange={(e) => setPoints(Number(e.target.value || 0))} className="w-full h-11 rounded-xl border border-gray-200 px-4 pr-10 text-sm outline-none" placeholder="请输入分值" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">积分</span>
                    </div>
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <label className="text-sm font-bold text-gray-800">商品分类
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none">
                      <option>实物礼品 (Gift)</option>
                      <option>健康服务</option>
                      <option>优惠券</option>
                      <option>增值权益</option>
                    </select>
                  </label>
                  <label className="text-sm font-bold text-gray-800">初始库存
                    <input value={stock} onChange={(e) => setStock(Number(e.target.value || 0))} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none" />
                  </label>
                  <label className="text-sm font-bold text-gray-800">上架排序
                    <input value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value || 99))} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none" />
                  </label>
                  <label className="text-sm font-bold text-gray-800">商品状态
                    <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'draft')} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none">
                      {RUNNING_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-bold text-gray-800">商品描述
                  <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                    <div className="h-11 px-4 flex items-center gap-3 bg-gray-50 border-b border-gray-100">
                      <Bold size={16} /><Italic size={16} /><ListIcon size={16} /><ImageIcon size={16} /><Link size={16} />
                    </div>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full min-h-52 p-4 text-sm outline-none resize-none" placeholder="请输入详细的商品兑换说明、使用规则等内容..." />
                  </div>
                </label>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">商品图片</div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-3">
                    {uploads.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                        {file.type.startsWith('video') ? (
                          <video src={file.preview} className="w-full h-full object-cover" />
                        ) : (
                          <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                        )}
                        <button
                          onClick={() => setUploads((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square border-2 border-dashed border-blue-100 rounded-2xl bg-blue-50/20 flex flex-col items-center justify-center text-center cursor-pointer">
                      <UploadCloud size={26} className="text-blue-600" />
                      <p className="text-sm font-semibold text-gray-900 mt-3">点击上传</p>
                      <p className="text-[10px] text-gray-400 mt-1">图片/视频</p>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = (Array.from(e.target.files || []) as File[]).slice(0, 4);
                          if (!files.length || uploading) return;
                          try {
                            setUploading(true);
                            const next = await uploadMediaFiles(files);
                            setUploads((prev) => [...prev, ...next].slice(0, 4));
                          } catch (err: any) {
                            showApiError(err, ERROR_COPY.mediaUploadFailed);
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">{uploading ? '素材上传中...' : '支持 JPG, PNG, WEBP, MP4 (最多4个)'}</p>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">兑换设置</div>
                <div className="p-6 space-y-4 text-sm">
                  <label className="flex items-center justify-between"><span>限制每人兑换数量</span><input checked={limitPerUser} onChange={(e) => setLimitPerUser(e.target.checked)} type="checkbox" /></label>
                  <label className="flex items-center justify-between"><span>仅限VIP用户兑换</span><input checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} type="checkbox" /></label>
                  <label className="flex items-center justify-between"><span>开启活动倒计时</span><input checked={enableCountdown} onChange={(e) => setEnableCountdown(e.target.checked)} type="checkbox" /></label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const AddMallActivityPage = ({
  onBack,
  onSubmit,
  mode = 'create',
  initialValues,
}: {
  onBack: () => void;
  onSubmit: (payload: {
    title: string;
    displayTitle: string;
    type: ActivityTypeOptionValue;
    rewardPoints: number;
    sortOrder: number;
    description: string;
    status: 'active' | 'inactive' | 'draft';
    media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
  }) => Promise<void>;
  mode?: 'create' | 'edit';
  initialValues?: Partial<{
    title: string;
    displayTitle: string;
    type: ActivityTypeOptionValue;
    rewardPoints: number;
    sortOrder: number;
    description: string;
    status: string;
    media: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
  }> | null;
}) => {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [displayTitle, setDisplayTitle] = useState(initialValues?.displayTitle || '');
  const [type, setType] = useState<ActivityTypeOptionValue>(initialValues?.type || 'task');
  const [rewardPoints, setRewardPoints] = useState(Number(initialValues?.rewardPoints || 0));
  const [sortOrder, setSortOrder] = useState(Number(initialValues?.sortOrder || 10));
  const [description, setDescription] = useState(initialValues?.description || '');
  const [status, setStatus] = useState<'active' | 'inactive' | 'draft'>(
    toRunningStatus(initialValues?.status || 'active')
  );
  const [uploads, setUploads] = useState<UploadMediaItem[]>(
    Array.isArray(initialValues?.media)
      ? initialValues!.media!.map((m, idx) => ({
          name: String(m?.name || `素材-${idx + 1}`),
          type: String(m?.type || 'image/*'),
          preview: String(m?.preview || m?.url || m?.path || ''),
          url: String(m?.url || ''),
          path: String(m?.path || ''),
        }))
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  useEffect(() => {
    setTitle(initialValues?.title || '');
    setDisplayTitle(initialValues?.displayTitle || '');
    setType(initialValues?.type || 'task');
    setRewardPoints(Number(initialValues?.rewardPoints || 0));
    setSortOrder(Number(initialValues?.sortOrder || 10));
    setDescription(initialValues?.description || '');
    setStatus(toRunningStatus(initialValues?.status || 'active'));
    setUploads(
      Array.isArray(initialValues?.media)
        ? initialValues!.media!.map((m, idx) => ({
            name: String(m?.name || `素材-${idx + 1}`),
            type: String(m?.type || 'image/*'),
            preview: String(m?.preview || m?.url || m?.path || ''),
            url: String(m?.url || ''),
            path: String(m?.path || ''),
          }))
        : []
    );
  }, [initialValues]);
  const submitForm = async () => {
    if (!title.trim() && !displayTitle.trim()) {
      setSubmitError(VALIDATION_COPY.activityNameRequired);
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError('');
      await onSubmit({
        title: title.trim() || displayTitle.trim(),
        displayTitle: (displayTitle || title).trim(),
        type,
        rewardPoints,
        sortOrder,
        description: description.trim(),
        status,
        media: uploads.map((x) => ({ name: x.name, type: x.type, preview: x.preview, url: x.url, path: x.path })),
      });
    } catch (err: any) {
      setSubmitError(err?.message || ERROR_COPY.activityShelfFailed);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Megaphone size={20} /> 积分商城管理</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="px-6 h-10 rounded-xl border border-gray-200 text-gray-700 font-semibold">取消</button>
          <button
            onClick={() => void submitForm()}
            disabled={uploading || submitting}
            className="px-6 h-10 rounded-xl bg-blue-600 text-white font-bold"
          >
            {submitting ? '保存中...' : uploading ? '素材上传中...' : mode === 'edit' ? '保存修改' : '确认并上架'}
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-sm text-gray-500">积分商城 &gt; 活动货架 &gt; {mode === 'edit' ? '编辑上架活动' : '新增上架活动'}</div>
          <h2 className="text-3xl font-bold text-gray-900 mt-3">{mode === 'edit' ? '编辑上架活动' : '新增上架活动'}</h2>
          <p className="text-gray-500 mt-2">配置活动在积分商城货架上的展示方式。</p>
          <div className="mt-6 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 text-xl font-bold text-gray-900">活动配置</div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm font-bold text-gray-800">活动名称 *
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none" placeholder="从活动中心选择" />
                </label>
                <label className="text-sm font-bold text-gray-800">展示标题 *
                  <input value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none" placeholder="输入在积分商城的展示名称" />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-bold text-gray-800 mb-2">展示图片</p>
                  <div className="grid grid-cols-3 gap-3">
                    {uploads.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="relative h-32 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                        {file.type.startsWith('video') ? (
                          <video src={file.preview} className="w-full h-full object-cover" />
                        ) : (
                          <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                        )}
                        <button
                          onClick={() => setUploads((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <label className="h-32 border-2 border-dashed border-blue-100 rounded-2xl bg-blue-50/20 flex flex-col items-center justify-center text-center cursor-pointer">
                      <ImageIcon size={24} className="text-blue-600" />
                      <p className="text-blue-600 text-xs font-semibold mt-2">上传图片/视频</p>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = (Array.from(e.target.files || []) as File[]).slice(0, 3);
                          if (!files.length || uploading) return;
                          try {
                            setUploading(true);
                            const next = await uploadMediaFiles(files);
                            setUploads((prev) => [...prev, ...next].slice(0, 3));
                          } catch (err: any) {
                            setSubmitError(err?.message || ERROR_COPY.mediaUploadFailed);
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-bold text-gray-800 block">活动类型
                    <select value={type} onChange={(e) => setType(e.target.value as ActivityTypeOptionValue)} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none">
                      {ACTIVITY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-gray-800 block">所需积分
                    <div className="mt-2 relative">
                      <input value={rewardPoints} onChange={(e) => setRewardPoints(Number(e.target.value || 0))} className="w-full h-11 rounded-xl border border-gray-200 px-4 pr-10 text-sm outline-none" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">积分</span>
                    </div>
                  </label>
                  <label className="text-sm font-bold text-gray-800 block">显示排序
                    <input value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value || 10))} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none" placeholder="例如：10" />
                  </label>
                  <label className="text-sm font-bold text-gray-800 block">活动状态
                    <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'draft')} className="mt-2 w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none">
                      {RUNNING_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">活动描述（预览）</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-28 p-5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm outline-none resize-none"
                  placeholder="请输入活动简介、展示文案、参与说明..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button className="px-6 h-10 rounded-xl border border-gray-200 text-gray-700 font-semibold">{ACTION_COPY.saveDraft}</button>
              <button
                disabled={submitting}
                onClick={() => void submitForm()}
                className="px-6 h-10 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60"
              >
                {submitting ? '保存中...' : mode === 'edit' ? '保存修改' : '确认并上架'}
              </button>
            </div>
            {submitError ? <div className="px-6 pb-4 text-xs text-red-600">{submitError}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
};

const TenantDetailPage = ({ tenant, onBack }: { tenant: PTenant | null; onBack: () => void }) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center gap-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"><ArrowLeft size={16} />返回</button>
      <h2 className="text-xl font-bold text-gray-900">租户详情与配额</h2>
    </header>
    <main className="flex-1 overflow-auto p-8">
      {!tenant ? (
        <div className="max-w-3xl mx-auto rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <h3 className="text-lg font-bold text-gray-900">未找到真实租户数据</h3>
          <p className="mt-2 text-sm text-gray-500">当前详情页只展示真实选中的租户；如果列表数据已经刷新或被清空，请返回租户列表重新进入。</p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">租户基础信息</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">租户名称</span><p className="font-semibold mt-1">{tenant.name}</p></div>
              <div><span className="text-gray-500">租户类型</span><p className="font-semibold mt-1">{tenant.type === 'company' ? '公司' : '个人'}</p></div>
              <div><span className="text-gray-500">管理员邮箱</span><p className="font-semibold mt-1">{String((tenant as any).adminEmail || '-')}</p></div>
              <div><span className="text-gray-500">状态</span><p className={`font-semibold mt-1 ${tenantStatusTextClass(tenant.status)}`}>{tenantStatusLabel(tenant.status)}</p></div>
              <div><span className="text-gray-500">租户 ID</span><p className="font-semibold mt-1">TNT-{tenant.id}</p></div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900">套餐配额</h3>
            <p className="mt-3 text-sm text-gray-500">当前 P 端接口还没有返回真实配额字段，这里不再展示任何硬编码示例值。</p>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              如果后端后续补充租户套餐或配额接口，这里再接真实数据。
            </div>
          </div>
        </div>
      )}
    </main>
  </div>
);

const LabelListPage = () => {
  const [list, setList] = useState<PTag[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<EnabledStatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await pApi.tags({ query: query.trim() || undefined, status: status === 'all' ? undefined : status, page: 1, pageSize: 100 });
      setList(res.list || []);
    } catch (err: any) {
      setError(err?.message || ERROR_COPY.tagLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [query, status]);

  const createTag = async () => {
    const tagName = window.prompt('标签名称');
    if (!tagName) return;
    const tagCode = window.prompt('标签编码（建议英文下划线）', `TAG_${Date.now()}`) || '';
    const tagType = (window.prompt('标签类型(enum/boolean/number/date)', 'enum') || 'enum') as 'enum' | 'boolean' | 'number' | 'date';
    try {
      await pApi.saveTag({ tagName: tagName.trim(), tagCode: tagCode.trim(), tagType, source: 'manual', status: 'draft', description: '' });
      await load();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagCreateFailed);
    }
  };

  const editTag = async (item: PTag) => {
    const tagName = window.prompt('标签名称', item.tagName || '');
    if (!tagName) return;
    const description = window.prompt('标签描述', item.description || '') || '';
    try {
      await pApi.saveTag({
        id: Number(item.id),
        tagName: tagName.trim(),
        tagCode: String(item.tagCode || ''),
        tagType: (item.tagType as any) || 'enum',
        source: item.source || 'manual',
        status: (item.status as any) || 'draft',
        description,
        valueSchema: item.valueSchema || {},
      });
      await load();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagEditFailed);
    }
  };

  const toggleTagStatus = async (item: PTag) => {
    const nextStatus = item.status === 'active' ? 'disabled' : 'active';
    try {
      await pApi.setTagStatus(Number(item.id), nextStatus as any);
      await load();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagToggleFailed);
    }
  };

  const removeTag = async (item: PTag) => {
    if (!window.confirm(`确认删除标签「${item.tagName}」？`)) return;
    try {
      await pApi.deleteTag(Number(item.id));
      await load();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagDeleteFailed);
    }
  };

  const totalCount = list.length;
  const activeCount = list.filter((x) => String(x.status) === 'active').length;
  const customCount = list.filter((x) => String(x.source || '') === 'manual').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">标签列表</h2>
          <span className="text-sm text-gray-500">营销策略 / 标签列表</span>
        </div>
        <button onClick={() => void createTag()} className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-bold">新建标签</button>
      </header>
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1220px] mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">标签总数</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{totalCount}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">活跃标签</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{activeCount}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">手动标签</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{customCount}</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="搜索标签名称、编码、来源"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
              >
                {TAG_STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button onClick={() => void load()} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 font-semibold">
                {ACTION_COPY.refresh}
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">标签名称</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">标签编码</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">类型</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">来源</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">更新时间</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.tagName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{row.tagCode}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{row.tagType}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{row.source || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tagStatusPillClass(row.status)}`}>{tagStatusLabel(row.status)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{String(row.updatedAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => void editTag(row)} className="text-blue-600 text-sm font-bold">编辑</button>
                        <button onClick={() => void toggleTagStatus(row)} className="text-indigo-600 text-sm font-bold">{tagToggleActionLabel(row.status)}</button>
                        <button onClick={() => void removeTag(row)} className="text-red-500 text-sm font-bold">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && list.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">暂无标签数据</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">加载中...</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {error ? <div className="text-xs text-red-600">{error}</div> : null}
        </div>
      </main>
    </div>
  );
};

const StrategyListPage = ({
  list,
  onCreate,
  onEdit,
}: {
  list: PStrategy[];
  onCreate: () => void;
  onEdit: (strategy: PStrategy) => void;
}) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <h2 className="text-xl font-bold text-gray-900">策略引擎</h2>
      <button onClick={onCreate} className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-bold">新增策略引擎</button>
    </header>
    <main className="flex-1 overflow-auto p-8">
      <div className="max-w-[1220px] mx-auto bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="h-14 px-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="relative w-96">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full h-9 rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="搜索策略名称/策略ID..." />
          </div>
          <span className="text-xs text-gray-500">共 {list.length} 条策略</span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-xs uppercase text-gray-500 font-bold">策略名称</th>
              <th className="px-5 py-3 text-xs uppercase text-gray-500 font-bold">策略ID</th>
              <th className="px-5 py-3 text-xs uppercase text-gray-500 font-bold">状态</th>
              <th className="px-5 py-3 text-xs uppercase text-gray-500 font-bold">最近执行</th>
              <th className="px-5 py-3 text-xs uppercase text-gray-500 font-bold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm font-semibold text-gray-900">{row.name}</td>
                <td className="px-5 py-4 text-sm text-gray-700">{row.id}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${activeStatusPillClass(row.status)}`}>
                    {activeStatusLabel(row.status)}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {row.lastExecutedAt ? String(row.lastExecutedAt).slice(0, 16).replace('T', ' ') : '-'}
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => onEdit(row)} className="text-blue-600 text-sm font-bold">编辑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  </div>
);

const StrategyCanvasPage = ({ onBack, strategy }: { onBack: () => void; strategy: PStrategy | null }) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
          <ArrowLeft size={16} />
          返回列表
        </button>
        <h2 className="text-xl font-bold text-gray-900">策略引擎配置</h2>
      </div>
      <button className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-bold">发布策略</button>
    </header>
    <main className="flex-1 overflow-auto p-8">
      <div className="max-w-[1320px] mx-auto space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase">触发器</p>
              <p className="mt-2 font-semibold text-gray-900">客户标签命中：高净值</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-bold uppercase">条件</p>
              <p className="mt-2 font-semibold text-gray-900">7天内未跟进</p>
            </div>
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
              <p className="text-xs text-orange-600 font-bold uppercase">动作</p>
              <p className="mt-2 font-semibold text-gray-900">分配给指定业务员并推送提醒</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <section className="xl:col-span-3 rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="h-12 px-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-700">画布区</div>
              <div className="flex items-center gap-2 text-xs">
                <button className="px-3 h-8 rounded-lg border border-gray-200 text-gray-600 bg-white">缩小</button>
                <button className="px-3 h-8 rounded-lg border border-gray-200 text-gray-600 bg-white">100%</button>
                <button className="px-3 h-8 rounded-lg border border-gray-200 text-gray-600 bg-white">放大</button>
              </div>
            </div>
            <div className="p-6 bg-[radial-gradient(circle_at_1px_1px,#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] min-h-[520px]">
              <div className="flex items-center gap-4">
                <div className="w-60 p-4 rounded-xl border border-blue-200 bg-blue-50">
                  <p className="text-xs font-bold text-blue-600">触发器</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">命中标签：高净值</p>
                </div>
                <div className="h-[2px] w-12 bg-blue-300" />
                <div className="w-60 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                  <p className="text-xs font-bold text-emerald-600">条件</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">7天未跟进</p>
                </div>
                <div className="h-[2px] w-12 bg-blue-300" />
                <div className="w-64 p-4 rounded-xl border border-orange-200 bg-orange-50">
                  <p className="text-xs font-bold text-orange-600">动作</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">自动分配线索 + 发送提醒</p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500">策略ID</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{strategy?.id || 'POLICY-NA'}</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500">命中客户</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{strategy?.matchedCustomers || 0} 人</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500">执行成功率</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-600">{strategy?.successRate || 0}%</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="h-12 px-4 border-b border-gray-100 bg-gray-50 flex items-center">
              <span className="text-sm font-semibold text-gray-700">规则属性</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500">策略名称</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{strategy?.name || '未选择策略'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">优先级</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{strategy?.priority || 'P1'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">执行频率</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{strategy?.frequency || '每1小时'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">最近执行</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {strategy?.lastExecutedAt ? String(strategy.lastExecutedAt).slice(0, 16).replace('T', ' ') : '-'}
                </p>
              </div>
              <button className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-bold">{ACTION_COPY.saveDraft}</button>
            </div>
          </aside>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="h-12 px-4 border-b border-gray-100 bg-gray-50 flex items-center">
            <span className="text-sm font-semibold text-gray-700">执行日志</span>
          </div>
          <div className="p-4">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="py-2">时间</th>
                  <th className="py-2">目标客户</th>
                  <th className="py-2">执行动作</th>
                  <th className="py-2">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                <tr>
                  <td className="py-3">2026-02-25 10:32:10</td>
                  <td className="py-3">C-10982</td>
                  <td className="py-3">分配给业务员 A12</td>
                  <td className="py-3 text-emerald-600 font-semibold">成功</td>
                </tr>
                <tr>
                  <td className="py-3">2026-02-25 10:31:42</td>
                  <td className="py-3">C-10711</td>
                  <td className="py-3">发送跟进提醒</td>
                  <td className="py-3 text-emerald-600 font-semibold">成功</td>
                </tr>
                <tr>
                  <td className="py-3">2026-02-25 10:30:58</td>
                  <td className="py-3">C-10267</td>
                  <td className="py-3">分配给业务员 B03</td>
                  <td className="py-3 text-orange-600 font-semibold">重试中</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </div>
);

const EMPTY_CARDS: Record<PMetricEnd, PMetricCard[]> = {
  c: [],
  b: [],
  p: [],
  system: [],
};

type MetricRuleForm = {
  end: PMetricEnd;
  name: string;
  formula: string;
  period: string;
  source: string;
  status: 'enabled' | 'disabled';
  threshold: string;
  remark: string;
};

const METRIC_REMARK_TEMPLATES: Record<string, (period: string) => string> = {
  'c:C端日活 (DAU)': (period) =>
    `数据表: c_sign_ins + c_activity_completions + c_learning_records + c_point_transactions + c_redeem_records + p_track_events
时间窗口: ${period}（按自然日 00:00:00-23:59:59）
计算方式: 去重客户数 = COUNT(DISTINCT customer_id / user_id / actor_id)
过滤条件: 仅统计有效行为事件（含签到、活动完成、学习完成、积分变动、兑换、C端行为事件）`,
  'c:人均停留时长': (period) =>
    `数据表: p_track_events
时间窗口: ${period}
计算方式: 人均停留时长 = SUM(properties.durationMs)/1000/60 ÷ COUNT(DISTINCT actor_id)
过滤条件: source='c-web' 或 actor_type='customer'`,
  'c:内容打开率': (period) =>
    `数据表: p_track_events
时间窗口: ${period}
计算方式: 内容打开率 = 打开人数 ÷ 触达人数 × 100%
事件口径: 打开类事件(open/view/detail/click)；触达类事件(push/send/exposure/impression/reach)`,
  'c:签到率': (period) =>
    `数据表: c_sign_ins + c_sign_ins（活跃口径依赖C端日活）
时间窗口: ${period}
计算方式: 签到率 = 当日签到去重客户数 ÷ 当日活跃去重客户数 × 100%`,
  'c:30天登录次数(C端)': () =>
    `数据表: p_sessions
时间窗口: 最近30天（滚动）
计算方式: 单客30天登录次数(C端) = COUNT(DISTINCT login_date)
口径补充: 以SQL按日去重聚合结果为准；同一客户同一天最多计1次`,
  'c:30天签到次数(C端)': () =>
    `数据表: c_sign_ins
时间窗口: 最近30天（滚动）
计算方式: 单客30天签到次数(C端) = COUNT(DISTINCT sign_date)
口径补充: 以SQL按日去重聚合结果为准；同一客户同一天最多计1次`,
  'b:30天登录次数(B端)': () =>
    `数据表: p_track_events
时间窗口: 最近30天（滚动）
计算方式: 单客30天登录次数(B端) = COUNT(DISTINCT login_date)
口径补充: 以SQL按日去重聚合结果为准；同一客户同一天最多计1次`,
  'c:单客累计登录天数': (period) =>
    `数据表: p_sessions
时间窗口: ${period}
计算方式: 单客累计登录天数 = 累计登录人天 ÷ 累计登录客户数
口径说明: 登录人天按(customer_id, 登录日期)去重；累计登录客户数为发生过登录的去重客户数`,
  'c:单客累计签到天数': (period) =>
    `数据表: c_sign_ins
时间窗口: ${period}
计算方式: 单客累计签到天数 = 累计签到人天 ÷ 累计签到客户数
口径说明: 签到人天按(customer_id, 签到日期)去重；累计签到客户数为发生过签到的去重客户数`,
  'c:积分兑换率': (period) =>
    `数据表: c_redeem_records + c_point_transactions + point_accounts
时间窗口: ${period}
计算方式: 积分兑换率 = 当期兑换去重客户数 ÷ 有积分余额客户数 × 100%
余额口径: 取point_accounts余额或交易最新balance_after`,
  'c:保单托管率': (period) =>
    `数据表: c_policies + c_customers
时间窗口: ${period}
计算方式: 保单托管率 = 有在保保单客户数 ÷ 客户总数 × 100%
在保条件: status in ('保障中','active','in_force','on')`,
  'b:B端日活 (DAU)': (period) =>
    `数据表: p_track_events
时间窗口: ${period}
计算方式: B端DAU = COUNT(DISTINCT actor_id)
过滤条件: source='b-web' 或 event_name LIKE 'b_%'`,
  'b:客户互动率': (period) =>
    `数据表: b_customer_activities + c_customers
时间窗口: ${period}
计算方式: 客户互动率 = 有互动去重客户数 ÷ 客户总数 × 100%`,
  'b:智能提醒点击率': (period) =>
    `数据表: p_track_events
时间窗口: ${period}
计算方式: 点击率 = remind_click事件数 ÷ remind_push(remind_send/exposure)事件数 × 100%`,
  'b:7日留存率': (period) =>
    `数据表: b_agents + p_track_events
时间窗口: ${period}
计算方式: 7日留存率 = 注册第7天仍活跃业务员数 ÷ 该日注册业务员数 × 100%`,
  'b:内容发布数': (period) =>
    `数据表: p_learning_materials + p_activities
时间窗口: ${period}
计算方式: 内容发布数 = 当期新建记录数（两表合计）`,
  'b:核销单数': (period) =>
    `数据表: b_write_off_records
时间窗口: ${period}
计算方式: 核销单数 = COUNT(*) WHERE status='success'`,
  'p:租户总数': (period) =>
    `数据表: p_tenants
时间窗口: ${period}
计算方式: 租户总数 = COUNT(*) WHERE status <> 'inactive'`,
  'p:活跃租户': (period) =>
    `数据表: p_track_events
时间窗口: ${period}
计算方式: 活跃租户 = COUNT(DISTINCT tenant_id)`,
  'p:本月签单总额': (period) =>
    `数据表: c_policies
时间窗口: ${period}
计算方式: 本月签单总额 = SUM(COALESCE(annual_premium, amount))
过滤条件: created_at 落在当月`,
  'p:人均客户互动数': (period) =>
    `数据表: b_customer_activities
时间窗口: ${period}
计算方式: 人均互动 = 互动总次数 ÷ 活跃业务员数(去重agent_id)`,
  'p:团队业绩排行': (period) =>
    `数据表: c_policies + c_customers + b_agents
时间窗口: ${period}
计算方式: 按team_id汇总SUM(COALESCE(annual_premium, amount))并降序`,
  'p:险种偏好': (period) =>
    `数据表: c_policies
时间窗口: ${period}
计算方式: 险种偏好 = 各policy_type数量占比`,
  'system:今日告警': (period) =>
    `数据表: audit_logs
时间窗口: ${period}
计算方式: 今日告警 = COUNT(*) WHERE result='fail'`,
  'system:API可用性': (period) =>
    `数据表: audit_logs
时间窗口: ${period}
计算方式: API可用性 = success请求数 ÷ 总请求数 × 100%`,
  'system:平均响应时间': (period) =>
    `数据表: p_track_events
时间窗口: ${period}
计算方式: 平均响应时间 = AVG(properties.durationMs / latencyMs / costMs)`,
  'system:服务器负载': (period) =>
    `数据来源: Node runtime (os.loadavg / cpu_count)
时间窗口: ${period}
计算方式: 负载率 = loadavg(1m) ÷ CPU核数 × 100%`,
  'system:数据库连接数': (period) =>
    `数据表: p_sessions（会话口径）/ DB监控
时间窗口: ${period}
计算方式: 数据库连接数（当前）≈ 未过期会话数`,
  'system:错误率': (period) =>
    `数据表: audit_logs
时间窗口: ${period}
计算方式: 错误率 = fail请求数 ÷ 总请求数 × 100%`,
};

function inferTablesBySource(source: string): string[] {
  const s = String(source || '').toLowerCase();
  const tableMap = [
    { keys: ['登录', 'login'], tables: ['p_sessions', 'p_track_events'] },
    { keys: ['签到', 'sign'], tables: ['c_sign_ins'] },
    { keys: ['兑换', 'redeem', '核销', 'writeoff'], tables: ['c_redeem_records', 'b_write_off_records'] },
    { keys: ['保单', 'policy'], tables: ['c_policies'] },
    { keys: ['活动', 'activity'], tables: ['p_activities', 'b_customer_activities', 'c_activity_completions'] },
    { keys: ['学习', 'learning', '内容'], tables: ['p_learning_materials', 'c_learning_records'] },
    { keys: ['行为', '埋点', 'track', 'event'], tables: ['p_track_events'] },
    { keys: ['积分', 'point'], tables: ['c_point_transactions', 'point_accounts'] },
    { keys: ['租户', 'tenant'], tables: ['p_tenants'] },
    { keys: ['告警', '监控', 'audit'], tables: ['audit_logs', 'p_track_events'] },
  ];
  for (const item of tableMap) {
    if (item.keys.some((k) => s.includes(String(k).toLowerCase()))) return item.tables;
  }
  return ['p_track_events'];
}

function buildMetricRemarkDraft(form: Pick<MetricRuleForm, 'end' | 'name' | 'formula' | 'period' | 'source'>): string {
  const key = `${form.end}:${form.name || ''}`;
  const exactTemplate = METRIC_REMARK_TEMPLATES[key];
  if (exactTemplate) return exactTemplate(form.period || '每日');

  const tables = inferTablesBySource(form.source || '');
  return `数据表: ${tables.join(' + ')}
时间窗口: ${form.period || '每日'}
计算方式: ${form.formula || '请填写公式'}
口径补充: 指标名=${form.name || '-'}；来源=${form.source || '-'}`;
}

const emptyMetricForm = (end: PMetricEnd): MetricRuleForm => ({
  end,
  name: '',
  formula: '',
  period: '每日',
  source: '',
  status: 'enabled',
  threshold: '',
  remark: '',
});

type PointsRuleFieldKey = 'signInPoints' | 'newCustomerVerifyPoints' | 'customerShareIdentifyPoints';

const DEFAULT_POINTS_RULE_FORM: Record<PointsRuleFieldKey, string> = {
  signInPoints: '10',
  newCustomerVerifyPoints: '200',
  customerShareIdentifyPoints: '0',
};

const POINTS_RULE_TABLE_ROWS: Array<{
  key: PointsRuleFieldKey;
  order: number;
  name: string;
  condition: string;
  defaultValue: string;
}> = [
  {
    key: 'signInPoints',
    order: 10,
    name: '每日签到奖励',
    condition: '客户每天签到成功 1 次后发放，实时按当前租户规则生效。',
    defaultValue: DEFAULT_POINTS_RULE_FORM.signInPoints,
  },
  {
    key: 'newCustomerVerifyPoints',
    order: 20,
    name: '新客户实名奖励',
    condition: '新客户首次完成实名时发放，同一客户不会重复到账。',
    defaultValue: DEFAULT_POINTS_RULE_FORM.newCustomerVerifyPoints,
  },
  {
    key: 'customerShareIdentifyPoints',
    order: 30,
    name: '客户分享实名奖励',
    condition: '客户分享 H5 链接后，其他客户因该分享首次完成实名时发放给分享人。',
    defaultValue: DEFAULT_POINTS_RULE_FORM.customerShareIdentifyPoints,
  },
];

const PointsRuleConfigPage = ({
  session,
  tenants,
}: {
  session: PLoginSession | null;
  tenants: PTenant[];
}) => {
  const [config, setConfig] = useState<PPointsRuleConfig | null>(null);
  const [form, setForm] = useState<Record<PointsRuleFieldKey, string>>({ ...DEFAULT_POINTS_RULE_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingRuleKey, setEditingRuleKey] = useState<PointsRuleFieldKey | null>(null);
  const isPlatformAdmin = String(session?.role || '') === 'platform_admin';
  const defaultTenantId = Number(session?.tenantId || 1);
  const [targetTenantId, setTargetTenantId] = useState<number>(defaultTenantId);
  const targetTenant = tenants.find((item) => Number(item.id) === Number(targetTenantId)) || null;

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await pApi.pointsRuleConfig(targetTenantId);
      const next = res?.config || {
        tenantId: targetTenantId,
        signInPoints: Number(DEFAULT_POINTS_RULE_FORM.signInPoints),
        newCustomerVerifyPoints: Number(DEFAULT_POINTS_RULE_FORM.newCustomerVerifyPoints),
        customerShareIdentifyPoints: Number(DEFAULT_POINTS_RULE_FORM.customerShareIdentifyPoints),
      };
      setConfig(next);
      setForm({
        signInPoints: String(Number(next.signInPoints || 0)),
        newCustomerVerifyPoints: String(Number(next.newCustomerVerifyPoints || 0)),
        customerShareIdentifyPoints: String(Number(next.customerShareIdentifyPoints || 0)),
      });
    } catch (err: any) {
      setError(err?.message || '积分规则加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, [targetTenantId]);

  useEffect(() => {
    if (!isPlatformAdmin) {
      setTargetTenantId(defaultTenantId);
      return;
    }
    if (!tenants.length) {
      setTargetTenantId(defaultTenantId);
      return;
    }
    if (tenants.some((item) => Number(item.id) === Number(targetTenantId))) return;
    const preferred = tenants.find((item) => Number(item.id) === Number(defaultTenantId)) || tenants[0];
    setTargetTenantId(Number(preferred?.id || defaultTenantId || 1));
  }, [defaultTenantId, isPlatformAdmin, targetTenantId, tenants]);

  const parsePointsValue = (key: PointsRuleFieldKey) => {
    const value = Number(form[key]);
    if (!Number.isFinite(value) || value < 0) return Number.NaN;
    return Math.floor(value);
  };

  const validateForm = () => {
    const labels: Record<PointsRuleFieldKey, string> = {
      signInPoints: '签到积分',
      newCustomerVerifyPoints: '新客户实名积分',
      customerShareIdentifyPoints: '分享实名积分',
    };
    for (const row of POINTS_RULE_TABLE_ROWS) {
      if (!Number.isFinite(parsePointsValue(row.key))) {
        window.alert(`${labels[row.key]}必须是大于等于0的整数`);
        return false;
      }
    }
    return true;
  };

  const saveConfig = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const res = await pApi.savePointsRuleConfig({
        tenantId: targetTenantId,
        signInPoints: parsePointsValue('signInPoints'),
        newCustomerVerifyPoints: parsePointsValue('newCustomerVerifyPoints'),
        customerShareIdentifyPoints: parsePointsValue('customerShareIdentifyPoints'),
      });
      setConfig(res.config);
      setForm({
        signInPoints: String(Number(res.config.signInPoints || 0)),
        newCustomerVerifyPoints: String(Number(res.config.newCustomerVerifyPoints || 0)),
        customerShareIdentifyPoints: String(Number(res.config.customerShareIdentifyPoints || 0)),
      });
    } catch (err: any) {
      showApiError(err, '积分规则保存失败');
    } finally {
      setSaving(false);
    }
  };

  const saveRule = async (key: PointsRuleFieldKey) => {
    if (!Number.isFinite(parsePointsValue(key))) {
      const labels: Record<PointsRuleFieldKey, string> = {
        signInPoints: '签到积分',
        newCustomerVerifyPoints: '新客户实名积分',
        customerShareIdentifyPoints: '分享实名积分',
      };
      window.alert(`${labels[key]}必须是大于等于0的整数`);
      return;
    }
    await saveConfig();
    setEditingRuleKey(null);
  };

  const deleteRule = async (key: PointsRuleFieldKey) => {
    const row = POINTS_RULE_TABLE_ROWS.find((item) => item.key === key);
    const confirmed = window.confirm(`确认删除“${row?.name || '该规则'}”吗？删除后会把积分改为 0 并立即生效。`);
    if (!confirmed) return;
    const previous = form[key];
    const nextForm = { ...form, [key]: '0' };
    setForm(nextForm);
    try {
      setSaving(true);
      const res = await pApi.savePointsRuleConfig({
        tenantId: targetTenantId,
        signInPoints: Math.max(0, Math.floor(Number(nextForm.signInPoints || 0))),
        newCustomerVerifyPoints: Math.max(0, Math.floor(Number(nextForm.newCustomerVerifyPoints || 0))),
        customerShareIdentifyPoints: Math.max(0, Math.floor(Number(nextForm.customerShareIdentifyPoints || 0))),
      });
      setConfig(res.config);
      setForm({
        signInPoints: String(Number(res.config.signInPoints || 0)),
        newCustomerVerifyPoints: String(Number(res.config.newCustomerVerifyPoints || 0)),
        customerShareIdentifyPoints: String(Number(res.config.customerShareIdentifyPoints || 0)),
      });
      if (editingRuleKey === key) setEditingRuleKey(null);
    } catch (err: any) {
      setForm((prev) => ({ ...prev, [key]: previous }));
      showApiError(err, '积分规则删除失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">内容与营销 / 积分规则</p>
          <h2 className="text-xl font-bold text-gray-900">积分规则</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadConfig()}
            className="px-4 h-10 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700"
          >
            {ACTION_COPY.refresh}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1180px] mx-auto space-y-6">
          <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold tracking-[0.24em] text-blue-500 uppercase">Points Rules</p>
                <h3 className="mt-2 text-2xl font-black text-gray-900">租户级积分领取规则</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  当前配置会直接影响 C 端真实奖励发放，包括每日签到、新客户实名，以及客户分享 H5 带来的实名奖励。
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-500">当前作用范围</p>
                <p className="mt-2 text-lg font-black text-gray-900">{targetTenant?.name || '当前租户'}</p>
                <p className="mt-1 text-xs text-gray-500">租户ID {Number(config?.tenantId || targetTenantId || 1)}</p>
                {isPlatformAdmin ? (
                  <div className="mt-3 min-w-[220px]">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">目标租户</label>
                    <select
                      value={String(targetTenantId || 1)}
                      onChange={(event) => setTargetTenantId(Number(event.target.value || 1))}
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-blue-400"
                    >
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} (ID {tenant.id})
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-[11px] leading-5 text-amber-700">
                      平台管理员保存时，只会更新当前选中的租户，不会同步修改其他公司。
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">加载中...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
          ) : (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[1060px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">展示排序</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">规则名称</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">奖励积分</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">触发条件</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">状态</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">更新时间</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {POINTS_RULE_TABLE_ROWS.map((row) => {
                        const currentValue = Number(form[row.key] || 0);
                        const enabled = currentValue > 0;
                        const isEditing = editingRuleKey === row.key;
                        return (
                          <tr key={row.key} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="inline-flex h-9 min-w-[48px] items-center justify-center rounded-lg bg-gray-100 px-3 text-sm font-bold text-gray-700">
                                {row.order}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="max-w-[220px]">
                                <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                                <p className="mt-2 text-xs text-gray-500">默认值 {row.defaultValue} 积分</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={form[row.key]}
                                  onChange={(event) => setForm((prev) => ({ ...prev, [row.key]: event.target.value }))}
                                  disabled={!isEditing || saving}
                                  className={`h-11 w-28 rounded-xl border px-4 text-sm font-semibold outline-none ${
                                    isEditing
                                      ? 'border-gray-200 bg-white text-blue-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                                      : 'border-gray-100 bg-gray-50 text-gray-500'
                                  } disabled:cursor-not-allowed`}
                                />
                                <span className="text-sm font-semibold text-gray-500">积分</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-[360px] text-sm leading-6 text-gray-600">{row.condition}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                }`}
                              >
                                {enabled ? '进行中' : '已暂停'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {config?.updatedAt ? String(config.updatedAt).slice(0, 16).replace('T', ' ') : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-3 text-sm font-bold">
                                <button
                                  onClick={() => {
                                    if (isEditing) {
                                      void saveRule(row.key);
                                      return;
                                    }
                                    setEditingRuleKey(row.key);
                                  }}
                                  disabled={saving}
                                  className="text-blue-600 disabled:opacity-60 hover:text-blue-700"
                                >
                                  {isEditing ? (saving ? '保存中...' : '保存') : '编辑'}
                                </button>
                                <button
                                  onClick={() => void deleteRule(row.key)}
                                  disabled={saving}
                                  className="text-red-500 disabled:opacity-60 hover:text-red-600"
                                >
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6">
                <h4 className="text-base font-black text-gray-900">生效说明</h4>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-bold tracking-[0.16em] text-gray-400 uppercase">规则一</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">签到奖励实时读取</p>
                    <p className="mt-1 text-sm text-gray-600">客户下一次签到时，直接按当前配置发放积分。</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-bold tracking-[0.16em] text-gray-400 uppercase">规则二</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">实名奖励只发一次</p>
                    <p className="mt-1 text-sm text-gray-600">只有首次创建的新客户在实名成功时发放，不会因重复实名再次发放。</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-bold tracking-[0.16em] text-gray-400 uppercase">规则三</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">分享实名奖励只认首次</p>
                    <p className="mt-1 text-sm text-gray-600">只有其他客户因该分享首次完成实名时，才会把积分发给分享人。</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-600">所有规则都支持配置为 0，表示保留流程但暂不发放对应积分。</p>
                <p className="mt-4 text-xs text-gray-500">
                  最近更新时间：{config?.updatedAt ? String(config.updatedAt).slice(0, 19).replace('T', ' ') : '未保存过自定义配置'}
                </p>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

const MetricConfigPage = () => {
  const [activeEnd, setActiveEnd] = useState<PMetricEnd>('b');
  const [cardsByEnd, setCardsByEnd] = useState<Record<PMetricEnd, PMetricCard[]>>(EMPTY_CARDS);
  const [rules, setRules] = useState<PMetricRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [form, setForm] = useState<MetricRuleForm>(emptyMetricForm('b'));
  const [remarkSyncEnabled, setRemarkSyncEnabled] = useState(true);

  const updateMetricForm = (patch: Partial<MetricRuleForm>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (remarkSyncEnabled && !Object.prototype.hasOwnProperty.call(patch, 'remark')) {
        next.remark = buildMetricRemarkDraft(next);
      }
      return next;
    });
  };

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await pApi.metricsConfig();
      setCardsByEnd({
        c: Array.isArray(res.cardsByEnd?.c) ? res.cardsByEnd.c : [],
        b: Array.isArray(res.cardsByEnd?.b) ? res.cardsByEnd.b : [],
        p: Array.isArray(res.cardsByEnd?.p) ? res.cardsByEnd.p : [],
        system: Array.isArray(res.cardsByEnd?.system) ? res.cardsByEnd.system : [],
      });
      setRules(Array.isArray(res.rules) ? res.rules : []);
    } catch (err: any) {
      setError(err?.message || ERROR_COPY.metricConfigLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    const next = emptyMetricForm(activeEnd);
    next.remark = buildMetricRemarkDraft(next);
    setForm(next);
    setRemarkSyncEnabled(true);
    setDrawerOpen(true);
  };

  const openEdit = (row: PMetricRule) => {
    setEditingId(Number(row.id));
    const isManualRemark = String(row.remarkMode || '').toLowerCase() === 'manual';
    const next: MetricRuleForm = {
      end: row.end,
      name: row.name || '',
      formula: row.formula || '',
      period: row.period || '每日',
      source: row.source || '',
      status: row.status === 'disabled' ? 'disabled' : 'enabled',
      threshold: row.threshold || '',
      remark: isManualRemark ? String(row.remark || '') : '',
    };
    if (!isManualRemark) {
      next.remark = buildMetricRemarkDraft(next);
    }
    setRemarkSyncEnabled(!isManualRemark);
    setForm(next);
    setDrawerOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.formula.trim() || !form.period.trim() || !form.source.trim()) {
      window.alert(VALIDATION_COPY.metricRuleRequiredFields);
      return;
    }
    const payload = {
      ...form,
      remark: form.remark.trim() || buildMetricRemarkDraft(form),
      remarkMode: remarkSyncEnabled ? 'sync' : 'manual',
    };
    setSaving(true);
    try {
      if (editingId) {
        const res = await pApi.updateMetricRule(editingId, payload);
        setRules((prev) => prev.map((row) => (Number(row.id) === Number(editingId) ? { ...row, ...res.rule } : row)));
      } else {
        const res = await pApi.createMetricRule(payload);
        setRules((prev) => [res.rule, ...prev]);
      }
      setDrawerOpen(false);
    } catch (err: any) {
      showApiError(err, ERROR_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (id: number) => {
    try {
      await pApi.deleteMetricRule(id);
      await loadConfig();
    } catch (err: any) {
      setError(err?.message || ERROR_COPY.metricRuleDeleteFailed);
    }
  };

  const filteredRules = rules.filter((row) => row.end === activeEnd);
  const cards = cardsByEnd[activeEnd] || [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">营销策略 / 指标配置</p>
          <h2 className="text-xl font-bold text-gray-900">指标配置</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void loadConfig()} className="px-4 h-10 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700">
            {ACTION_COPY.refresh}
          </button>
          <button onClick={openCreate} className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-bold">
            新增指标规则
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1280px] mx-auto space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-2 inline-flex gap-2">
            {METRIC_END_OPTIONS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveEnd(item.key)}
                className={`px-4 h-9 rounded-lg text-sm font-semibold ${
                  activeEnd === item.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    activeEnd === item.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {cardsByEnd[item.key]?.length || 0}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">加载中...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
          ) : (
            <>
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cards.map((card) => (
                  <div key={card.key} className="rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-sm text-gray-500">{card.name}</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{card.value}</p>
                    <p
                      className={`mt-1 text-xs font-semibold ${
                        card.trendType === 'down'
                          ? 'text-red-500'
                          : card.trendType === 'flat'
                            ? 'text-gray-500'
                            : 'text-emerald-600'
                      }`}
                    >
                      {card.trend || '-'}
                    </p>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="h-12 px-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">指标规则库</h3>
                  <span className="text-xs text-gray-500">当前端：{METRIC_END_OPTIONS.find((x) => x.key === activeEnd)?.label}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[980px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">指标名称</th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">口径/公式</th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">统计周期</th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">数据源</th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">状态</th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">更新时间</th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRules.length === 0 ? (
                        <tr>
                          <td className="px-5 py-8 text-sm text-gray-400" colSpan={7}>
                            暂无规则
                          </td>
                        </tr>
                      ) : (
                        filteredRules.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-5 py-4 text-sm font-semibold text-gray-900">{row.name}</td>
                            <td className="px-5 py-4 text-sm text-gray-700">{row.formula}</td>
                            <td className="px-5 py-4 text-sm text-gray-700">{row.period}</td>
                            <td className="px-5 py-4 text-sm text-gray-700">{row.source}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${enabledStatusPillClass(row.status)}`}>
                                {enabledRuntimeStatusLabel(row.status)}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-500">{String(row.updatedAt || '').slice(0, 19).replace('T', ' ') || '-'}</td>
                            <td className="px-5 py-4 text-right">
                              <button onClick={() => openEdit(row)} className="text-blue-600 text-sm font-bold">
                                编辑
                              </button>
                              <button onClick={() => setDeletingRuleId(row.id)} className="ml-3 text-red-600 text-sm font-bold">
                                删除
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex justify-end">
          <form onSubmit={onSubmit} className="w-full max-w-[520px] h-full bg-white shadow-xl border-l border-gray-200 flex flex-col">
            <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? '编辑指标规则' : '新增指标规则'}</h3>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <label className="block">
                <span className="text-xs text-gray-500">所属端</span>
                <select
                  value={form.end}
                  onChange={(e) => updateMetricForm({ end: e.target.value as PMetricEnd })}
                  className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                >
                  {METRIC_END_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">指标名称</span>
                <input
                  value={form.name}
                  onChange={(e) => updateMetricForm({ name: e.target.value })}
                  className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">口径/公式</span>
                <textarea
                  value={form.formula}
                  onChange={(e) => updateMetricForm({ formula: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs text-gray-500">统计周期</span>
                  <select
                    value={form.period}
                    onChange={(e) => updateMetricForm({ period: e.target.value })}
                    className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                  >
                    {METRIC_PERIOD_OPTIONS.map((period) => (
                      <option key={period} value={period}>
                        {period}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">状态</span>
                  <select
                    value={form.status}
                    onChange={(e) => updateMetricForm({ status: e.target.value as 'enabled' | 'disabled' })}
                    className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                  >
                    {ENABLED_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-gray-500">数据源</span>
                <input
                  value={form.source}
                  onChange={(e) => updateMetricForm({ source: e.target.value })}
                  className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">阈值规则（可选）</span>
                <input
                  value={form.threshold}
                  onChange={(e) => updateMetricForm({ threshold: e.target.value })}
                  className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">备注（同步指标口径）</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (remarkSyncEnabled) {
                        setRemarkSyncEnabled(false);
                        return;
                      }
                      setForm((prev) => ({ ...prev, remark: buildMetricRemarkDraft(prev) }));
                      setRemarkSyncEnabled(true);
                    }}
                    className="text-xs text-blue-600 font-semibold hover:text-blue-700"
                  >
                    {remarkSyncEnabled ? '改为手动备注' : '恢复同步口径'}
                  </button>
                </div>
                <textarea
                  value={form.remark}
                  onChange={(e) => {
                    setRemarkSyncEnabled(false);
                    setForm((prev) => ({ ...prev, remark: e.target.value }));
                  }}
                  rows={5}
                  placeholder="默认同步数据表、统计窗口和计算方式。"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {remarkSyncEnabled ? '当前为同步模式：修改指标口径会自动更新备注。' : '当前为手动模式：备注不再跟随口径变化。'}
                </p>
              </label>
            </div>
            <div className="h-16 px-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700"
              >
                取消
              </button>
              <button type="submit" disabled={saving} className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deletingRuleId)}
        title="删除指标规则"
        message="确认删除该指标规则？"
        onCancel={() => setDeletingRuleId(null)}
        onConfirm={() => {
          if (!deletingRuleId) return;
          void (async () => {
            await removeRule(deletingRuleId);
            setDeletingRuleId(null);
          })();
        }}
      />
    </div>
  );
};

const MonitorScreenPage = () => (
  <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center">
      <h2 className="text-xl font-bold text-gray-900">平台监控大屏</h2>
    </header>
    <main className="flex-1 overflow-auto p-8 grid grid-cols-1 md:grid-cols-4 gap-6">
      {[
        ['在线租户', '42'],
        ['今日请求量', '128,330'],
        ['错误率', '0.12%'],
        ['平均响应', '83ms'],
      ].map(([k, v]) => (
        <div key={k} className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500">{k}</p>
          <p className="text-3xl font-black text-gray-900 mt-2">{v}</p>
        </div>
      ))}
    </main>
  </div>
);

const FinanceReconcilePage = ({
  reports,
  onRun,
}: {
  reports: PReconciliationReport[];
  onRun: () => Promise<void>;
}) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
    <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <h2 className="text-xl font-bold text-gray-900">财务对账</h2>
      <button onClick={() => void onRun()} className="px-4 h-10 rounded-lg bg-blue-600 text-white text-sm font-bold">发起对账</button>
    </header>
    <main className="flex-1 overflow-auto p-8">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">批次号</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">日期</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">差异金额</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(reports.length
              ? reports.map((row) => [
                  `RC-${row.day.replaceAll('-', '')}-${String(row.id).padStart(2, '0')}`,
                  row.day,
                  row.status === 'ok' ? '完成' : '存在差异',
                  String(row.mismatches.length),
                ])
              : [['RC-20260225-01', '2026-02-25', '完成', '0']]).map((r) => (
              <tr key={r[0] as string}>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{r[0]}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{r[1]}</td>
                <td className={`px-6 py-4 text-sm font-semibold ${(r[2] as string) === '完成' ? 'text-emerald-600' : 'text-orange-600'}`}>{r[2]}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  </div>
);

const StatsDashboardPage = ({
  statsRole,
  setStatsRole,
  tenants,
  stats,
  activityEffect,
  onRebuild,
}: {
  statsRole: 'platform' | 'company' | 'staff';
  setStatsRole: (role: 'platform' | 'company' | 'staff') => void;
  tenants: PTenant[];
  stats: PStatsOverview | null;
  activityEffect: PActivityEffectOverview | null;
  onRebuild: () => Promise<void>;
}) => {
  const latest = stats?.latest?.metrics || {};
  const customers = Number(latest.customers || 0);
  const activeCustomers = Number(latest.activeCustomers || 0);
  const paidOrders = Number(latest.paidOrders || 0);
  const totalPoints = Number(latest.totalPoints || 0);
  const activeRate = customers > 0 ? Math.round((activeCustomers / customers) * 100) : 0;
  const orderPerCustomerRate = customers > 0 ? Math.min(100, Math.round((paidOrders / customers) * 100)) : 0;
  const orderPerActiveCustomerRate = activeCustomers > 0 ? Math.min(100, Math.round((paidOrders / activeCustomers) * 100)) : 0;

  const trendDays = (stats?.history || []).slice(-7).map((d) => d.day.slice(5));
  const trendCustomers = (stats?.history || []).slice(-7).map((d) => Number(d.metrics.activeCustomers || 0));
  const maxTrend = Math.max(...trendCustomers, 1);
  const activityMetrics = activityEffect?.activityEffect || {
    totalActivities: 0,
    totalShares: 0,
    totalViews: 0,
    totalParticipants: 0,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f6f7fb]">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          <h2 className="text-xl font-bold text-gray-900">业绩看板</h2>
          <div className="flex items-center rounded-lg bg-gray-100 p-1">
            <button onClick={() => setStatsRole('platform')} className={`px-4 h-8 rounded-md text-xs font-semibold ${statsRole === 'platform' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>平台管理员</button>
            <button onClick={() => setStatsRole('company')} className={`px-4 h-8 rounded-md text-xs font-semibold ${statsRole === 'company' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>公司管理员</button>
            <button onClick={() => setStatsRole('staff')} className={`px-4 h-8 rounded-md text-xs font-semibold ${statsRole === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>员工</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onRebuild} className="px-4 h-9 rounded-lg bg-blue-600 text-white text-sm font-semibold">{ACTION_COPY.refreshStats}</button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1280px] mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-500 font-semibold">租户总数</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{tenants.length}</p>
              <p className="mt-1 text-xs text-gray-400">最近统计日 {stats?.latest?.day || '-'}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-500 font-semibold">客户总数</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{customers.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-400">活跃客户 {activeCustomers.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-500 font-semibold">支付订单</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{paidOrders.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-400">活跃率 {activeRate}%</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs text-gray-500 font-semibold">累计积分发放</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{totalPoints.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-400">当前视角 {statsRole === 'platform' ? '平台管理员' : statsRole === 'company' ? '公司管理员' : '员工'}</p>
            </div>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">活动效果指标</h3>
                <p className="mt-1 text-xs text-gray-500">当前统计范围：{activityEffect?.scope?.label || '加载中'}</p>
              </div>
              <span className="text-xs text-gray-500">数据来源 /api/p/metrics/activity-effect</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500 font-semibold">活动总数</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{activityMetrics.totalActivities}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500 font-semibold">分享活动总次数</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{activityMetrics.totalShares}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500 font-semibold">查看分享链接次数</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{activityMetrics.totalViews}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500 font-semibold">活动报名人数</p>
                <p className="mt-2 text-3xl font-black text-gray-900">{activityMetrics.totalParticipants}</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">活跃客户趋势（近7天）</h3>
                <span className="text-xs text-gray-500">数据来源 /api/p/stats/overview</span>
              </div>
              <div className="h-52 flex items-end gap-3">
                {trendCustomers.map((v, idx) => (
                  <div key={`${trendDays[idx]}-${idx}`} className="flex-1 flex flex-col items-center justify-end gap-2">
                    <div className="w-full rounded-t-md bg-blue-500/75 hover:bg-blue-600 transition-colors" style={{ height: `${Math.max(12, Math.round((v / maxTrend) * 160))}px` }} />
                    <span className="text-[11px] text-gray-400">{trendDays[idx] || '-'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">实时指标占比</h3>
              <div className="space-y-4">
                {[
                  ['活跃客户率', activeRate],
                  ['支付订单占客户比', orderPerCustomerRate],
                  ['支付订单占活跃客户比', orderPerActiveCustomerRate],
                ].map(([name, p]) => (
                  <div key={String(name)}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{name}</span>
                      <span className="font-semibold text-gray-900">{p}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 h-12 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">团队业绩排行</h3>
              <span className="text-xs text-gray-500">等待真实排行接口</span>
            </div>
            <div className="px-5 py-10 text-sm text-gray-500">
              当前 `/api/p/stats/overview` 还没有返回真实团队业绩排行数据，之前的示例员工和签单金额已经移除。
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

function LearningDetailViewPage({
  onBack,
  onEdit,
  item,
}: {
  onBack: () => void;
  onEdit: () => void;
  item: {
    title: string;
    status?: string;
    points?: number;
    content?: string;
    sourceType?: string;
    coverUrl?: string;
    videoChannelMeta?: {
      finderUserName?: string;
      feedToken?: string;
      feedId?: string;
      nonceId?: string;
      miniProgramAppId?: string;
      miniProgramPath?: string;
      miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
      coverUrl?: string;
    } | null;
    media?: Array<{ name?: string; type?: string; preview?: string }>;
    createdAt?: string;
    tags?: string[];
    image?: string;
  } | null;
}) {
  const title = item?.title || '未找到知识资料';
  const statusText = toContentStatusLabel(item?.status || 'draft');
  const statusClass = contentStatusSoftPillClass(item?.status || 'draft');
  const mediaList = Array.isArray(item?.media) ? item!.media! : [];
  const firstMedia = Array.isArray(item?.media) ? item!.media![0] : undefined;
  const sourceType = String(item?.sourceType || 'native');
  const videoChannelMeta = item?.videoChannelMeta || null;
  const launchTarget = resolveVideoChannelLaunchTarget(videoChannelMeta || {});
  const hasActivityLaunchMeta =
    Boolean(String(videoChannelMeta?.finderUserName || '').trim())
    && Boolean(String(videoChannelMeta?.feedId || '').trim());
  const hasProfileLaunchMeta =
    launchTarget === 'profile'
    && Boolean(String(videoChannelMeta?.finderUserName || '').trim());
  const usesEmbedCompatOnly =
    Boolean(String(videoChannelMeta?.feedToken || '').trim())
    && !hasActivityLaunchMeta
    && !hasProfileLaunchMeta;
  const cover = String((firstMedia as any)?.preview || item?.coverUrl || item?.image || videoChannelMeta?.coverUrl || '');
  const detailText = item?.content?.trim() || '暂无资料介绍';
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
            <ArrowLeft size={16} />
            返回知识学习
          </button>
          <h2 className="text-xl font-bold text-gray-900">知识学习详情</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="px-4 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700">编辑资料</button>
          <button className="px-4 h-10 rounded-lg border border-red-200 text-sm font-semibold text-red-600 bg-red-50">{ACTION_COPY.stopPublish}</button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-8">
        {!item ? (
          <div className="max-w-3xl mx-auto rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <h3 className="text-lg font-bold text-gray-900">未找到真实知识资料</h3>
            <p className="mt-2 text-sm text-gray-500">当前详情页只展示真实知识学习数据；如果列表已刷新，请返回列表重新进入。</p>
          </div>
        ) : (
        <div className="max-w-[1220px] mx-auto space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-black text-gray-900">{title}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass}`}>{statusText}</span>
            </div>
            <div className="mt-2 text-sm text-gray-500 flex items-center gap-5">
              <span>创建于: {(item?.createdAt || '').slice(0, 10) || '-'}</span>
              <span>奖励积分: {Number(item?.points || 0)}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">奖励积分</p><p className="mt-2 text-3xl font-black text-gray-900">{Number(item?.points || 0)}</p></div>
            <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">素材数量</p><p className="mt-2 text-3xl font-black text-gray-900">{mediaList.length}</p></div>
            <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-500">内容来源</p><p className="mt-2 text-3xl font-black text-gray-900">{sourceType === 'video_channel' ? (hasProfileLaunchMeta ? '视频号主页' : hasActivityLaunchMeta ? '视频号视频' : usesEmbedCompatOnly ? '内嵌兼容' : '视频号课程') : '站内资料'}</p></div>
          </div>
          {sourceType === 'video_channel' && videoChannelMeta ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex items-center gap-2">
                <PlayCircle size={18} className="text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-900">{hasProfileLaunchMeta ? '视频号主页配置' : hasActivityLaunchMeta ? '视频号跳转配置' : usesEmbedCompatOnly ? '视频号内嵌兼容配置' : '视频号课程配置'}</h4>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-emerald-700/70">跳转类型</p>
                  <p className="mt-1 font-semibold text-emerald-900 break-all">{hasProfileLaunchMeta ? '主页兜底' : hasActivityLaunchMeta ? '单视频跳转' : usesEmbedCompatOnly ? '旧内嵌兼容' : '-'}</p>
                </div>
                <div>
                  <p className="text-emerald-700/70">视频号ID</p>
                  <p className="mt-1 font-semibold text-emerald-900 break-all">{videoChannelMeta.finderUserName || '-'}</p>
                </div>
                {hasProfileLaunchMeta ? null : (
                  <div>
                    <p className="text-emerald-700/70">feedId</p>
                    <p className="mt-1 font-semibold text-emerald-900 break-all">{videoChannelMeta.feedId || '-'}</p>
                  </div>
                )}
                {hasProfileLaunchMeta ? null : (
                  <div>
                    <p className="text-emerald-700/70">nonceId</p>
                    <p className="mt-1 font-semibold text-emerald-900 break-all">{videoChannelMeta.nonceId || '-'}</p>
                  </div>
                )}
                <div>
                  <p className="text-emerald-700/70">小程序AppID</p>
                  <p className="mt-1 font-semibold text-emerald-900 break-all">{videoChannelMeta.miniProgramAppId || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-emerald-700/70">小程序路径</p>
                  <p className="mt-1 font-semibold text-emerald-900 break-all">{videoChannelMeta.miniProgramPath || '-'}</p>
                </div>
                {videoChannelMeta.feedToken ? (
                  <div className="md:col-span-2">
                    <p className="text-emerald-700/70">兼容 feed-token</p>
                    <p className="mt-1 font-semibold text-emerald-900 break-all">{videoChannelMeta.feedToken || '-'}</p>
                  </div>
                ) : null}
              </div>
              {usesEmbedCompatOnly ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
                  当前资料仍是旧的内嵌兼容配置。若要切回跳转承接，请至少补齐 `视频号ID / feedId` 后再保存；`nonceId` 目前按兼容模式允许留空试跳。
                </div>
              ) : null}
            </section>
          ) : null}
          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="h-12 px-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">资料配置预览</h4>
              <button className="text-sm text-blue-600 font-semibold">预览全文</button>
            </div>
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="aspect-video rounded-lg bg-gray-100 border border-gray-200 overflow-hidden">
                {cover ? (
                  <img src={cover} alt="知识学习封面" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">未上传封面</div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">资料简介</p>
                  <p className="mt-2 text-sm text-gray-700 leading-7 whitespace-pre-wrap">{detailText}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(item?.tags?.length ? item.tags : []).map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">#{tag}</span>
                  ))}
                  {mediaList.slice(0, 2).map((m, idx) => (
                    <span key={`${m.name || 'm'}-${idx}`} className="px-3 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-600">
                      {m.name || '素材'}
                    </span>
                  ))}
                  {!item?.tags?.length && !mediaList.length ? (
                    <span className="px-3 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-500">未配置标签或素材</span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
        )}
      </main>
    </div>
  );
}

const EVENT_SCHEMA_TEMPLATES: Record<number, Record<string, unknown>> = {
  1001: {
    caliber: '用户完成登录并建立有效会话后记1次；自动登录同样记入。',
    properties: {
      login_method: 'wechat|mobile',
      is_auto_login: 'boolean',
    },
  },
  1002: {
    caliber: '页面加载完成后记1次PV；同一页面重复进入重复计数。',
    properties: {
      page_name: 'string',
      from_page: 'string',
    },
  },
  1003: {
    caliber: '进入课程/文章/活动详情页并渲染成功后记1次。',
    properties: {
      content_id: 'number|string',
      content_type: 'course|article|activity',
      content_name: 'string',
    },
  },
  1004: {
    caliber: 'C端客户分享成功(c_share_success)后记1次；取消分享不计入。',
    properties: {
      content_id: 'number|string',
      actor_side: 'c_customer',
      source: 'c-web',
      event_keys: 'c_share_success',
      share_method: 'web_share|clipboard',
      tab: 'home|activities|learning|profile|mall',
      path: 'string',
      tenant_id: 'number',
    },
  },
  1009: {
    caliber: 'B端分享成功(b_tools_share_success)后记1次；取消分享不计入。',
    properties: {
      content_id: 'number|string',
      actor_side: 'b_customer',
      source: 'b-web',
      event_keys: 'b_tools_share_success',
      share_channel: 'wechat_friend|moments|link',
      share_method: 'system|clipboard|manual',
      kind: 'content|activity|product|mall_activity',
      share_path: 'list|detail',
      tenant_id: 'number',
    },
  },
  1005: {
    caliber: '每日签到接口成功后记1次；重复签到不重复计入成功事件。',
    properties: {
      continuous_days: 'int',
      points_earned: 'int',
    },
  },
  1006: {
    caliber: '兑换订单创建并支付成功后记1次。',
    properties: {
      item_id: 'number|string',
      item_type: 'product|activity',
      points_cost: 'int',
    },
  },
  1007: {
    caliber: '学习进度达到100%且发放积分成功后记1次。',
    properties: {
      content_id: 'number|string',
      study_duration_sec: 'int',
      points_earned: 'int',
    },
  },
  1008: {
    caliber: '活动参与成功并确认有效参与后记1次。',
    properties: {
      activity_id: 'number|string',
      activity_type: 'task|competition|invite|sign',
    },
  },
};

function eventSchemaTemplate(eventId: number): Record<string, unknown> {
  return EVENT_SCHEMA_TEMPLATES[eventId] ? JSON.parse(JSON.stringify(EVENT_SCHEMA_TEMPLATES[eventId])) : {};
}

function EventManagementPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled' | 'draft'>('all');
  const [items, setItems] = useState<PEventDefinition[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editing, setEditing] = useState<PEventDefinition | null>(null);
  const [deletingItem, setDeletingItem] = useState<PEventDefinition | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    eventId: '',
    eventName: '',
    eventType: 'custom' as 'system' | 'custom',
    description: '',
    collectMethod: 'frontend' as 'frontend' | 'backend' | 'both',
    status: 'enabled' as 'enabled' | 'disabled' | 'draft',
    schemaText: JSON.stringify(eventSchemaTemplate(1005), null, 2),
  });

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await pApi.eventDefinitions({
        query: query.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: 1,
        pageSize: 50,
      });
      setItems(res.list || []);
      setTotal(Number(res.total || 0));
    } catch (e: any) {
      showApiError(e, ERROR_COPY.eventDefinitionLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList().catch(() => undefined);
  }, [statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setForm({
      eventId: '',
      eventName: '',
      eventType: 'custom',
      description: '',
      collectMethod: 'frontend',
      status: 'enabled',
      schemaText: JSON.stringify(eventSchemaTemplate(1005), null, 2),
    });
    setShowDrawer(true);
  };

  const openEdit = (row: PEventDefinition) => {
    setEditing(row);
    setFormError('');
    setForm({
      eventId: String(row.eventId || ''),
      eventName: String(row.eventName || ''),
      eventType: row.eventType === 'system' ? 'system' : 'custom',
      description: String(row.description || ''),
      collectMethod: row.collectMethod === 'backend' || row.collectMethod === 'both' ? row.collectMethod : 'frontend',
      status: row.status === 'disabled' || row.status === 'draft' ? row.status : 'enabled',
      schemaText: JSON.stringify(row.schema && Object.keys(row.schema).length ? row.schema : eventSchemaTemplate(Number(row.eventId || 0)), null, 2),
    });
    setShowDrawer(true);
  };

  useEffect(() => {
    if (!showDrawer) return;
    const id = Number(form.eventId || 0);
    if (!id) return;
    const tpl = eventSchemaTemplate(id);
    if (!Object.keys(tpl).length) return;
    setForm((prev) => ({ ...prev, schemaText: JSON.stringify(tpl, null, 2) }));
  }, [form.eventId, showDrawer]);

  const save = async () => {
    const eventId = Number(form.eventId);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      setFormError(VALIDATION_COPY.eventIdPositiveInteger);
      return;
    }
    if (!form.eventName.trim()) {
      setFormError(VALIDATION_COPY.eventNameRequired);
      return;
    }
    let parsedSchema: Record<string, unknown> = {};
    try {
      parsedSchema = form.schemaText.trim() ? JSON.parse(form.schemaText) : {};
    } catch {
      setFormError(VALIDATION_COPY.eventSchemaInvalidJson);
      return;
    }
    try {
      await pApi.saveEventDefinition({
        id: editing?.id,
        eventId,
        eventName: form.eventName.trim(),
        eventType: form.eventType,
        description: form.description.trim(),
        collectMethod: form.collectMethod,
        status: form.status,
        schema: parsedSchema,
        syncSchemaWithEvent: true,
      });
      setShowDrawer(false);
      await loadList();
    } catch (e: any) {
      setFormError(e?.message || ERROR_COPY.saveFailed);
    }
  };

  const setStatus = async (id: number, status: 'enabled' | 'disabled' | 'draft') => {
    try {
      await pApi.setEventDefinitionStatus(id, status);
      await loadList();
    } catch (e: any) {
      showApiError(e, ERROR_COPY.statusUpdateFailed);
    }
  };

  const removeItem = async (row: PEventDefinition) => {
    try {
      await pApi.deleteEventDefinition(row.id);
      await loadList();
    } catch (e: any) {
      showApiError(e, ERROR_COPY.deleteFailed);
    }
  };

  const filteredItems = query.trim()
    ? items.filter((row) => String(row.eventName || '').includes(query.trim()) || String(row.eventId || '').includes(query.trim()))
    : items;

  return (
    <div className="flex-1 bg-gray-100 p-6 overflow-y-auto relative">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white text-base font-bold">保</div>
            <h1 className="text-2xl font-bold text-gray-900">事件定义管理</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm">新华保险 · 华东区</span>
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold">管</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索事件名称或ID"
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg w-64 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
            >
              {ENABLED_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button onClick={() => loadList()} className="px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 inline-flex items-center gap-1">
              <Filter size={14} />
              {ACTION_COPY.filter}
            </button>
          </div>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
            <Plus size={16} />
            新建事件
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[980px]">
              <thead className="text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="pb-3">事件ID</th>
                  <th className="pb-3">事件名称</th>
                  <th className="pb-3">事件类型</th>
                  <th className="pb-3">描述</th>
                  <th className="pb-3">采集方式</th>
                  <th className="pb-3">状态</th>
                  <th className="pb-3">创建时间</th>
                  <th className="pb-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="py-3 font-mono">{row.eventId}</td>
                    <td className="py-3 font-medium">{row.eventName}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${eventTypePillClass(row.eventType)}`}>{eventTypeLabel(row.eventType)}</span>
                    </td>
                    <td className="py-3 text-gray-600">{row.description || '-'}</td>
                    <td className="py-3">{eventCollectMethodLabel(row.collectMethod)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${enabledStatusPillClass(row.status)}`}>{enabledStatusLabel(row.status)}</span>
                    </td>
                    <td className="py-3 text-gray-500">{String(row.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-3">
                      <button onClick={() => openEdit(row)} className="text-blue-600 hover:underline">编辑</button>
                      {row.eventType === 'system' ? (
                        <button
                          onClick={() => setStatus(row.id, row.status === 'enabled' ? 'disabled' : 'enabled')}
                          className="ml-2 text-red-600 hover:underline"
                        >
                          {enabledToggleActionLabel(row.status)}
                        </button>
                      ) : (
                        <button onClick={() => setDeletingItem(row)} className="ml-2 text-red-600 hover:underline">删除</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredItems.length && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400">{loading ? '加载中...' : '暂无数据'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">共 {total} 条</p>
          </div>
        </div>
      </div>

      {showDrawer && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowDrawer(false)} />
          <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{editing ? '编辑事件定义' : '新建事件定义'}</h3>
                <button onClick={() => setShowDrawer(false)} className="text-gray-400 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">事件ID <span className="text-red-500">*</span></label>
                  <input
                    value={form.eventId}
                    onChange={(e) => setForm((prev) => ({ ...prev, eventId: e.target.value.replace(/[^\d]/g, '') }))}
                    disabled={editing?.eventType === 'system'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    placeholder="例如：1001 或 2001"
                  />
                  <p className="text-xs text-gray-400 mt-1">系统预置建议 1001-1999，自定义可使用 2000+</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">事件名称 <span className="text-red-500">*</span></label>
                  <input
                    value={form.eventName}
                    onChange={(e) => setForm((prev) => ({ ...prev, eventName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="例如：登录"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">事件类型</label>
                  <select
                    value={form.eventType}
                    onChange={(e) => setForm((prev) => ({ ...prev, eventType: e.target.value as 'system' | 'custom' }))}
                    disabled={editing?.eventType === 'system'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  >
                    {EVENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="事件说明"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">采集方式</label>
                  <select
                    value={form.collectMethod}
                    onChange={(e) => setForm((prev) => ({ ...prev, collectMethod: e.target.value as 'frontend' | 'backend' | 'both' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {EVENT_COLLECT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={form.status === 'enabled'} onChange={() => setForm((prev) => ({ ...prev, status: 'enabled' }))} />
                      启用
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={form.status === 'disabled'} onChange={() => setForm((prev) => ({ ...prev, status: 'disabled' }))} />
                      禁用
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={form.status === 'draft'} onChange={() => setForm((prev) => ({ ...prev, status: 'draft' }))} />
                      草稿
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">属性定义 <span className="text-xs text-gray-400">(JSON，含执行口径)</span></label>
                  <textarea
                    rows={5}
                    value={form.schemaText}
                    onChange={(e) => setForm((prev) => ({ ...prev, schemaText: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                  />
                  <p className="text-xs text-gray-400 mt-1">当事件ID变化时，会自动同步对应的执行口径与属性模板。</p>
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={save} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">保存</button>
                  <button onClick={() => setShowDrawer(false)} className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50">取消</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(deletingItem)}
        title="删除事件"
        message={`确认删除事件「${deletingItem?.eventName || ''}」？`}
        onCancel={() => setDeletingItem(null)}
        onConfirm={() => {
          if (!deletingItem) return;
          void (async () => {
            await removeItem(deletingItem);
            setDeletingItem(null);
          })();
        }}
      />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<PLoginSession | null>(() => pApi.getSession());
  const [currentView, setCurrentView] = useState<'login' | 'activity' | 'activity-detail' | 'create' | 'learning' | 'learning-detail' | 'learning-create' | 'shop' | 'shop-add-product' | 'shop-add-activity' | 'shop-product-detail' | 'shop-activity-detail' | 'points-rules' | 'tag-list' | 'tags' | 'event-management' | 'metric-config' | 'strategy' | 'strategy-config' | 'employees' | 'customer-pool' | 'permissions' | 'stats' | 'monitor' | 'finance' | 'tenant-detail' | 'create-tenant' | 'edit-tenant' | 'tenants'>(() => getDefaultPView(session));
  const [selectedActivityId, setSelectedActivityId] = useState('ACT-0001');
  const [selectedLearningId, setSelectedLearningId] = useState<number | null>(null);
  const [selectedMallProductId, setSelectedMallProductId] = useState<number | null>(null);
  const [selectedMallActivityId, setSelectedMallActivityId] = useState<number | null>(null);
  const [statsRole, setStatsRole] = useState<'platform' | 'company' | 'staff'>('platform');
  const [tenants, setTenants] = useState<PTenant[]>([]);
  const [employees, setEmployees] = useState<PEmployee[]>([]);
  const [assignableEmployees, setAssignableEmployees] = useState<PEmployee[]>([]);
  const [teams, setTeams] = useState<PTeam[]>([]);
  const [customers, setCustomers] = useState<PCustomer[]>([]);
  const [mallProducts, setMallProducts] = useState<PMallProduct[]>([]);
  const [mallActivities, setMallActivities] = useState<PMallActivity[]>([]);
  const [liveActivities, setLiveActivities] = useState<PActivity[]>([]);
  const [liveCourses, setLiveCourses] = useState<PLearningCourse[]>([]);
  const [strategies, setStrategies] = useState<PStrategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<PStrategy | null>(null);
  const [reconciliationReports, setReconciliationReports] = useState<PReconciliationReport[]>([]);
  const [stats, setStats] = useState<PStatsOverview | null>(null);
  const [activityEffect, setActivityEffect] = useState<PActivityEffectOverview | null>(null);
  const [permissionsData, setPermissionsData] = useState<PPermissionMatrix | null>(null);
  const [sidebarAllowedViews, setSidebarAllowedViews] = useState<string[] | null>(null);
  const [liveError, setLiveError] = useState('');
  const [movingActivityId, setMovingActivityId] = useState<number | null>(null);
  const [movingLearningId, setMovingLearningId] = useState<number | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [editingLearningId, setEditingLearningId] = useState<number | null>(null);
  const [editingMallProductId, setEditingMallProductId] = useState<number | null>(null);
  const [editingMallActivityId, setEditingMallActivityId] = useState<number | null>(null);
  const [assigningCustomerId, setAssigningCustomerId] = useState<number | null>(null);
  const [selectedAgentByCustomerId, setSelectedAgentByCustomerId] = useState<Record<number, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => Promise<void> | void) | null;
    onCancel: (() => void) | null;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
  });
  const canManageTemplates = Boolean(
    session &&
      (session.role === 'company_admin' ||
        session.role === 'platform_admin' ||
        session.role === 'team_lead' ||
        session.role === 'support' ||
        session.role === 'agent')
  );
  const handleNoTemplatePermission = () => {
    window.alert(NOTICE_COPY.templateCreateRoleRequired);
  };
  const refreshCustomerPoolData = async () => {
    const [customersRes, employeesRes] = await Promise.all([
      pApi.customers(),
      pApi.employees({ scope: 'assignable' }),
    ]);
    setCustomers(customersRes.list || []);
    setAssignableEmployees(employeesRes.list || []);
  };
  const track = (event: string, properties: Record<string, unknown> = {}) => {
    trackEvent({ event, properties }).catch(() => undefined);
  };
  const openConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => Promise<void> | void,
    onCancel?: () => void
  ) => {
    setConfirmDialog({ open: true, title, message, onConfirm, onCancel: onCancel || null });
  };
  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, title: '', message: '', onConfirm: null, onCancel: null });
  };

  useEffect(() => {
    if (!session) return;
    return onAuthInvalid(() => {
      pApi.clearSession();
      setSession(null);
      setCurrentView('login');
      setLiveError('登录已失效，请重新登录');
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let disposed = false;
    (async () => {
      try {
        const roleKey = normalizeEmployeePermissionRole(String(session.role || ''));
        const canLoadAdminResources = roleKey === 'platform_admin' || roleKey === 'company_admin';
        const [tenantRes, statsRes, activityEffectRes, permissionsRes, activitiesRes, coursesRes, employeesRes, customersRes, teamsRes, mallProductsRes, mallActivitiesRes, strategiesRes] = await Promise.allSettled([
          canLoadAdminResources ? pApi.tenants() : Promise.resolve({ list: [] as PTenant[] }),
          canLoadAdminResources ? pApi.stats() : Promise.resolve(null as PStatsOverview | null),
          pApi.activityEffectOverview(),
          canLoadAdminResources ? pApi.permissions() : Promise.resolve(null as PPermissionMatrix | null),
          pApi.activities(),
          pApi.learningCourses(),
          canLoadAdminResources ? pApi.employees() : Promise.resolve({ list: [] as PEmployee[] }),
          canLoadAdminResources ? pApi.customers() : Promise.resolve({ list: [] as PCustomer[] }),
          canLoadAdminResources ? pApi.teams() : Promise.resolve({ list: [] as PTeam[] }),
          pApi.mallProducts(),
          pApi.mallActivities(),
          pApi.strategies(),
        ]);
        if (disposed) return;

        const take = <T,>(item: PromiseSettledResult<T>, fallback: T): T =>
          item.status === 'fulfilled' ? item.value : fallback;

        setTenants(take(tenantRes, { list: [] as PTenant[] }).list || []);
        setStats(take(statsRes, null as PStatsOverview | null));
        setActivityEffect(take(activityEffectRes, null as PActivityEffectOverview | null));
        setPermissionsData(take(permissionsRes, null as PPermissionMatrix | null));
        setLiveActivities(
          take(activitiesRes, {
            activities: [] as PActivity[],
          }).activities || []
        );
        setLiveCourses(take(coursesRes, { categories: [] as string[], courses: [] as PLearningCourse[] }).courses || []);
        setEmployees(take(employeesRes, { list: [] as PEmployee[] }).list || []);
        setCustomers(take(customersRes, { list: [] as PCustomer[] }).list || []);
        setTeams(take(teamsRes, { list: [] as PTeam[] }).list || []);
        setMallProducts(take(mallProductsRes, { list: [] as PMallProduct[] }).list || []);
        setMallActivities(take(mallActivitiesRes, { list: [] as PMallActivity[] }).list || []);
        const nextStrategies = take(strategiesRes, { list: [] as PStrategy[] }).list || [];
        setStrategies(nextStrategies);
        setSelectedStrategy(nextStrategies[0] || null);
        const failed = [tenantRes, statsRes, activityEffectRes, permissionsRes, activitiesRes, coursesRes, employeesRes, customersRes, teamsRes, mallProductsRes, mallActivitiesRes, strategiesRes].filter(
          (x) => x.status === 'rejected'
        ).length;
        setLiveError(failed ? `部分数据加载失败（${failed}项）` : '');
      } catch (err: any) {
        if (disposed) return;
        setLiveError(err?.message || ERROR_COPY.realtimeLoadFailed);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || currentView !== 'customer-pool') return;
    let disposed = false;

    const syncCustomerPool = async () => {
      try {
        await refreshCustomerPoolData();
      } catch (err) {
        if (disposed) return;
        setLiveError(err?.message || '公共客户池刷新失败');
      }
    };

    syncCustomerPool().catch(() => undefined);
    const intervalId = window.setInterval(() => {
      syncCustomerPool().catch(() => undefined);
    }, 10000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [currentView, session]);

  useEffect(() => {
    if (!session) {
      setSidebarAllowedViews(null);
      return;
    }
    let disposed = false;
    (async () => {
      try {
        const next = await fetchPSidebarAllowedViews(session);
        if (disposed) return;
        setSidebarAllowedViews(next);
      } catch {
        if (disposed) return;
        setSidebarAllowedViews(getDefaultPAllowedViews(session));
      }
    })();
    return () => {
      disposed = true;
    };
  }, [session?.role, session?.tenantId]);

  const refreshCurrentTenantSidebarPermissions = async (tenantId: number) => {
    if (!session) return;
    const roleKey = normalizeEmployeePermissionRole(String(session.role || ''));
    if (roleKey === 'platform_admin') return;
    if (Number(session.tenantId || 0) !== Number(tenantId || 0)) return;
    try {
      const next = await fetchPSidebarAllowedViews(session);
      setSidebarAllowedViews(next);
      if (!Array.isArray(next) || next.length === 0) return;
      const root = toRootView(String(currentView || ''));
      if (!next.includes(root)) {
        setCurrentView((next[0] || 'activity') as any);
      }
    } catch {
      setSidebarAllowedViews(getDefaultPAllowedViews(session));
    }
  };

  useEffect(() => {
    if (!session) return;
    if (!Array.isArray(sidebarAllowedViews) || sidebarAllowedViews.length === 0) return;
    const root = toRootView(String(currentView || ''));
    if (sidebarAllowedViews.includes(root)) return;
    setCurrentView((sidebarAllowedViews[0] || 'activity') as any);
  }, [currentView, sidebarAllowedViews, session]);

  useEffect(() => {
    track('p_page_view', { view: currentView });
  }, [currentView]);

  const sortedActivities = [...liveActivities].sort(
    (a, b) => Number((a as any).sortOrder || 0) - Number((b as any).sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0)
  );
  const sortedCourses = [...liveCourses].sort(
    (a, b) => Number((a as any).sortOrder || 0) - Number((b as any).sortOrder || 0) || Number((a as any).id || 0) - Number((b as any).id || 0)
  );

  const activityRows = sortedActivities.map((row, idx) => ({
    id: `ACT-${String(row.id).padStart(4, '0')}`,
    rawId: Number(row.id || 0),
    order: Number((row as any).sortOrder || 0),
    name: row.title,
    type:
      row.category === 'sign'
        ? '签到任务'
        : row.category === 'competition'
          ? '互动竞赛'
          : row.category === 'invite'
            ? '邀请任务'
            : '通用任务',
    version: `v1.${idx + 1}.0`,
    status: toActivityOnlineStatus((row as any)?.status || 'online', (row as any)?.canComplete),
    updateTime: row.completed ? '今日已完成' : '今日可参与',
    isPlatformTemplate: Boolean((row as any).isPlatformTemplate),
    templateTag: String((row as any).templateTag || ''),
    icon:
      row.category === 'competition' ? <HelpCircle size={20} /> : row.category === 'invite' ? <Send size={20} /> : <FileText size={20} />,
    iconBg: row.category === 'competition' ? 'bg-orange-100' : row.category === 'invite' ? 'bg-purple-100' : 'bg-blue-100',
    iconColor: row.category === 'competition' ? 'text-orange-600' : row.category === 'invite' ? 'text-purple-600' : 'text-blue-600',
  }));

  const learningList = sortedCourses.map((course: any, idx: number) => {
    const firstMediaPreview =
      Array.isArray(course.media) && course.media[0]
        ? String((course.media[0] as any).preview || (course.media[0] as any).url || (course.media[0] as any).path || '')
        : '';
    const sourceType = String(course.sourceType || 'native');
    return {
      id: Number(course.id || idx + 1),
      title: course.title,
      sortOrder: Number(course.sortOrder || 0),
      status: String(course.status || 'published'),
      type:
        sourceType === 'video_channel'
          ? '视频号'
          : String(course.contentType || 'video') === 'article'
            ? '文章'
            : '视频',
      duration: '',
      category: course.category || '-',
      difficulty: String(course.level || '中级'),
      tags: [
        course.category || '学习',
        `积分${course.points || 0}`,
        sourceType === 'video_channel'
          ? String(course.videoChannelMeta?.finderUserName || '').trim()
              && String(course.videoChannelMeta?.feedId || '').trim()
            ? '微信内跳转'
            : String(course.videoChannelMeta?.feedToken || '').trim()
              ? '内嵌兼容'
              : '视频号课程'
          : '站内播放',
      ],
      image: firstMediaPreview || String(course.coverUrl || course.image || ''),
      points: Number(course.points || 0),
      content: String(course.content || ''),
      sourceType,
      videoChannelMeta: course.videoChannelMeta || null,
      coverUrl: String(course.coverUrl || course.image || ''),
      isPlatformTemplate: Boolean(course.isPlatformTemplate),
      templateTag: String(course.templateTag || ''),
      media: Array.isArray(course.media) ? course.media : [],
      createdAt: String(course.createdAt || ''),
    };
  });

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {currentView === 'login' || !session ? (
        <LoginPage
          onLogin={async ({ account, password }) => {
            const result = await pApi.login({ account, password });
            pApi.setSession(result.session);
            setSession(result.session);
            setCurrentView(getDefaultPView(result.session));
          }}
        />
      ) : (
        <>
      <Sidebar
        currentView={currentView}
        onViewChange={(v) => {
          const root = toRootView(String(v || ''));
          if (
            session &&
            Array.isArray(sidebarAllowedViews) &&
            sidebarAllowedViews.length > 0 &&
            !sidebarAllowedViews.includes(root)
          ) {
            window.alert(NOTICE_COPY.pagePermissionDenied);
            return;
          }
          if (v === 'create-tenant') setEditingTenantId(null);
          setCurrentView(v as any);
        }}
        session={session}
        allowedViews={sidebarAllowedViews}
        onLogout={() => {
          pApi.clearSession();
          setSession(null);
          setCurrentView('login');
        }}
      />
      {currentView === 'activity' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 pt-3">
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
              <span>
                实时数据: 租户 {tenants.length} · 角色 {(permissionsData?.roles || []).length} · 权限 {(permissionsData?.permissions || []).length}
              </span>
              <span className={liveError ? 'text-red-500' : 'text-emerald-600'}>{liveError ? '连接异常' : '已连接 API'}</span>
            </div>
            {stats?.latest?.metrics && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
                今日指标: 客户 {stats.latest.metrics.customers || 0} · 活跃 {stats.latest.metrics.activeCustomers || 0} · 支付订单 {stats.latest.metrics.paidOrders || 0}
              </div>
            )}
          </div>
          <Header />
          <MainContent
            onCreateClick={() => {
              setEditingActivityId(null);
              setCurrentView('create');
            }}
            canCreate={canManageTemplates}
            onNoPermission={handleNoTemplatePermission}
            onOpenDetail={(id) => {
              setSelectedActivityId(id);
              setCurrentView('activity-detail');
            }}
            onEdit={(id) => {
              const idNum = Number(String(id || '').replace(/\D+/g, ''));
              if (!idNum) return;
              setEditingActivityId(idNum);
              setCurrentView('create');
            }}
            onDelete={(id) => {
              const idNum = Number(String(id || '').replace(/\D+/g, ''));
              if (!idNum) return;
              const target = liveActivities.find((row) => Number(row.id) === idNum);
              if (toActivityOnlineStatus((target as any)?.status || 'online', (target as any)?.canComplete) === 'online') {
                window.alert('进行中的活动不能删除，请先下线后再删除');
                return;
              }
              openConfirmDialog('删除活动', `确认删除活动 #${idNum}？`, async () => {
                try {
                  await pApi.deleteActivity(idNum);
                  setLiveActivities((prev) => prev.filter((row) => Number(row.id) !== idNum));
                } catch (err: any) {
                  showApiError(err, ERROR_COPY.activityDeleteFailed);
                } finally {
                  closeConfirmDialog();
                }
              });
            }}
            onMove={async (sourceId, targetId) => {
              const sourceIdNum = Number(sourceId || 0);
              const targetIdNum = Number(targetId || 0);
              if (!sourceIdNum || !targetIdNum || sourceIdNum === targetIdNum) return;

              const orderedRows = [...liveActivities].sort(
                (a, b) => Number((a as any).sortOrder || 0) - Number((b as any).sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0)
              );
              const sourceIndex = orderedRows.findIndex((row) => Number(row.id) === sourceIdNum);
              const targetIndex = orderedRows.findIndex((row) => Number(row.id) === targetIdNum);
              if (sourceIndex < 0 || targetIndex < 0) return;

              const reorderedRows = orderedRows.slice();
              const [sourceRow] = reorderedRows.splice(sourceIndex, 1);
              reorderedRows.splice(targetIndex, 0, sourceRow);

              const nextOrderMap = new Map<number, number>();
              reorderedRows.forEach((row, idx) => {
                nextOrderMap.set(Number(row.id), idx + 1);
              });

              const previousRows = liveActivities.map((row) => ({ ...(row as any) })) as PActivity[];

              setMovingActivityId(sourceIdNum);
              setLiveActivities((prev) =>
                prev.map((row) => ({ ...(row as any), sortOrder: nextOrderMap.get(Number(row.id)) ?? Number((row as any).sortOrder || 0) } as PActivity))
              );

              try {
                await pApi.reorderActivities(reorderedRows.map((row) => Number(row.id)));
                const refreshed = await pApi.activities();
                setLiveActivities(Array.isArray(refreshed.activities) ? refreshed.activities : []);
              } catch (err: any) {
                setLiveActivities(previousRows);
                showApiError(err, '活动排序更新失败');
              } finally {
                setMovingActivityId(null);
              }
            }}
            onBatchDelete={async (ids) => {
              const numericIds = ids
                .map((id) => Number(String(id || '').replace(/\D+/g, '')))
                .filter((id) => Number.isInteger(id) && id > 0);
              if (numericIds.length === 0) return { confirmed: false, deletedCount: 0 };
              const blockedIds = numericIds.filter((id) => {
                const target = liveActivities.find((row) => Number(row.id) === id);
                return toActivityOnlineStatus((target as any)?.status || 'online', (target as any)?.canComplete) === 'online';
              });
              if (blockedIds.length > 0) {
                window.alert(`已勾选活动中有 ${blockedIds.length} 个进行中的活动，进行中的活动不能删除，请先下线后再删除。`);
                return { confirmed: false, deletedCount: 0 };
              }
              return await new Promise<{ confirmed: boolean; deletedCount: number }>((resolve) => {
                openConfirmDialog(
                  '批量删除活动',
                  `确认删除已勾选的 ${numericIds.length} 个活动？`,
                  async () => {
                    try {
                      const payload = await pApi.deleteActivitiesBatch(numericIds);
                      const deletedIds = Array.isArray(payload?.ids)
                        ? payload.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
                        : [];
                      const blockedIdsFromApi = Array.isArray(payload?.blockedIds)
                        ? payload.blockedIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
                        : [];
                      const failedCount = numericIds.length - deletedIds.length;
                      if (deletedIds.length > 0) {
                        setLiveActivities((prev) => prev.filter((row) => !deletedIds.includes(Number(row.id))));
                      }
                      if (blockedIdsFromApi.length > 0) {
                        window.alert(`已删除 ${deletedIds.length} 个活动，另有 ${blockedIdsFromApi.length} 个进行中的活动未删除，请先下线后再删除。`);
                      } else if (failedCount > 0) {
                        window.alert(buildBatchDeleteResultMessage({ deletedCount: deletedIds.length, failedCount, unit: '个活动' }));
                      } else if (deletedIds.length > 0) {
                        window.alert(buildBatchDeleteResultMessage({ deletedCount: deletedIds.length, failedCount: 0, unit: '个活动' }));
                      }
                      resolve({ confirmed: true, deletedCount: deletedIds.length });
                    } catch (err: any) {
                      showApiError(err, ERROR_COPY.activityDeleteFailed);
                      resolve({ confirmed: true, deletedCount: 0 });
                    } finally {
                      closeConfirmDialog();
                    }
                  },
                  () => resolve({ confirmed: false, deletedCount: 0 })
                );
              });
            }}
            movingActivityId={movingActivityId}
            activityRows={activityRows}
          />
        </div>
      )}
      {currentView === 'activity-detail' && (
        <ActivityDetailPage
          onBack={() => setCurrentView('activity')}
          onEdit={() => {
            const idNum = Number(String(selectedActivityId || '').replace(/\D+/g, ''));
            if (!idNum) return;
            setEditingActivityId(idNum);
            setCurrentView('create');
          }}
          activity={(() => {
            const idNum = Number(String(selectedActivityId || '').replace('ACT-', ''));
            const live = liveActivities.find((x) => Number(x.id) === idNum);
            if (live) {
              return {
                id: live.id,
                title: live.title,
                status: toActivityOnlineStatus((live as any)?.status || 'online', (live as any)?.canComplete),
                rewardPoints: Number(live.rewardPoints || 0),
                content: String((live as any).content || ''),
                media: Array.isArray((live as any).media) ? (live as any).media : [],
                participants: Number(live.participants || 0),
                updatedAt: String((live as any).updatedAt || ''),
                createdAt: String((live as any).createdAt || ''),
              };
            }
            return null;
          })()}
        />
      )}
      {currentView === 'tenants' && (
        <TenantListPage
          tenants={tenants}
          loadError={liveError}
          onCreate={() => {
            setEditingTenantId(null);
            setCurrentView('create-tenant');
          }}
          onOpenDetail={(tenant) => {
            const id = Number((tenant as any)?.id || 0);
            if (!id) return;
            setSelectedTenantId(id);
            setCurrentView('tenant-detail');
          }}
          onEdit={(tenant) => {
            const id = Number((tenant as any)?.id || 0);
            if (!id) return;
            setEditingTenantId(id);
            setCurrentView('edit-tenant');
          }}
          onDelete={(tenant) => {
            const id = Number((tenant as any)?.id || 0);
            if (!id) return;
            openConfirmDialog('删除租户', `确认删除租户「${(tenant as any)?.name || id}」？`, async () => {
              try {
                await pApi.deleteTenant(id);
                setTenants((prev) => prev.filter((row) => Number((row as any).id) !== id));
              } catch (err: any) {
                showApiError(err, ERROR_COPY.tenantDeleteFailed);
              } finally {
                closeConfirmDialog();
              }
            });
          }}
        />
      )}
      {currentView === 'tenant-detail' && (
        <TenantDetailPage
          tenant={tenants.find((tenant) => Number((tenant as any).id) === Number(selectedTenantId || 0)) || null}
          onBack={() => setCurrentView('tenants')}
        />
      )}
      {currentView === 'create-tenant' && (
        <CreateTenantPage
          mode="create"
          initialValues={null}
          onCancel={() => {
            setEditingTenantId(null);
            setCurrentView('tenants');
          }}
          onSubmit={async (payload) => {
            const created = await pApi.createTenant(payload);
            setTenants((prev) => [created.tenant, ...prev]);
            setEditingTenantId(null);
            setCurrentView('tenants');
          }}
        />
      )}
      {currentView === 'edit-tenant' && (
        <CreateTenantPage
          mode="edit"
          initialValues={(() => {
            const target = tenants.find((x) => Number((x as any).id) === Number(editingTenantId || 0));
            if (!target) return null;
            return {
              name: String((target as any).name || ''),
              type: ((target as any).type === 'individual' ? 'individual' : 'company') as 'company' | 'individual',
              status: ((target as any).status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
              adminEmail: String((target as any).adminEmail || ''),
            };
          })()}
          onCancel={() => {
            setEditingTenantId(null);
            setCurrentView('tenants');
          }}
          onSubmit={async (payload) => {
            if (!editingTenantId) return;
            const result = await pApi.updateTenant(editingTenantId, payload);
            setTenants((prev) => prev.map((row) => (Number((row as any).id) === Number(editingTenantId) ? result.tenant : row)));
            setEditingTenantId(null);
            setCurrentView('tenants');
          }}
        />
      )}
      {currentView === 'create' && (
        <CreateActivity
          mode={editingActivityId ? 'edit' : 'create'}
          initialValues={(() => {
            const target = liveActivities.find((x) => Number(x.id) === Number(editingActivityId || 0));
            if (!target) return null;
            return {
              title: String((target as any).title || ''),
              category: String((target as any).category || 'task'),
              rewardPoints: Number((target as any).rewardPoints || 0),
              content: String((target as any).content || ''),
              status: String((target as any).status || 'online'),
              media: Array.isArray((target as any).media) ? (target as any).media : [],
            };
          })()}
          onBack={() => {
            setEditingActivityId(null);
            setCurrentView('activity');
          }}
          onSubmit={async (payload) => {
            if (editingActivityId) {
              const result = await pApi.updateActivity(editingActivityId, payload);
              setLiveActivities((prev) =>
                prev.map((row) => (Number(row.id) === Number(editingActivityId) ? ({ ...(row as any), ...(result.activity as any), media: payload.media } as any) : row))
              );
            } else {
              const result = await pApi.createActivity(payload);
              const created = {
                ...(result.activity as any),
                media: payload.media,
              } as PActivity;
              setLiveActivities((prev) => [created, ...prev]);
            }
            setEditingActivityId(null);
            setCurrentView('activity');
          }}
        />
      )}
      {currentView === 'learning' && (
        <LearningMaterials
          session={session!}
          onCreate={() => {
            setEditingLearningId(null);
            setCurrentView('learning-create');
          }}
          canCreate={canManageTemplates}
          onNoPermission={handleNoTemplatePermission}
          onOpenDetail={(item) => {
            setSelectedLearningId(Number(item?.id || 0));
            setCurrentView('learning-detail');
          }}
          onEdit={(item) => {
            const id = Number(item?.id || 0);
            if (!id) return;
            setEditingLearningId(id);
            setCurrentView('learning-create');
          }}
          onDelete={(item) => {
            const id = Number(item?.id || 0);
            if (!id) return;
            openConfirmDialog('删除知识学习', `确认删除资料「${item?.title || id}」？`, async () => {
              try {
                await pApi.deleteLearningCourse(id);
                setLiveCourses((prev) => prev.filter((row) => Number((row as any).id) !== id));
              } catch (err: any) {
                showApiError(err, ERROR_COPY.materialDeleteFailed);
              } finally {
                closeConfirmDialog();
              }
            });
          }}
          onMove={async (sourceId, targetId) => {
            const sourceIdNum = Number(sourceId || 0);
            const targetIdNum = Number(targetId || 0);
            if (!sourceIdNum || !targetIdNum || sourceIdNum === targetIdNum) return;

            const orderedRows = [...liveCourses].sort(
              (a, b) => Number((a as any).sortOrder || 0) - Number((b as any).sortOrder || 0) || Number((a as any).id || 0) - Number((b as any).id || 0)
            );
            const sourceIndex = orderedRows.findIndex((row) => Number((row as any).id) === sourceIdNum);
            const targetIndex = orderedRows.findIndex((row) => Number((row as any).id) === targetIdNum);
            if (sourceIndex < 0 || targetIndex < 0) return;

            const reorderedRows = orderedRows.slice();
            const [sourceRow] = reorderedRows.splice(sourceIndex, 1);
            reorderedRows.splice(targetIndex, 0, sourceRow);

            const nextOrderMap = new Map<number, number>();
            reorderedRows.forEach((row, idx) => {
              nextOrderMap.set(Number((row as any).id), idx + 1);
            });

            const previousRows = liveCourses.map((row) => ({ ...(row as any) })) as PLearningCourse[];

            setMovingLearningId(sourceIdNum);
            setLiveCourses((prev) =>
              prev.map((row) => ({
                ...(row as any),
                sortOrder: nextOrderMap.get(Number((row as any).id)) ?? Number((row as any).sortOrder || 0),
              } as PLearningCourse))
            );

            try {
              await pApi.reorderLearningCourses(reorderedRows.map((row) => Number((row as any).id)));
              const refreshed = await pApi.learningCourses();
              setLiveCourses(Array.isArray(refreshed.courses) ? refreshed.courses : Array.isArray(refreshed.list) ? refreshed.list : []);
            } catch (err: any) {
              setLiveCourses(previousRows);
              showApiError(err, '知识学习排序更新失败');
            } finally {
              setMovingLearningId(null);
            }
          }}
          onBatchDelete={async (items) => {
            const ids = items.map((item) => Number(item?.id || 0)).filter((id) => Number.isInteger(id) && id > 0);
            if (ids.length === 0) return { confirmed: false, deletedCount: 0 };
            return await new Promise<{ confirmed: boolean; deletedCount: number }>((resolve) => {
              openConfirmDialog(
                '批量删除知识学习',
                `确认删除已勾选的 ${ids.length} 条资料？`,
                async () => {
                  try {
                    const payload = await pApi.deleteLearningCoursesBatch(ids);
                    const deletedIds = Array.isArray(payload?.ids)
                      ? payload.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
                      : [];
                    const failedCount = ids.length - deletedIds.length;
                    if (deletedIds.length > 0) {
                      setLiveCourses((prev) => prev.filter((row) => !deletedIds.includes(Number((row as any).id))));
                    }
                    if (failedCount > 0) {
                      window.alert(buildBatchDeleteResultMessage({ deletedCount: deletedIds.length, failedCount, unit: '条资料' }));
                    } else if (deletedIds.length > 0) {
                      window.alert(buildBatchDeleteResultMessage({ deletedCount: deletedIds.length, failedCount: 0, unit: '条资料' }));
                    }
                    resolve({ confirmed: true, deletedCount: deletedIds.length });
                  } catch (err: any) {
                    showApiError(err, ERROR_COPY.materialDeleteFailed);
                    resolve({ confirmed: true, deletedCount: 0 });
                  } finally {
                    closeConfirmDialog();
                  }
                },
                () => resolve({ confirmed: false, deletedCount: 0 })
              );
            });
          }}
          list={learningList}
          movingLearningId={movingLearningId}
        />
      )}
      {currentView === 'learning-detail' && (
        <LearningDetailViewPage
          onBack={() => setCurrentView('learning')}
          onEdit={() => {
            const id = Number(selectedLearningId || 0);
            if (!id) return;
            setEditingLearningId(id);
            setCurrentView('learning-create');
          }}
          item={learningList.find((x) => Number(x.id) === Number(selectedLearningId || 0)) || null}
        />
      )}
      {currentView === 'learning-create' && (
        <CreateLearningMaterial
          mode={editingLearningId ? 'edit' : 'create'}
          initialValues={(() => {
            const target = liveCourses.find((x) => Number((x as any).id) === Number(editingLearningId || 0));
            if (!target) return null;
            return {
              title: String((target as any).title || ''),
              category: String((target as any).category || '通用培训'),
              points: Number((target as any).points || 0),
              contentType: String((target as any).contentType || 'video'),
              sourceType: String((target as any).sourceType || 'native'),
              videoChannelMeta: (target as any).videoChannelMeta || null,
              level: String((target as any).level || '中级'),
              content: String((target as any).content || ''),
              status: String((target as any).status || 'published'),
              coverUrl: String((target as any).coverUrl || (target as any).image || ''),
              media: Array.isArray((target as any).media) ? (target as any).media : [],
            };
          })()}
          onBack={() => {
            setEditingLearningId(null);
            setCurrentView('learning');
          }}
          onSubmit={async (payload) => {
            if (editingLearningId) {
              const result = await pApi.updateLearningCourse(editingLearningId, payload);
              setLiveCourses((prev) =>
                prev.map((row) =>
                  Number((row as any).id) === Number(editingLearningId)
                    ? ({
                        ...(row as any),
                        ...(result.course as any),
                        media: payload.media,
                        sourceType: payload.sourceType,
                        videoChannelMeta: payload.videoChannelMeta,
                        coverUrl: payload.coverUrl || (result.course as any)?.coverUrl || '',
                      } as any)
                    : row
                )
              );
            } else {
              const result = await pApi.createLearningCourse(payload);
              const created = {
                ...(result.course as any),
                media: payload.media,
                sourceType: payload.sourceType,
                videoChannelMeta: payload.videoChannelMeta,
                coverUrl: payload.coverUrl || (result.course as any)?.coverUrl || '',
              } as PLearningCourse;
              setLiveCourses((prev) => [created, ...prev]);
            }
            setEditingLearningId(null);
            setCurrentView('learning');
          }}
        />
      )}
      {currentView === 'shop' && (
        <MallManagementPage
          onAddProduct={() => {
            setEditingMallProductId(null);
            setCurrentView('shop-add-product');
          }}
          onAddActivity={() => {
            setEditingMallActivityId(null);
            setCurrentView('shop-add-activity');
          }}
          canCreate={canManageTemplates}
          onNoPermission={handleNoTemplatePermission}
          onMoveProduct={async (sourceId, targetId) => {
            const sourceIdNum = Number(sourceId || 0);
            const targetIdNum = Number(targetId || 0);
            if (!sourceIdNum || !targetIdNum || sourceIdNum === targetIdNum) return;

            const orderedRows = [...mallProducts].sort(
              (a, b) => Number((a as any).sortOrder || 0) - Number((b as any).sortOrder || 0) || Number((a as any).id || 0) - Number((b as any).id || 0)
            );
            const sourceIndex = orderedRows.findIndex((row) => Number((row as any).id) === sourceIdNum);
            const targetIndex = orderedRows.findIndex((row) => Number((row as any).id) === targetIdNum);
            if (sourceIndex < 0 || targetIndex < 0) return;

            const reorderedRows = orderedRows.slice();
            const [sourceRow] = reorderedRows.splice(sourceIndex, 1);
            reorderedRows.splice(targetIndex, 0, sourceRow);

            const nextOrderMap = new Map<number, number>();
            reorderedRows.forEach((row, idx) => {
              nextOrderMap.set(Number((row as any).id), idx + 1);
            });

            const previousRows = mallProducts.map((row) => ({ ...(row as any) })) as PMallProduct[];
            setMallProducts((prev) =>
              prev.map((row) => ({ ...(row as any), sortOrder: nextOrderMap.get(Number((row as any).id)) ?? Number((row as any).sortOrder || 0) } as PMallProduct))
            );

            try {
              await pApi.reorderMallProducts(reorderedRows.map((row) => Number((row as any).id)));
              const refreshed = await pApi.mallProducts();
              setMallProducts(Array.isArray(refreshed.list) ? refreshed.list : []);
            } catch (err: any) {
              setMallProducts(previousRows);
              showApiError(err, '商品排序更新失败');
            }
          }}
          onMoveActivity={async (sourceId, targetId) => {
            const sourceIdNum = Number(sourceId || 0);
            const targetIdNum = Number(targetId || 0);
            if (!sourceIdNum || !targetIdNum || sourceIdNum === targetIdNum) return;

            const orderedRows = [...mallActivities].sort(
              (a, b) => Number((a as any).sortOrder || 0) - Number((b as any).sortOrder || 0) || Number((a as any).id || 0) - Number((b as any).id || 0)
            );
            const sourceIndex = orderedRows.findIndex((row) => Number((row as any).id) === sourceIdNum);
            const targetIndex = orderedRows.findIndex((row) => Number((row as any).id) === targetIdNum);
            if (sourceIndex < 0 || targetIndex < 0) return;

            const reorderedRows = orderedRows.slice();
            const [sourceRow] = reorderedRows.splice(sourceIndex, 1);
            reorderedRows.splice(targetIndex, 0, sourceRow);

            const nextOrderMap = new Map<number, number>();
            reorderedRows.forEach((row, idx) => {
              nextOrderMap.set(Number((row as any).id), idx + 1);
            });

            const previousRows = mallActivities.map((row) => ({ ...(row as any) })) as PMallActivity[];
            setMallActivities((prev) =>
              prev.map((row) => ({ ...(row as any), sortOrder: nextOrderMap.get(Number((row as any).id)) ?? Number((row as any).sortOrder || 0) } as PMallActivity))
            );

            try {
              await pApi.reorderMallActivities(reorderedRows.map((row) => Number((row as any).id)));
              const refreshed = await pApi.mallActivities();
              setMallActivities(Array.isArray(refreshed.list) ? refreshed.list : []);
            } catch (err: any) {
              setMallActivities(previousRows);
              showApiError(err, '活动排序更新失败');
            }
          }}
          onViewProduct={(id) => {
            setSelectedMallProductId(id);
            setCurrentView('shop-product-detail');
          }}
          onViewActivity={(id) => {
            setSelectedMallActivityId(id);
            setCurrentView('shop-activity-detail');
          }}
          onEditProduct={(id) => {
            if (!id) return;
            setEditingMallProductId(id);
            setCurrentView('shop-add-product');
          }}
          onDeleteProduct={(id) => {
            openConfirmDialog('删除商城商品', `确认删除商品 #${id}？`, async () => {
              try {
                await pApi.deleteMallProduct(id);
                setMallProducts((prev) => prev.filter((row) => Number((row as any).id) !== id));
              } catch (err: any) {
                showApiError(err, ERROR_COPY.productDeleteFailed);
              } finally {
                closeConfirmDialog();
              }
            });
          }}
          onEditActivity={(id) => {
            if (!id) return;
            setEditingMallActivityId(id);
            setCurrentView('shop-add-activity');
          }}
          onDeleteActivity={(id) => {
            openConfirmDialog('删除商城活动', `确认删除活动 #${id}？`, async () => {
              try {
                await pApi.deleteMallActivity(id);
                setMallActivities((prev) => prev.filter((row) => Number((row as any).id) !== id));
              } catch (err: any) {
                showApiError(err, ERROR_COPY.activityDeleteFailed);
              } finally {
                closeConfirmDialog();
              }
            });
          }}
          products={mallProducts}
          activities={mallActivities}
        />
      )}
      {currentView === 'shop-product-detail' && (
        <MallProductDetailPage
          onBack={() => setCurrentView('shop')}
          onEdit={() => {
            const id = Number(selectedMallProductId || 0);
            if (!id) return;
            setEditingMallProductId(id);
            setCurrentView('shop-add-product');
          }}
          item={mallProducts.find((x) => Number(x.id) === Number(selectedMallProductId || 0)) || null}
        />
      )}
      {currentView === 'shop-activity-detail' && (
        <MallActivityDetailPage
          onBack={() => setCurrentView('shop')}
          onEdit={() => {
            const id = Number(selectedMallActivityId || 0);
            if (!id) return;
            setEditingMallActivityId(id);
            setCurrentView('shop-add-activity');
          }}
          item={mallActivities.find((x) => Number(x.id) === Number(selectedMallActivityId || 0)) || null}
        />
      )}
      {currentView === 'shop-add-product' && (
        <AddMallProductPage
          mode={editingMallProductId ? 'edit' : 'create'}
          initialValues={(() => {
            const target = mallProducts.find((x) => Number((x as any).id) === Number(editingMallProductId || 0));
            if (!target) return null;
            return {
              title: String((target as any).title || ''),
              points: Number((target as any).points || 0),
              stock: Number((target as any).stock || 0),
              sortOrder: Number((target as any).sortOrder || 99),
              category: String((target as any).category || '实物礼品 (Gift)'),
              description: String((target as any).description || ''),
              limitPerUser: Boolean((target as any).limitPerUser),
              vipOnly: Boolean((target as any).vipOnly),
              enableCountdown: Boolean((target as any).enableCountdown),
              status: String((target as any).status || 'active'),
              media: Array.isArray((target as any).media) ? (target as any).media : [],
            };
          })()}
          onBack={() => {
            setEditingMallProductId(null);
            setCurrentView('shop');
          }}
          onSubmit={async (payload) => {
            if (editingMallProductId) {
              const result = await pApi.updateMallProduct(editingMallProductId, payload);
              setMallProducts((prev) =>
                prev.map((row) =>
                  Number((row as any).id) === Number(editingMallProductId) ? ({ ...(row as any), ...(result.product as any), media: payload.media } as any) : row
                )
              );
            } else {
              const result = await pApi.createMallProduct(payload);
              setMallProducts((prev) => [{ ...(result.product as any), ...payload }, ...prev]);
            }
            setEditingMallProductId(null);
            setCurrentView('shop');
          }}
        />
      )}
      {currentView === 'shop-add-activity' && (
        <AddMallActivityPage
          mode={editingMallActivityId ? 'edit' : 'create'}
          initialValues={(() => {
            const target = mallActivities.find((x) => Number((x as any).id) === Number(editingMallActivityId || 0));
            if (!target) return null;
            return {
              title: String((target as any).title || ''),
              displayTitle: String((target as any).displayTitle || (target as any).title || ''),
              type: (String((target as any).type || 'task') as ActivityTypeOptionValue),
              rewardPoints: Number((target as any).rewardPoints || 0),
              sortOrder: Number((target as any).sortOrder || 10),
              description: String((target as any).description || ''),
              status: String((target as any).status || 'active'),
              media: Array.isArray((target as any).media) ? (target as any).media : [],
            };
          })()}
          onBack={() => {
            setEditingMallActivityId(null);
            setCurrentView('shop');
          }}
          onSubmit={async (payload) => {
            if (editingMallActivityId) {
              const result = await pApi.updateMallActivity(editingMallActivityId, payload);
              setMallActivities((prev) =>
                prev.map((row) =>
                  Number((row as any).id) === Number(editingMallActivityId) ? ({ ...(row as any), ...(result.activity as any), media: payload.media } as any) : row
                )
              );
            } else {
              const result = await pApi.createMallActivity(payload);
              setMallActivities((prev) => [{ ...(result.activity as any), ...payload }, ...prev]);
            }
            setEditingMallActivityId(null);
            setCurrentView('shop');
          }}
        />
      )}
      {currentView === 'tag-list' && (
        <LabelListPage />
      )}
      {currentView === 'tags' && (
        <TagRules />
      )}
      {currentView === 'event-management' && (
        <EventManagementPage />
      )}
      {currentView === 'strategy' && (
        <StrategyListPage
          list={strategies}
          onCreate={() => setCurrentView('strategy-config')}
          onEdit={(strategy) => {
            setSelectedStrategy(strategy);
            setCurrentView('strategy-config');
          }}
        />
      )}
      {currentView === 'strategy-config' && (
        <StrategyCanvasPage onBack={() => setCurrentView('strategy')} strategy={selectedStrategy} />
      )}
      {currentView === 'metric-config' && (
        <MetricConfigPage />
      )}
      {currentView === 'points-rules' && (
        <PointsRuleConfigPage session={session} tenants={tenants} />
      )}
      {currentView === 'employees' && (
        <EmployeeManagement
          permissionTenantId={Number(session?.tenantId || 1)}
          employees={employees}
          teams={teams}
          onCreateEmployee={async (payload) => {
            const result = await pApi.createEmployee(payload);
            setEmployees((prev) => [result.employee, ...prev]);
            return result.initialPassword || '123456';
          }}
          onUpdateEmployee={async (payload) => {
            const result = await pApi.updateEmployee(payload.id, payload);
            setEmployees((prev) =>
              prev.map((row) => (Number((row as any).id) === Number(payload.id) ? ({ ...(row as any), ...(result.employee as any) } as any) : row))
            );
          }}
          onDeleteEmployee={async (id) => {
            await pApi.deleteEmployee(id);
            setEmployees((prev) => prev.filter((row) => Number((row as any).id) !== Number(id)));
          }}
          onCreateTeam={async (name) => {
            const result = await pApi.createTeam({ name });
            setTeams((prev) => [...prev, result.team].sort((a, b) => Number(a.id) - Number(b.id)));
          }}
          onUpdateTeam={async (id, name) => {
            const result = await pApi.updateTeam(id, { name });
            setTeams((prev) => prev.map((row) => (Number(row.id) === Number(id) ? result.team : row)));
            setEmployees((prev) =>
              prev.map((row) =>
                Number((row as any).teamId || 0) === Number(id) ? ({ ...(row as any), teamName: result.team.name } as any) : row
              )
            );
          }}
          onDeleteTeam={async (id) => {
            await pApi.deleteTeam(id);
            setTeams((prev) => prev.filter((row) => Number(row.id) !== Number(id)));
          }}
        />
      )}
      {currentView === 'customer-pool' && (
        <PublicCustomerPoolPage
          customers={customers}
          employees={assignableEmployees}
          assigningCustomerId={assigningCustomerId}
          selectedAgentByCustomerId={selectedAgentByCustomerId}
          onSelectAgent={(customerId, agentId) => {
            setSelectedAgentByCustomerId((prev) => ({ ...prev, [Number(customerId)]: String(agentId || '') }));
          }}
          onAssign={async (customerId) => {
            const targetCustomerId = Number(customerId || 0);
            const agentId = Number(selectedAgentByCustomerId[targetCustomerId] || 0);
            const customer = customers.find((row) => Number(row.id) === targetCustomerId) || null;
            if (!targetCustomerId || !agentId) {
              window.alert('请先选择要分配的员工');
              return;
            }
            if (!customer?.mobile) {
              window.alert('客户手机号缺失，暂时无法分配');
              return;
            }
            setAssigningCustomerId(targetCustomerId);
            try {
              await pApi.assignCustomerByMobile({ mobile: customer.mobile, agentId });
              await refreshCustomerPoolData();
              setSelectedAgentByCustomerId((prev) => {
                const next = { ...prev };
                delete next[targetCustomerId];
                return next;
              });
            } catch (err) {
              showApiError(err, '客户分配失败');
            } finally {
              setAssigningCustomerId(null);
            }
          }}
        />
      )}
      {currentView === 'permissions' && (
        <PermissionsManagement
          tenants={tenants}
          onPermissionsSaved={(tenantId) => refreshCurrentTenantSidebarPermissions(tenantId)}
        />
      )}
      {currentView === 'stats' && (
        <StatsDashboardPage
          statsRole={statsRole}
          setStatsRole={setStatsRole}
          tenants={tenants}
          stats={stats}
          activityEffect={activityEffect}
          onRebuild={async () => {
            try {
              await pApi.rebuildStats();
              const [next, nextActivityEffect] = await Promise.all([pApi.stats(), pApi.activityEffectOverview()]);
              setStats(next);
              setActivityEffect(nextActivityEffect);
            } catch {}
          }}
        />
      )}
      {currentView === 'monitor' && (
        <MonitorScreenPage />
      )}
      {currentView === 'finance' && (
        <FinanceReconcilePage
          reports={reconciliationReports}
          onRun={async () => {
            const result = await pApi.runReconciliation();
            setReconciliationReports((prev) => [result.report, ...prev]);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onCancel={() => {
          confirmDialog.onCancel?.();
          closeConfirmDialog();
        }}
        onConfirm={async () => {
          if (!confirmDialog.onConfirm) return;
          await confirmDialog.onConfirm();
        }}
      />
        </>
      )}
    </div>
  );
}

const PermissionsManagement = ({
  tenants,
  onPermissionsSaved,
}: {
  tenants: PTenant[];
  onPermissionsSaved?: (tenantId: number) => Promise<void> | void;
}) => {
  const [query, setQuery] = useState('');
  const [activeTenantId, setActiveTenantId] = useState<number>(Number(tenants[0]?.id || 1));
  const [modules, setModules] = useState<PCompanyAdminPagePermissionModule[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenants.length) return;
    if (tenants.some((x) => Number(x.id) === Number(activeTenantId))) return;
    setActiveTenantId(Number(tenants[0].id || 1));
  }, [tenants, activeTenantId]);

  useEffect(() => {
    if (!activeTenantId) return;
    let disposed = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await pApi.companyAdminPagePermissions(Number(activeTenantId));
        if (disposed) return;
        setModules(Array.isArray(res.modules) ? res.modules : []);
      } catch (err: any) {
        if (disposed) return;
        setError(err?.message || ERROR_COPY.permissionConfigLoadFailed);
        setModules([]);
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [activeTenantId]);

  const visibleTenants = tenants.filter((tenant) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return String(tenant.name || '').toLowerCase().includes(q) || String(tenant.id || '').toLowerCase().includes(q);
  });

  const activeTenant = tenants.find((x) => Number(x.id) === Number(activeTenantId)) || null;

  const togglePage = (pageId: string) => {
    setModules((prev) =>
      prev.map((group) => ({
        ...group,
        pages: (group.pages || []).map((page) =>
          String(page.pageId || '') === String(pageId || '') ? { ...page, enabled: !Boolean(page.enabled) } : page
        ),
      }))
    );
  };

  const resetToDefault = () => {
    setModules((prev) =>
      prev.map((group) => ({
        ...group,
        pages: (group.pages || []).map((page) => ({ ...page, enabled: true })),
      }))
    );
  };

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      const grants = modules.flatMap((group) =>
        (group.pages || []).map((page) => ({
          pageId: String(page.pageId || ''),
          enabled: Boolean(page.enabled),
        }))
      );
      await pApi.saveCompanyAdminPagePermissions({
        tenantId: Number(activeTenantId || 1),
        grants,
      });
      try {
        const res = await pApi.companyAdminPagePermissions(Number(activeTenantId || 1));
        setModules(Array.isArray(res.modules) ? res.modules : []);
      } catch {
        // Keep the just-saved local matrix if immediate reload fails.
      }
      await onPermissionsSaved?.(Number(activeTenantId || 1));
      window.alert(NOTICE_COPY.permissionSaved);
    } catch (err: any) {
      setError(err?.message || ERROR_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Top Header */}
      <header className="h-16 border-b border-gray-200 bg-white px-8 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold text-gray-900">权限分配</h2>
        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
            <Bell size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
            <HelpCircle size={20} />
          </button>
        </div>
      </header>

      {/* Inner Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Searchable Company List */}
        <aside className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-gray-50/50">
          <div className="p-4">
            <p className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider">租户列表</p>
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索租户..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-3 overflow-y-auto">
              {visibleTenants.map((tenant) => (
                <div 
                  key={tenant.id}
                  onClick={() => setActiveTenantId(Number(tenant.id || 1))}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                    Number(activeTenantId) === Number(tenant.id) 
                      ? 'bg-white border-2 border-blue-600 shadow-sm' 
                      : 'bg-white border border-gray-200 hover:border-blue-600/50'
                  }`}
                >
                  <div className="min-w-0">
                    <h4 className={`text-sm truncate ${Number(activeTenantId) === Number(tenant.id) ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                      {tenant.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">T-{String(tenant.id).padStart(3, '0')}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {Number(activeTenantId) === Number(tenant.id) && (
                      <ChevronRight size={16} className="text-blue-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Column: Workspace (Permission Matrix) */}
        <section className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Matrix Header */}
          <div className="border-b border-gray-200 bg-white shrink-0">
            <div className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">权限配置矩阵</h3>
                <p className="text-sm text-gray-500 mt-1">
                  正在编辑: {activeTenant?.name || `租户${activeTenantId}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={resetToDefault} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer">
                  <History size={16} />
                  重置为默认
                </button>
                <button disabled={saving} onClick={() => void save()} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-60">
                  <Save size={16} />
                  {saving ? '保存中...' : '保存更改'}
                </button>
              </div>
            </div>
            
            <div className="flex border-t border-gray-100 px-6 py-2">
              <div className="flex p-1 bg-gray-50 rounded-lg w-fit">
                <button 
                  className="flex items-center gap-2 px-6 py-2 text-sm rounded-md transition-all cursor-default font-bold bg-white shadow-sm text-blue-600"
                >
                  <Shield size={16} />
                  公司管理员
                </button>
              </div>
            </div>
          </div>

          {/* Matrix Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 shrink-0">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
                <Info size={20} className="text-blue-500 shrink-0" />
                <p className="text-sm text-blue-700 leading-relaxed">
                  此处设置的是公司管理员在 P 端的页面访问权限。勾选即有权限，取消勾选即无权限；保存后会立即刷新当前租户侧边栏权限。
                </p>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto px-6 pb-6">
              {error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
              ) : null}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full border-collapse bg-white">
                  <thead>
                    <tr className="text-left bg-gray-50 border-b border-gray-200">
                      <th className="py-4 px-6 text-sm font-bold text-gray-700">功能模块</th>
                      <th className="py-4 px-6 text-sm font-bold text-gray-700 text-center">页面访问</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td className="py-6 px-6 text-sm text-gray-500" colSpan={2}>加载中...</td>
                      </tr>
                    ) : modules.map((module, mIdx) => (
                      <React.Fragment key={mIdx}>
                        <tr className="bg-gray-50/50">
                          <td className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider" colSpan={2}>
                            {module.group}
                          </td>
                        </tr>
                        {(module.pages || []).map((item, iIdx) => (
                          <tr key={iIdx} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-6 text-sm font-medium text-gray-900">{item.pageName}</td>
                            <td className="py-4 px-6 text-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-600 cursor-pointer border-gray-300"
                                checked={Boolean(item.enabled)}
                                onChange={() => togglePage(String(item.pageId || ''))}
                              />
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const EmployeeManagement = ({
  permissionTenantId,
  employees,
  teams,
  onCreateEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
}: {
  permissionTenantId: number;
  employees: PEmployee[];
  teams: PTeam[];
  onCreateEmployee: (payload: { name: string; email: string; mobile: string; role: string; teamId: number }) => Promise<string>;
  onUpdateEmployee: (payload: { id: number; name: string; email: string; mobile: string; role: string; teamId: number; status?: string }) => Promise<void>;
  onDeleteEmployee: (id: number) => Promise<void>;
  onCreateTeam: (name: string) => Promise<void>;
  onUpdateTeam: (id: number, name: string) => Promise<void>;
  onDeleteTeam: (id: number) => Promise<void>;
}) => {
  type EmployeeRolePagePermissionKey = 'company_admin' | 'agent' | 'team_lead';
  const ROLE_PAGE_TABS: Array<{ key: EmployeeRolePagePermissionKey; label: string; editable: boolean }> = [
    { key: 'company_admin', label: '公司管理员', editable: false },
    { key: 'agent', label: '业务员', editable: true },
    { key: 'team_lead', label: '团队主管', editable: true },
  ];
  const isValidMobile = (v: string) => /^1\d{10}$/.test(v);
  const teamLabel = (row: any) => {
    if (String(row.role || '') === 'manager') return '全公司';
    if (String(row.teamName || '').trim()) return String(row.teamName);
    const found = teams.find((x) => Number(x.id) === Number(row.teamId || 0));
    return found?.name || `团队 ${Number(row.teamId || 1)}`;
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('salesperson');
  const [teamId, setTeamId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdNotice, setCreatedNotice] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editRole, setEditRole] = useState('salesperson');
  const [editTeamId, setEditTeamId] = useState('');
  const [deletingEmployee, setDeletingEmployee] = useState<any | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [activePermissionRole, setActivePermissionRole] = useState<EmployeeRolePagePermissionKey>('company_admin');
  const [rolePageModules, setRolePageModules] = useState<Record<EmployeeRolePagePermissionKey, PEmployeeRolePagePermissionModule[]>>({
    company_admin: [],
    agent: [],
    team_lead: [],
  });
  const [rolePageEditable, setRolePageEditable] = useState<Record<EmployeeRolePagePermissionKey, boolean>>({
    company_admin: false,
    agent: true,
    team_lead: true,
  });
  const [rolePermissionLoading, setRolePermissionLoading] = useState(false);
  const [rolePermissionSaving, setRolePermissionSaving] = useState(false);
  const [rolePermissionError, setRolePermissionError] = useState('');

  useEffect(() => {
    if (!teamId && teams.length > 0) setTeamId(String(Number(teams[0].id)));
    if (!editTeamId && teams.length > 0) setEditTeamId(String(Number(teams[0].id)));
  }, [teams, teamId, editTeamId]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        setRolePermissionLoading(true);
        setRolePermissionError('');
        const res = await pApi.employeeRolePagePermissions({
          tenantId: Number(permissionTenantId || 1),
          roleKey: activePermissionRole,
        });
        if (disposed) return;
        setRolePageModules((prev) => ({
          ...prev,
          [activePermissionRole]: Array.isArray(res.modules) ? res.modules : [],
        }));
        setRolePageEditable((prev) => ({
          ...prev,
          [activePermissionRole]: Boolean(res.editable),
        }));
      } catch (err: any) {
        if (disposed) return;
        setRolePermissionError(err?.message || ERROR_COPY.permissionConfigLoadFailed);
        setRolePageModules((prev) => ({ ...prev, [activePermissionRole]: [] }));
      } finally {
        if (!disposed) setRolePermissionLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [activePermissionRole, permissionTenantId]);

  const currentRolePageModules = rolePageModules[activePermissionRole] || [];
  const currentRoleEditable = Boolean(rolePageEditable[activePermissionRole]);
  const toggleRolePage = (pageId: string) => {
    if (!currentRoleEditable) return;
    setRolePageModules((prev) => ({
      ...prev,
      [activePermissionRole]: (prev[activePermissionRole] || []).map((group) => ({
        ...group,
        pages: (group.pages || []).map((page) =>
          String(page.pageId || '') === String(pageId || '') ? { ...page, enabled: !Boolean(page.enabled) } : page
        ),
      })),
    }));
  };
  const resetRolePages = () => {
    if (!currentRoleEditable) return;
    setRolePageModules((prev) => ({
      ...prev,
      [activePermissionRole]: (prev[activePermissionRole] || []).map((group) => ({
        ...group,
        pages: (group.pages || []).map((page) => ({ ...page, enabled: true })),
      })),
    }));
  };
  const saveRolePages = async () => {
    if (!currentRoleEditable) return;
    try {
      setRolePermissionSaving(true);
      setRolePermissionError('');
      const grants = currentRolePageModules.flatMap((group) =>
        (group.pages || []).map((page) => ({
          pageId: String(page.pageId || ''),
          enabled: Boolean(page.enabled),
        }))
      );
      await pApi.saveEmployeeRolePagePermissions({
        tenantId: Number(permissionTenantId || 1),
        roleKey: activePermissionRole,
        grants,
      });
      window.alert(NOTICE_COPY.permissionSaved);
    } catch (err: any) {
      setRolePermissionError(err?.message || ERROR_COPY.saveFailed);
    } finally {
      setRolePermissionSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
      {/* Header section */}
      <header className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">员工管理</h2>
            <p className="text-gray-500 text-sm mt-1">管理您的团队成员及其组织访问权限</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium hover:bg-gray-50 transition-all cursor-pointer">
              <Filter size={16} />
              {ACTION_COPY.filter}
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer"
            >
              <UserPlus size={16} />
              添加员工
            </button>
          </div>
        </div>
      </header>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Quick Stats */}
        {createdNotice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {createdNotice}
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500">总员工数</p>
            <p className="text-3xl font-black mt-1 text-gray-900 tracking-tight">{employees.length || 0}</p>
            <div className="mt-4 flex items-center text-xs text-green-600 font-medium">
              <TrendingUp size={14} className="mr-1" /> 本月 +4
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500">激活角色数</p>
            <p className="text-3xl font-black mt-1 text-gray-900 tracking-tight">{new Set(employees.map((e) => e.role || 'salesperson')).size || 0}</p>
            <div className="mt-4 flex items-center text-xs text-gray-500 font-medium">
              <ShieldAlert size={14} className="mr-1" /> 系统定义
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500">待处理邀请</p>
            <p className="text-3xl font-black mt-1 text-gray-900 tracking-tight">{employees.filter((e) => (e.status || '').includes('invite')).length}</p>
            <div className="mt-4 flex items-center text-xs text-amber-600 font-medium">
              <Clock size={14} className="mr-1" /> 即将过期
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">员工姓名</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">邮箱</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">手机号</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">角色</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">所属团队</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">最近活跃</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{row.email || row.account || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{row.mobile || row.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {employeeRoleLabel(row.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{teamLabel(row)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${(row.status || '').includes('invite') ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${(row.status || '').includes('invite') ? 'bg-amber-600' : 'bg-green-600'}`}></span>
                        {(row.status || '').includes('invite') ? '已邀请' : '在线'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.lastActiveAt ? String(row.lastActiveAt).slice(0, 16).replace('T', ' ') : '无'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={() => {
                            setSubmitError('');
                            setEditingEmployee(row);
                            setEditName(String(row.name || ''));
                            setEditEmail(String(row.email || row.account || ''));
                            setEditMobile(String(row.mobile || row.phone || ''));
                            setEditRole(String(row.role || 'salesperson'));
                            setEditTeamId(String(Number(row.teamId || 0) || Number(teams[0]?.id || 1)));
                          }}
                          className="text-blue-600 hover:text-blue-700 text-sm font-bold"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setDeletingEmployee(row)}
                          className="text-red-600 hover:text-red-700 text-sm font-bold"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                      暂无员工
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">团队管理</h3>
              <p className="text-sm text-gray-500 mt-1">支持新增、改名、删除（团队有员工时不可删）</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="输入新团队名称"
              className="w-full max-w-sm px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none"
            />
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
              disabled={submitting}
              onClick={async () => {
                const name = newTeamName.trim();
                if (!name) {
                  setSubmitError(VALIDATION_COPY.teamNameRequired);
                  return;
                }
                try {
                  setSubmitting(true);
                  setSubmitError('');
                  await onCreateTeam(name);
                  setNewTeamName('');
                } catch (err: any) {
                  setSubmitError(err?.message || ERROR_COPY.teamCreateFailed);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {ACTION_COPY.addTeam}
            </button>
          </div>
          <div className="space-y-2">
            {teams.map((team) => {
              const memberCount = employees.filter((e) => Number(e.teamId || 0) === Number(team.id)).length;
              const isEditing = Number(editingTeamId || 0) === Number(team.id);
              return (
                <div key={team.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <input
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-gray-800">{team.name}</span>
                    )}
                    <span className="text-xs text-gray-500">ID {team.id} · {memberCount} 人</span>
                  </div>
                  <div className="inline-flex items-center gap-3">
                    {isEditing ? (
                      <>
                        <button
                          className="text-blue-600 text-sm font-bold"
                          onClick={async () => {
                            const name = editingTeamName.trim();
                            if (!name) {
                              setSubmitError(VALIDATION_COPY.teamNameRequired);
                              return;
                            }
                            try {
                              setSubmitting(true);
                              setSubmitError('');
                              await onUpdateTeam(Number(team.id), name);
                              setEditingTeamId(null);
                              setEditingTeamName('');
                            } catch (err: any) {
                              setSubmitError(err?.message || ERROR_COPY.teamUpdateFailed);
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          保存
                        </button>
                        <button
                          className="text-gray-500 text-sm font-bold"
                          onClick={() => {
                            setEditingTeamId(null);
                            setEditingTeamName('');
                          }}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="text-blue-600 text-sm font-bold"
                          onClick={() => {
                            setEditingTeamId(Number(team.id));
                            setEditingTeamName(String(team.name || ''));
                          }}
                        >
                          修改
                        </button>
                        <button
                          className={`text-sm font-bold ${memberCount > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-red-600'}`}
                          disabled={memberCount > 0}
                          onClick={async () => {
                            try {
                              setSubmitting(true);
                              setSubmitError('');
                              await onDeleteTeam(Number(team.id));
                            } catch (err: any) {
                              setSubmitError(err?.message || ERROR_COPY.teamDeleteFailed);
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {teams.length === 0 ? <div className="text-sm text-gray-500">暂无团队，请先新增团队</div> : null}
          </div>
        </div>

        {/* Role-Based Access Control Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">基于角色的权限控制</h3>
              <p className="text-sm text-gray-500 mt-1">配置租户后台页面权限，当前用于 P 端左侧菜单控制</p>
            </div>
            <div className="flex bg-gray-200 p-1 rounded-lg">
              {ROLE_PAGE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActivePermissionRole(tab.key)}
                  className={`px-4 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                    activePermissionRole === tab.key ? 'font-bold bg-white text-gray-900 shadow-sm' : 'font-medium text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <span className="text-sm font-semibold text-gray-700">
                  正在编辑权限:
                  <span className="text-blue-600 font-bold ml-1">{ROLE_PAGE_TABS.find((x) => x.key === activePermissionRole)?.label}</span>
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  {currentRoleEditable ? '勾选后该角色可在 P 端看到对应左侧菜单页面。' : '公司管理员默认继承租户后台菜单，仅作为权限基线展示。'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-100">
                  数据权限：预留
                </span>
                <button
                  onClick={resetRolePages}
                  disabled={!currentRoleEditable || rolePermissionLoading || rolePermissionSaving}
                  className="text-blue-600 text-sm font-bold hover:underline cursor-pointer disabled:text-gray-300 disabled:no-underline"
                >
                  重置为默认
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {rolePermissionError ? (
                <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{rolePermissionError}</div>
              ) : null}
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">模块</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">页面访问</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rolePermissionLoading ? (
                    <tr>
                      <td className="px-6 py-8 text-sm text-gray-500" colSpan={3}>加载中...</td>
                    </tr>
                  ) : currentRolePageModules.map((group, groupIndex) => (
                    <React.Fragment key={`${group.group}-${groupIndex}`}>
                      <tr className="bg-gray-50">
                        <td className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400" colSpan={3}>
                          {group.group}
                        </td>
                      </tr>
                      {(group.pages || []).map((page) => (
                        <tr key={page.pageId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-sm text-gray-900">{page.pageName}</td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-600 cursor-pointer disabled:cursor-not-allowed"
                              checked={Boolean(page.enabled)}
                              disabled={!currentRoleEditable}
                              onChange={() => toggleRolePage(String(page.pageId || ''))}
                            />
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-gray-500">
                            {currentRoleEditable ? '仅控制左侧菜单显示' : '基线角色，默认全量可见'}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {!rolePermissionLoading && currentRolePageModules.length === 0 ? (
                    <tr>
                      <td className="px-6 py-8 text-sm text-gray-500" colSpan={3}>暂无可配置页面</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => void saveRolePages()}
                disabled={!currentRoleEditable || rolePermissionLoading || rolePermissionSaving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rolePermissionSaving ? '保存中...' : '保存页面权限'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">添加新员工</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">姓名</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all" 
                  placeholder="例如: 张三" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">工作邮箱</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all" 
                  placeholder="robert@company.com" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">手机号</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                  placeholder="请输入11位手机号"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">分配角色</label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none appearance-none transition-all cursor-pointer"
                  >
                    <option value="">选择一个角色...</option>
                    {EMPLOYEE_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">所属团队</label>
                <div className="relative">
                  <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none appearance-none transition-all cursor-pointer"
                  >
                    <option value="">请选择团队</option>
                    {teams.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</div>
              )}
              
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  员工将收到一封邀请邮件来设置密码。他们的访问权限将根据分配的角色进行限制。
                </p>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                disabled={submitting}
                onClick={async () => {
                  const resolvedTeamId = Number(teamId || 0);
                  const payload = { name: name.trim(), email: email.trim(), mobile: mobile.trim(), role: role || 'salesperson', teamId: resolvedTeamId };
                  if (!payload.name || !payload.email || !payload.mobile) {
                    setSubmitError(VALIDATION_COPY.employeeBaseInfoRequired);
                    return;
                  }
                  if (!isValidMobile(payload.mobile)) {
                    setSubmitError(VALIDATION_COPY.phoneInvalid11);
                    return;
                  }
                  if (!Number.isFinite(resolvedTeamId) || resolvedTeamId < 1) {
                    setSubmitError(VALIDATION_COPY.teamRequired);
                    return;
                  }
                  try {
                    setSubmitting(true);
                    setSubmitError('');
                    const initialPassword = await onCreateEmployee(payload);
                    setCreatedNotice(`账号已创建：${payload.email}，初始密码：${initialPassword}`);
                    setIsAddModalOpen(false);
                    setName('');
                    setEmail('');
                    setMobile('');
                    setRole('salesperson');
                    setTeamId(String(Number(teams[0]?.id || 0)));
                  } catch (err: any) {
                    setSubmitError(err?.message || ERROR_COPY.inviteFailed);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? '发送中...' : '发送邀请'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">编辑员工</h3>
              <button onClick={() => setEditingEmployee(null)} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">姓名</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">工作邮箱</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">手机号</label>
                <input
                  type="tel"
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">分配角色</label>
                <div className="relative">
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white appearance-none">
                    {EMPLOYEE_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">所属团队</label>
                <div className="relative">
                  <select
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white appearance-none"
                  >
                    <option value="">请选择团队</option>
                    {teams.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              {submitError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</div>}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setEditingEmployee(null)} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
                取消
              </button>
              <button
                disabled={submitting}
                onClick={async () => {
                  const payload = {
                    id: Number(editingEmployee.id || 0),
                    name: editName.trim(),
                    email: editEmail.trim(),
                    mobile: editMobile.trim(),
                    role: editRole || 'salesperson',
                    teamId: Number(editTeamId || 0),
                    status: String(editingEmployee.status || 'active'),
                  };
                  if (!payload.name || !payload.email || !payload.mobile) {
                    setSubmitError(VALIDATION_COPY.employeeBaseInfoRequired);
                    return;
                  }
                  if (!isValidMobile(payload.mobile)) {
                    setSubmitError(VALIDATION_COPY.phoneInvalid11);
                    return;
                  }
                  if (!Number.isFinite(payload.teamId) || payload.teamId < 1) {
                    setSubmitError(VALIDATION_COPY.teamRequired);
                    return;
                  }
                  try {
                    setSubmitting(true);
                    setSubmitError('');
                    await onUpdateEmployee(payload);
                    setEditingEmployee(null);
                  } catch (err: any) {
                    setSubmitError(err?.message || ERROR_COPY.employeeUpdateFailed);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deletingEmployee && (
        <ConfirmDialog
          open={true}
          title="删除员工"
          message={`确认删除员工「${deletingEmployee.name || deletingEmployee.id}」？`}
          onCancel={() => setDeletingEmployee(null)}
          onConfirm={() => {
            void (async () => {
              try {
                await onDeleteEmployee(Number(deletingEmployee.id || 0));
                setDeletingEmployee(null);
              } catch (err: any) {
                showApiError(err, ERROR_COPY.employeeDeleteFailed);
              }
            })();
          }}
        />
      )}
    </div>
  );
};

const TagRules = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [list, setList] = useState<PTagRule[]>([]);
  const [tags, setTags] = useState<PTag[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<TagStatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<PTagRuleJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [jobLogs, setJobLogs] = useState<PTagRuleJobLog[]>([]);
  const [editing, setEditing] = useState<PTagRule | null>(null);
  const defaultCondition = { category: 'customer_attribute', metric: 'annual_income', cmp: '>=', value: '500000' };
  const metricOptions: Record<string, Array<{ value: string; label: string }>> = {
    customer_attribute: [
      { value: 'age', label: '年龄' },
      { value: 'gender', label: '性别' },
      { value: 'annual_income', label: '年收入' },
      { value: 'member_level', label: '会员等级' },
    ],
    customer_behavior: [
      { value: 'renew_intent_score', label: '续保意向分' },
      { value: 'login_days_30d', label: '30天登录天数(C端)' },
      { value: 'login_count_30d_c', label: '30天登录次数(C端)' },
      { value: 'login_count_30d_b', label: '30天登录次数(B端)' },
      { value: 'sign_count_30d', label: '30天签到次数(C端)' },
      { value: 'sign_days_30d', label: '30天签到天数(C端)' },
      { value: 'premium_12m', label: '近12个月保费' },
    ],
  };
  const [logicOp, setLogicOp] = useState<'and' | 'or'>('and');
  const [conditions, setConditions] = useState<Array<{ category: string; metric: string; cmp: string; value: string }>>([defaultCondition]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagCandidateId, setTagCandidateId] = useState('');
  const [outputMode, setOutputMode] = useState<'const' | 'map'>('const');
  const [outputValue, setOutputValue] = useState('高价值');
  const [mapSourceMetric, setMapSourceMetric] = useState('annual_income');
  const [mapRules, setMapRules] = useState<Array<{ cmp: string; value: string; output: string }>>([
    { cmp: '>=', value: '500000', output: '高价值' },
  ]);
  const [mapDefaultValue, setMapDefaultValue] = useState('普通');
  const [form, setForm] = useState({
    ruleName: '',
    ruleCode: '',
    priority: '100',
    status: 'draft' as 'draft' | 'active' | 'disabled',
  });
  const metricCategoryOptions = [
    { value: 'customer_attribute', label: '客户属性' },
    { value: 'customer_behavior', label: '客户行为' },
  ];
  const attributeMetrics = new Set(metricOptions.customer_attribute.map((item) => item.value));

  const reload = async () => {
    try {
      setLoading(true);
      setError('');
      const [tagsRes, rulesRes] = await Promise.all([
        pApi.tags({ page: 1, pageSize: 200 }),
        pApi.tagRules({ query: query.trim() || undefined, status: status === 'all' ? undefined : status, page: 1, pageSize: 200 }),
      ]);
      setTags(tagsRes.list || []);
      setList(rulesRes.list || []);
      const jobsRes = await pApi.tagRuleJobs({ page: 1, pageSize: 20 });
      setJobs(jobsRes.list || []);
    } catch (err: any) {
      setError(err?.message || ERROR_COPY.tagRuleLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [query, status]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ruleName: '',
      ruleCode: `RULE_${Date.now()}`,
      priority: '100',
      status: 'draft',
    });
    setLogicOp('and');
    setConditions([{ ...defaultCondition }]);
    setSelectedTagIds([]);
    setTagCandidateId('');
    setOutputMode('const');
    setOutputValue('高价值');
    setMapSourceMetric('annual_income');
    setMapRules([{ cmp: '>=', value: '500000', output: '高价值' }]);
    setMapDefaultValue('普通');
    setIsDrawerOpen(true);
  };

  const openEdit = (item: PTagRule) => {
    const condDsl: any = item.conditionDsl || { op: 'and', children: [] };
    const condRows = Array.isArray(condDsl.children) && condDsl.children.length
      ? condDsl.children.map((x: any) => ({
          category:
            String(x?.category || '').trim() === 'customer_attribute' || String(x?.category || '').trim() === 'customer_behavior'
              ? String(x?.category || '').trim()
              : attributeMetrics.has(String(x?.metric || '').trim())
                ? 'customer_attribute'
                : 'customer_behavior',
          metric: String(x?.metric || '').trim() || 'premium_12m',
          cmp: String(x?.cmp || '>='),
          value: String(x?.value ?? ''),
        }))
      : [{ ...defaultCondition }];
    const outExpr: any = item.outputExpr || { mode: 'const', value: '' };
    setEditing(item);
    setForm({
      ruleName: item.ruleName || '',
      ruleCode: item.ruleCode || '',
      priority: String(item.priority || 100),
      status: (item.status as any) || 'draft',
    });
    setLogicOp(String(condDsl.op || 'and').toLowerCase() === 'or' ? 'or' : 'and');
    setConditions(condRows);
    setOutputMode(String(outExpr.mode || 'const').toLowerCase() === 'map' ? 'map' : 'const');
    setOutputValue(String(outExpr.value ?? ''));
    const sourceMetric = String(outExpr.sourceMetric || outExpr.source || outExpr.metric || '').trim();
    const sourceMetricResolved = sourceMetric || 'annual_income';
    setMapSourceMetric(sourceMetricResolved);
    const mapRowsRaw = Array.isArray(outExpr.mappings) ? outExpr.mappings : [];
    const nextMapRules = mapRowsRaw.length
      ? mapRowsRaw.map((x: any) => ({
          cmp: String(x?.cmp || '>='),
          value: String(x?.value ?? ''),
          output: String(x?.output ?? x?.label ?? ''),
        }))
      : [{ cmp: '>=', value: '500000', output: '高价值' }];
    setMapRules(nextMapRules);
    setMapDefaultValue(String(outExpr.defaultValue ?? ''));
    const ids = Array.isArray((item as any).targetTagIds) && (item as any).targetTagIds.length
      ? (item as any).targetTagIds.map((x: any) => Number(x || 0)).filter((x: number) => x > 0)
      : item.targetTagId > 0
        ? [Number(item.targetTagId)]
        : [];
    setSelectedTagIds(ids);
    setTagCandidateId('');
    setIsDrawerOpen(true);
  };

  const saveRule = async () => {
    try {
      if (!selectedTagIds.length) {
        window.alert(VALIDATION_COPY.tagRuleTargetRequired);
        return;
      }
      const conditionDsl = {
        op: logicOp,
        children: conditions
          .map((c) => ({
            category: String(c.category || '').trim(),
            metric: String(c.metric || '').trim(),
            cmp: String(c.cmp || '').trim(),
            value: Number.isFinite(Number(c.value)) && String(c.value).trim() !== '' ? Number(c.value) : String(c.value || '').trim(),
          }))
          .filter((c) => c.metric && c.cmp),
      };
      const outputExpr = outputMode === 'const'
        ? { mode: 'const', value: String(outputValue || '').trim() }
        : {
            mode: 'map',
            sourceMetric: String(mapSourceMetric || '').trim(),
            mappings: mapRules
              .map((x) => ({
                cmp: String(x.cmp || '').trim(),
                value: Number.isFinite(Number(x.value)) && String(x.value).trim() !== '' ? Number(x.value) : String(x.value || '').trim(),
                output: String(x.output || '').trim(),
              }))
              .filter((x) => x.cmp && x.output),
            defaultValue: String(mapDefaultValue || '').trim(),
          };
      await pApi.saveTagRule({
        id: editing?.id,
        ruleName: form.ruleName.trim(),
        ruleCode: form.ruleCode.trim(),
        targetTagId: selectedTagIds[0],
        targetTagIds: selectedTagIds,
        priority: Number(form.priority || 100),
        status: form.status,
        conditionDsl,
        outputExpr,
      });
      setIsDrawerOpen(false);
      await reload();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagRuleSaveFailed);
    }
  };

  const removeRule = async (row: PTagRule) => {
    if (!window.confirm(`确认删除规则「${row.ruleName}」？`)) return;
    try {
      await pApi.deleteTagRule(Number(row.id));
      await reload();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagRuleDeleteFailed);
    }
  };

  const toggleStatus = async (row: PTagRule) => {
    const nextStatus = row.status === 'active' ? 'disabled' : 'active';
    try {
      await pApi.setTagRuleStatus(Number(row.id), nextStatus as any);
      await reload();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagToggleFailed);
    }
  };

  const runRule = async (row: PTagRule) => {
    try {
      await pApi.createTagRuleJob({ jobType: 'delta', triggerType: 'manual', targetRuleIds: [Number(row.id)] });
      await reload();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagRuleRunFailed);
    }
  };

  const loadJobLogs = async (jobId: number) => {
    try {
      setSelectedJobId(jobId);
      const res = await pApi.tagRuleJobLogs(jobId, { page: 1, pageSize: 50 });
      setJobLogs(res.list || []);
    } catch (err: any) {
      showApiError(err, ERROR_COPY.tagRuleLogLoadFailed);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">标签规则库</h2>
          <span className="text-gray-300">|</span>
          <nav className="flex text-sm">
            <ol className="flex items-center gap-2 text-gray-500">
              <li>营销策略</li>
              <ChevronRight size={14} />
              <li className="text-blue-600 font-medium">标签规则库</li>
            </ol>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
            <Bell size={20} />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
            <HelpCircle size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">总规则数</p>
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <Database size={20} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl font-bold text-gray-900 leading-none">1,284</h3>
              <span className="text-green-600 text-xs font-bold mb-1 flex items-center gap-1">
                <TrendingUp size={12} /> 12%
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">较上月新增 142 条规则</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">今日生效中</p>
              <div className="bg-green-50 p-2 rounded-lg text-green-600">
                <Verified size={20} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <h3 className="text-3xl font-bold text-gray-900 leading-none">856</h3>
              <span className="text-green-600 text-xs font-bold mb-1 flex items-center gap-1">
                <TrendingUp size={12} /> 5%
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">占规则总数的 66.7%</p>
          </div>
        </div>

        {/* Table Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="relative w-full max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text" 
                placeholder="搜索规则名称、编码或创建人" 
                className="block w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm transition-all outline-none"
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="px-3 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm">
                {TAG_STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            <button 
              onClick={openCreate}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus size={18} />
              {ACTION_COPY.createRule}
            </button>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">规则名称</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">生效状态</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">优先级</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{rule.ruleName}</span>
                        <span className="text-xs text-gray-500 mt-0.5">{rule.ruleCode}</span>
                        <span className="text-xs text-gray-400 mt-0.5">
                          目标标签：{(Array.isArray(rule.targetTagNames) && rule.targetTagNames.length ? rule.targetTagNames : [rule.targetTagName]).filter(Boolean).join('、') || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={rule.status === 'active'} readOnly />
                          <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <span className={`text-xs font-medium ${tagRuleStatusTextClass(rule.status)}`}>
                          {tagRuleStatusLabel(rule.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        Number(rule.priority || 100) <= 10 ? 'bg-red-100 text-red-700' :
                        Number(rule.priority || 100) <= 50 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        P{Number(rule.priority || 100)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{String(rule.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(rule)} className="text-blue-600 hover:text-blue-800 text-sm font-bold p-1 cursor-pointer transition-colors">编辑</button>
                        <button onClick={() => void runRule(rule)} className="text-emerald-600 hover:text-emerald-700 text-sm font-bold p-1 cursor-pointer transition-colors">执行</button>
                        <button onClick={() => void toggleStatus(rule)} className="text-indigo-600 hover:text-indigo-700 text-sm font-bold p-1 cursor-pointer transition-colors">{tagToggleActionLabel(rule.status)}</button>
                        <button onClick={() => void removeRule(rule)} className="text-red-500 hover:text-red-600 text-sm font-bold p-1 cursor-pointer transition-colors">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && list.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">暂无规则数据</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">加载中...</td></tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <p className="text-xs text-gray-500">显示 1 到 4 共 1284 条记录</p>
            <div className="flex items-center gap-1">
              <button className="p-1 rounded border border-gray-200 hover:bg-white text-gray-400 disabled:opacity-50 cursor-not-allowed" disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-bold cursor-pointer">1</button>
              <button className="px-3 py-1 rounded border border-gray-200 hover:bg-white text-xs text-gray-600 cursor-pointer">2</button>
              <button className="px-3 py-1 rounded border border-gray-200 hover:bg-white text-xs text-gray-600 cursor-pointer">3</button>
              <span className="px-2 text-gray-400">...</span>
              <button className="px-3 py-1 rounded border border-gray-200 hover:bg-white text-xs text-gray-600 cursor-pointer">321</button>
              <button className="p-1 rounded border border-gray-200 hover:bg-white text-gray-500 cursor-pointer">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">规则执行任务</h3>
            <button onClick={() => void reload()} className="text-xs text-blue-600 font-semibold">{ACTION_COPY.refresh}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-xs text-gray-500">任务ID</th>
                  <th className="py-2 text-xs text-gray-500">状态</th>
                  <th className="py-2 text-xs text-gray-500">规则数</th>
                  <th className="py-2 text-xs text-gray-500">客户数</th>
                  <th className="py-2 text-xs text-gray-500">创建时间</th>
                  <th className="py-2 text-xs text-gray-500 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-gray-50">
                    <td className="py-2 text-sm text-gray-800">#{job.id}</td>
                    <td className="py-2 text-sm text-gray-700">{job.status}</td>
                    <td className="py-2 text-sm text-gray-700">{(job.targetRuleIds || []).length}</td>
                    <td className="py-2 text-sm text-gray-700">{job.successCustomers}/{job.totalCustomers}</td>
                    <td className="py-2 text-sm text-gray-500">{String(job.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => void loadJobLogs(Number(job.id))} className="text-blue-600 text-sm font-semibold">日志</button>
                    </td>
                  </tr>
                ))}
                {!jobs.length && <tr><td colSpan={6} className="py-4 text-sm text-gray-500 text-center">暂无执行任务</td></tr>}
              </tbody>
            </table>
          </div>
          {selectedJobId ? (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <h4 className="text-xs font-bold text-gray-700 mb-2">任务 #{selectedJobId} 执行日志</h4>
              <div className="max-h-52 overflow-auto space-y-1">
                {jobLogs.map((log) => (
                  <div key={log.id} className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1">
                    客户{log.customerId} / 规则{log.ruleId} / {log.result}{log.outputValue ? ` / ${log.outputValue}` : ''}
                  </div>
                ))}
                {!jobLogs.length && <div className="text-xs text-gray-500">暂无日志</div>}
              </div>
            </div>
          ) : null}
        </div>
        {error ? <div className="text-xs text-red-600 mt-3">{error}</div> : null}
      </div>

      {/* Overlay */}
      {isDrawerOpen && (
        <div 
          className="absolute inset-0 bg-black/20 z-10 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Configuration Drawer */}
      <div className={`absolute inset-y-0 right-0 w-[500px] bg-white shadow-2xl border-l border-gray-200 flex flex-col z-20 transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">新建标签规则</h2>
            <p className="text-xs text-gray-500 mt-1">通过可视化逻辑定义自动化打标规则</p>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Rule Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">规则名称</label>
                    <input
                      value={form.ruleName}
                      onChange={(e) => setForm((prev) => ({ ...prev, ruleName: e.target.value }))}
                      type="text" 
                      className="w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 px-3 py-2 outline-none transition-all" 
                      placeholder="例如：新晋高频交易客户" 
                    />
                  </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">优先级</label>
                <div className="relative">
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 px-3 py-2 appearance-none outline-none transition-all cursor-pointer"
                  >
                    <option value="10">P10 (最高)</option>
                    <option value="50">P50</option>
                    <option value="100">P100</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">规则状态</label>
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as any }))}
                    className="w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 px-3 py-2 appearance-none outline-none transition-all cursor-pointer"
                  >
                    {TAG_RULE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Visual Logic Builder */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-900">
              <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[10px]">1</span>
              规则逻辑配置
            </h3>
            
            <div className="space-y-4">
              {/* IF Block */}
              <div className="relative pl-6 before:absolute before:left-0 before:top-4 before:bottom-4 before:w-0.5 before:bg-blue-100">
                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 relative">
                  <div className="absolute -left-3 top-2 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">IF 如果</div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">条件关系</span>
                      <select
                        value={logicOp}
                        onChange={(e) => setLogicOp(e.target.value as 'and' | 'or')}
                        className="border border-gray-200 bg-white rounded text-xs py-1.5 px-2"
                      >
                        <option value="and">AND 且</option>
                        <option value="or">OR 或</option>
                      </select>
                    </div>
                    {conditions.map((cond, idx) => (
                      <div key={`cond-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                        <span className="col-span-1 text-xs font-semibold text-gray-500">{idx === 0 ? 'IF' : logicOp.toUpperCase()}</span>
                        <select
                          value={cond.category}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((x, i) => {
                                if (i !== idx) return x;
                                const nextCategory = e.target.value === 'customer_attribute' ? 'customer_attribute' : 'customer_behavior';
                                const firstMetric = metricOptions[nextCategory][0]?.value || '';
                                return { ...x, category: nextCategory, metric: firstMetric };
                              })
                            )
                          }
                          className="col-span-3 border border-gray-200 bg-white rounded text-xs py-1.5 px-2"
                        >
                          {metricCategoryOptions.map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        <select
                          value={cond.metric}
                          onChange={(e) =>
                            setConditions((prev) => prev.map((x, i) => (i === idx ? { ...x, metric: e.target.value } : x)))
                          }
                          className="col-span-3 border border-gray-200 bg-white rounded text-xs py-1.5 px-2"
                        >
                          {(metricOptions[cond.category] || []).map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        <select
                          value={cond.cmp}
                          onChange={(e) =>
                            setConditions((prev) => prev.map((x, i) => (i === idx ? { ...x, cmp: e.target.value } : x)))
                          }
                          className="col-span-2 border border-gray-200 bg-white rounded text-xs py-1.5 px-2"
                        >
                          <option value=">=">{'>='}</option>
                          <option value="<=">{'<='}</option>
                          <option value=">">{'>'}</option>
                          <option value="<">{'<'}</option>
                          <option value="=">=</option>
                          <option value="!=">!=</option>
                        </select>
                        <input
                          value={cond.value}
                          onChange={(e) =>
                            setConditions((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))
                          }
                          className="col-span-2 border border-gray-200 bg-white rounded text-xs py-1.5 px-2"
                          placeholder="阈值"
                        />
                        <button
                          onClick={() =>
                            setConditions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
                          }
                          className="col-span-1 text-gray-400 hover:text-red-500"
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setConditions((prev) => [...prev, { ...defaultCondition }])}
                      type="button"
                      className="text-xs text-blue-600 font-semibold flex items-center gap-1"
                    >
                      <Plus size={14} />
                      添加条件
                    </button>
                  </div>
                </div>
              </div>

              {/* THEN Block */}
              <div className="relative pl-6">
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 relative">
                  <div className="absolute -left-3 top-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">THEN 则</div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={tagCandidateId}
                        onChange={(e) => setTagCandidateId(e.target.value)}
                        className="border border-gray-200 bg-white rounded text-xs py-1.5 px-2 focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                      >
                        <option value="">选择目标标签</option>
                        {tags.map((t) => (
                          <option key={t.id} value={t.id}>{t.tagName}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const id = Number(tagCandidateId || 0);
                          if (!id) return;
                          setSelectedTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                        }}
                        className="px-2 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        添加标签
                      </button>
                    </div>
                    <div className="min-h-12 border border-gray-200 bg-white rounded p-2 flex flex-wrap gap-2">
                      {selectedTagIds.length ? (
                        selectedTagIds.map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 px-2 py-1 text-xs font-semibold">
                            {tags.find((t) => Number(t.id) === Number(id))?.tagName || `标签#${id}`}
                            <button
                              type="button"
                              onClick={() => setSelectedTagIds((prev) => prev.filter((x) => x !== id))}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">请选择一个或多个标签，命中规则后将打上这些标签</span>
                      )}
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        {outputMode === 'const' ? (
                          <textarea
                            value={outputValue}
                            onChange={(e) => setOutputValue(e.target.value)}
                            className="w-full min-h-20 border border-gray-200 bg-white rounded text-xs py-2 px-2 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            placeholder="标签口径输出值，如：高价值"
                          />
                        ) : (
                          <div className="border border-gray-200 bg-white rounded p-2 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-xs text-gray-500 leading-7">映射来源字段</span>
                              <select
                                value={mapSourceMetric}
                                onChange={(e) => setMapSourceMetric(e.target.value)}
                                className="col-span-2 border border-gray-200 rounded text-xs py-1.5 px-2"
                              >
                                {Object.entries(metricOptions).flatMap(([group, list]) =>
                                  list.map((item) => (
                                    <option key={`${group}-${item.value}`} value={item.value}>{item.label}</option>
                                  ))
                                )}
                              </select>
                            </div>
                            {mapRules.map((row, idx) => (
                              <div key={`map-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                                <span className="col-span-2 text-[11px] text-gray-500">{idx + 1}</span>
                                <select
                                  value={row.cmp}
                                  onChange={(e) => setMapRules((prev) => prev.map((x, i) => (i === idx ? { ...x, cmp: e.target.value } : x)))}
                                  className="col-span-2 border border-gray-200 rounded text-xs py-1.5 px-2"
                                >
                                  <option value=">=">{'>='}</option>
                                  <option value=">">{'>'}</option>
                                  <option value="<=">{'<='}</option>
                                  <option value="<">{'<'}</option>
                                  <option value="=">=</option>
                                  <option value="!=">!=</option>
                                </select>
                                <input
                                  value={row.value}
                                  onChange={(e) => setMapRules((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                                  className="col-span-3 border border-gray-200 rounded text-xs py-1.5 px-2"
                                  placeholder="条件值"
                                />
                                <input
                                  value={row.output}
                                  onChange={(e) => setMapRules((prev) => prev.map((x, i) => (i === idx ? { ...x, output: e.target.value } : x)))}
                                  className="col-span-4 border border-gray-200 rounded text-xs py-1.5 px-2"
                                  placeholder="枚举输出值"
                                />
                                <button
                                  type="button"
                                  onClick={() => setMapRules((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))}
                                  className="col-span-1 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <div className="grid grid-cols-12 gap-2 items-center">
                              <button
                                type="button"
                                onClick={() => setMapRules((prev) => [...prev, { cmp: '>=', value: '', output: '' }])}
                                className="col-span-3 text-xs text-blue-600 font-semibold flex items-center gap-1"
                              >
                                <Plus size={13} />
                                新增映射
                              </button>
                              <span className="col-span-2 text-xs text-gray-500">默认值</span>
                              <input
                                value={mapDefaultValue}
                                onChange={(e) => setMapDefaultValue(e.target.value)}
                                className="col-span-7 border border-gray-200 rounded text-xs py-1.5 px-2"
                                placeholder="未命中映射时写入"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <select
                        value={outputMode}
                        onChange={(e) => setOutputMode(e.target.value as 'const' | 'map')}
                        className="border border-gray-200 bg-white rounded text-xs py-1.5 px-2"
                      >
                        <option value="const">固定值</option>
                        <option value="map">映射值</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scope Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-900">
              <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[10px]">2</span>
              生效范围设置
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex gap-6 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="scope" className="text-blue-600 focus:ring-blue-600 cursor-pointer" defaultChecked />
                  <span className="text-xs font-medium text-gray-700">全部公司</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="scope" className="text-blue-600 focus:ring-blue-600 cursor-pointer" />
                  <span className="text-xs font-medium text-gray-700">特定租户/子公司</span>
                </label>
              </div>
              
              <div className="space-y-2 opacity-50 pointer-events-none">
                <label className="block text-[10px] text-gray-500 font-bold uppercase">选择生效租户</label>
                <div className="w-full h-10 border border-gray-200 bg-white rounded-lg flex items-center px-3 justify-between">
                  <span className="text-xs text-gray-400">选择一个或多个租户...</span>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-gray-700"
          >
            取消
          </button>
          <button onClick={() => void saveRule()} className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all cursor-pointer">
            保存规则
          </button>
        </div>
      </div>
    </div>
  );
};

const LearningMaterials = ({
  onCreate,
  canCreate,
  onNoPermission,
  onOpenDetail,
  onEdit,
  onDelete,
  onMove,
  onBatchDelete,
  list,
  session,
  movingLearningId,
}: {
  onCreate: () => void;
  canCreate: boolean;
  onNoPermission: () => void;
  onOpenDetail: (item: any) => void;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onMove: (sourceId: number, targetId: number) => Promise<void> | void;
  onBatchDelete: (items: any[]) => Promise<{ confirmed: boolean; deletedCount: number }>;
  list: Array<any>;
  session: PLoginSession;
  movingLearningId: number | null;
}) => {
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'article'>('all');
  const [page, setPage] = useState(1);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const pageSize = 8;
  const sessionName = String(session?.name || session?.account || '当前账号');
  const sessionRoleLabel = getSessionRoleLabel(session?.role);
  const avatarText = getAvatarText(sessionName);
  const filteredList = list.filter((item) => {
    const q = searchText.trim().toLowerCase();
    const keywordPass =
      !q ||
      String(item.title).toLowerCase().includes(q) ||
      String(item.category).toLowerCase().includes(q) ||
      String(item.templateTag || '').toLowerCase().includes(q) ||
      (item.tags || []).some((tag: string) => String(tag).toLowerCase().includes(q));
    const typePass =
      typeFilter === 'all'
        ? true
        : typeFilter === 'video'
          ? item.type === '视频'
          : item.type === '文章';
    return keywordPass && typePass;
  });
  useEffect(() => {
    setPage(1);
  }, [searchText, typeFilter, list.length]);
  useEffect(() => {
    setSelectedIds((prev) => pruneLearningSelection(prev, list.map((item) => Number(item?.id || 0))));
  }, [list]);
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageList = filteredList.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = pageList.map((item) => Number(item?.id || 0)).filter((id) => Number.isInteger(id) && id > 0);
  const selectedIdSet = new Set(selectedIds);
  const selectedItems = list.filter((item) => selectedIdSet.has(Number(item?.id || 0)));
  const selectedCount = selectedItems.length;
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIdSet.has(id));
  const startNo = filteredList.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endNo = Math.min(safePage * pageSize, filteredList.length);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5);
  const videoCount = list.filter((item) => item.type === '视频').length;
  const articleCount = list.filter((item) => item.type === '文章').length;
  const exitBatchDeleteMode = () => {
    setIsSelecting(false);
    setSelectedIds([]);
  };
  const handleBatchDeleteClick = async () => {
    const action = resolveBatchDeleteAction({ isSelecting, selectedCount });
    if (action === 'enter-select') {
      setIsSelecting(true);
      return;
    }
    if (action === 'idle-select') {
      window.alert('请先勾选要删除的资料');
      return;
    }
    const result = await onBatchDelete(selectedItems);
    if (result.confirmed && result.deletedCount > 0) {
      exitBatchDeleteMode();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">知识学习</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索资料名称、知识点..." 
              className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-600/50 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{sessionName}</p>
              <p className="text-[10px] text-gray-500">{sessionRoleLabel}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center overflow-hidden text-sm font-bold text-blue-700">
              {avatarText}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Summary Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <BookOpen size={28} />
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">课程总数</p>
              <h3 className="text-2xl font-bold mt-0.5 text-gray-900">{list.length}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <PlayCircle size={28} />
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">视频课程数</p>
              <h3 className="text-2xl font-bold mt-0.5 text-gray-900">{videoCount}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
              <Star size={28} />
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">文章资料数</p>
              <h3 className="text-2xl font-bold mt-0.5 text-gray-900">{articleCount}</h3>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-start gap-3">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-blue-700">{TEMPLATE_DELIVERY_RULE_NOTE}</p>
        </section>

        {/* Filter Controls */}
        <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">资料类型:</span>
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium cursor-pointer ${typeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            >
              全部
            </button>
            <button
              onClick={() => setTypeFilter('video')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors cursor-pointer ${typeFilter === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            >
              视频
            </button>
            <button
              onClick={() => setTypeFilter('article')}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors cursor-pointer ${typeFilter === 'article' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            >
              文章
            </button>
          </div>
          <div className="h-8 w-px bg-gray-200 mx-2"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">难度分级:</span>
            <div className="relative">
              <select className="bg-gray-100 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-600/50 cursor-pointer pl-4 pr-8 py-1.5 appearance-none outline-none text-gray-700">
                <option>全部难度</option>
                <option>初级</option>
                <option>中级</option>
                <option>高级</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <div className="h-8 w-px bg-gray-200 mx-2"></div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">资料分类:</span>
            <div className="relative">
              <select className="bg-gray-100 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-600/50 cursor-pointer pl-4 pr-8 py-1.5 appearance-none outline-none text-gray-700">
                <option>全部领域</option>
                <option>寿险产品</option>
                <option>财险产品</option>
                <option>理赔流程</option>
                <option>销售技巧</option>
                <option>合规培训</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {isSelecting ? (
              <button
                onClick={() => setSelectedIds((prev) => togglePageLearningSelection(prev, pageIds))}
                disabled={pageIds.length === 0}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pageIds.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer'}`}
              >
                {allPageSelected ? '取消本页全选' : '全选本页'}
              </button>
            ) : null}
            {isSelecting ? (
              <button
                onClick={exitBatchDeleteMode}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                取消
              </button>
            ) : null}
            <button
              onClick={() => void handleBatchDeleteClick()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <Trash2 size={16} />
              批量删除{isSelecting && selectedCount > 0 ? ` (${selectedCount})` : ''}
            </button>
            <button
              onClick={() => {
                if (!canCreate) return onNoPermission();
                return onCreate();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Upload size={16} />
              新增
            </button>
            <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer">
              <ListIcon size={20} />
            </button>
          </div>
        </section>

        {/* Material Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {pageList.map((item, idx) => {
            const itemId = Number(item?.id || 0);
            const isSelected = isSelecting && selectedIdSet.has(itemId);
            const filteredIndex = filteredList.findIndex((row) => Number(row?.id || 0) === itemId);
            const prevItem = filteredIndex > 0 ? filteredList[filteredIndex - 1] : null;
            const nextItem = filteredIndex >= 0 && filteredIndex < filteredList.length - 1 ? filteredList[filteredIndex + 1] : null;
            const isMoving = movingLearningId === itemId;
            return (
            <div
              key={itemId || idx}
              className={`bg-white rounded-xl overflow-hidden group shadow-sm hover:shadow-md transition-all flex flex-col ${isSelected ? 'border-2 border-blue-500' : 'border border-gray-200'}`}
            >
              <div className="relative aspect-video bg-gray-200 shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
                {isSelecting ? (
                  <label className="absolute top-3 right-3 z-30 flex items-center justify-center w-6 h-6 rounded-md bg-white/95 shadow-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedIds((prev) => toggleLearningSelection(prev, itemId))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                ) : null}
                {item.image ? (
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                    未上传封面
                  </div>
                )}

                <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded z-20 ${contentStatusSoftPillClass(item.status)}`}>
                  {toContentStatusLabel(item.status)}
                </span>
                <span className="absolute top-3 right-3 z-20 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-gray-700 shadow-sm">
                  排序 {formatDisplaySortOrder(item.sortOrder)}
                </span>
                
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  {item.type === '视频' ? (
                    <PlayCircle size={48} className="text-white drop-shadow-lg" />
                  ) : (
                    <FileText size={48} className="text-white drop-shadow-lg" />
                  )}
                </div>
                
                {item.type === '视频' ? (
                  <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded z-20">
                    {item.duration || '视频'}
                  </span>
                ) : (
                  <span className="absolute bottom-2 right-2 bg-blue-600/80 text-white text-[10px] px-1.5 py-0.5 rounded font-bold z-20">
                    文章
                  </span>
                )}
              </div>
              
              <div className="p-4 space-y-3 flex-1 flex flex-col">
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-sm line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors text-gray-900">
                    {item.title}
                  </h4>
                </div>
                {item.isPlatformTemplate ? (
                  <div>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                      {item.templateTag || '平台模板'}
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                  <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded">
                    {item.difficulty}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100 mt-auto">
                  <p className="text-[11px] text-gray-400 font-medium mb-1 flex items-center gap-1">
                    <Tag size={12} />
                    关联知识点
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="text-[10px] text-gray-500">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="border-t border-gray-100 p-2 space-y-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canCreate) return onNoPermission();
                      if (!prevItem || isMoving) return;
                      void onMove(itemId, Number(prevItem?.id || 0));
                    }}
                    disabled={!prevItem || isMoving}
                    className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      !prevItem || isMoving
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                        : 'cursor-pointer border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                    aria-label={`上移资料 ${item.title}`}
                  >
                    <ChevronUp size={14} />
                    上移
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canCreate) return onNoPermission();
                      if (!nextItem || isMoving) return;
                      void onMove(itemId, Number(nextItem?.id || 0));
                    }}
                    disabled={!nextItem || isMoving}
                    className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      !nextItem || isMoving
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300'
                        : 'cursor-pointer border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                    aria-label={`下移资料 ${item.title}`}
                  >
                    <ChevronDown size={14} />
                    下移
                  </button>
                </div>
                <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(item)}
                  className="flex-1 py-1.5 hover:bg-gray-50 rounded text-xs font-semibold text-gray-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit size={14} />
                  编辑
                </button>
                <button onClick={() => onOpenDetail(item)} className="flex-1 py-1.5 hover:bg-gray-50 rounded text-xs font-semibold text-gray-600 transition-colors flex items-center justify-center gap-1 cursor-pointer">
                  <Eye size={14} />
                  查看
                </button>
                <button onClick={() => onDelete(item)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer">
                  <Trash2 size={16} />
                </button>
                </div>
              </div>
            </div>
            );
          })}
          {filteredList.length === 0 ? (
            <div className="col-span-full text-center text-sm text-gray-500 py-10">暂无匹配资料</div>
          ) : null}
        </section>

        {/* Pagination */}
        <footer className="flex items-center justify-between pt-4 pb-8">
          <p className="text-xs text-gray-500">显示 {startNo} 到 {endNo} 项，共 {filteredList.length} 项</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors text-gray-500 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 rounded text-xs font-bold cursor-pointer ${safePage === n ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-blue-50 text-gray-700 transition-colors'}`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors text-gray-500 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const CreateLearningMaterial = ({
  onBack,
  onSubmit,
  mode = 'create',
  initialValues,
}: {
  onBack: () => void;
  onSubmit: (payload: {
    title: string;
    category: string;
    points: number;
    contentType: string;
    sourceType: 'native' | 'video_channel';
    videoChannelMeta: {
      finderUserName?: string;
      feedToken?: string;
      feedId?: string;
      nonceId?: string;
      miniProgramAppId?: string;
      miniProgramPath?: string;
      miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
      coverUrl?: string;
    } | null;
    level: string;
    content: string;
    status: 'published' | 'draft' | 'inactive';
    coverUrl?: string;
    media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
  }) => Promise<void>;
  mode?: 'create' | 'edit';
  initialValues?: {
    title?: string;
    category?: string;
    points?: number;
    contentType?: string;
    sourceType?: string;
    videoChannelMeta?: {
      finderUserName?: string;
      feedToken?: string;
      feedId?: string;
      nonceId?: string;
      miniProgramAppId?: string;
      miniProgramPath?: string;
      miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
      coverUrl?: string;
    } | null;
    level?: string;
    content?: string;
    status?: string;
    coverUrl?: string;
    media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
  } | null;
}) => {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [points, setPoints] = useState(Number(initialValues?.points || 50));
  const [content, setContent] = useState(initialValues?.content || '');
  const [contentType, setContentType] = useState<'video' | 'article'>(
    String(initialValues?.contentType || 'video') === 'article' ? 'article' : 'video'
  );
  const [sourceType, setSourceType] = useState<'native' | 'video_channel'>(
    String(initialValues?.sourceType || 'native') === 'video_channel' ? 'video_channel' : 'native'
  );
  const [videoChannelTarget, setVideoChannelTarget] = useState<VideoChannelLaunchTarget>(
    resolveVideoChannelLaunchTarget(initialValues?.videoChannelMeta || null)
  );
  const [status, setStatus] = useState<'published' | 'draft' | 'inactive'>(
    String(initialValues?.status || 'published') === 'draft'
      ? 'draft'
      : String(initialValues?.status || 'published') === 'inactive'
        ? 'inactive'
        : 'published'
  );
  const [coverUrl, setCoverUrl] = useState(String(initialValues?.coverUrl || ''));
  const [videoChannelMeta, setVideoChannelMeta] = useState<LearningVideoChannelMetaForm>(
    normalizeLearningVideoChannelMeta(initialValues?.videoChannelMeta || { coverUrl: initialValues?.coverUrl || '' })
  );
  const [uploads, setUploads] = useState<UploadMediaItem[]>(
    Array.isArray(initialValues?.media)
      ? initialValues!.media!.map((m, idx) => ({
          name: String(m?.name || `资料-${idx + 1}`),
          type: String(m?.type || 'image/*'),
          preview: String(m?.preview || m?.url || m?.path || ''),
          url: String(m?.url || ''),
          path: String(m?.path || ''),
        }))
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const preparedVideoChannelMeta = finalizeLearningVideoChannelMeta(videoChannelTarget, videoChannelMeta);
  const hasActivityLaunchMeta =
    Boolean(String(preparedVideoChannelMeta.finderUserName || '').trim())
    && Boolean(String(preparedVideoChannelMeta.feedId || '').trim());
  const hasProfileLaunchMeta =
    videoChannelTarget === 'profile'
    && Boolean(String(preparedVideoChannelMeta.finderUserName || '').trim());
  const usesLegacyEmbedCompatOnly =
    Boolean(String(preparedVideoChannelMeta.feedToken || '').trim())
    && !hasActivityLaunchMeta
    && !hasProfileLaunchMeta;

  useEffect(() => {
    setTitle(initialValues?.title || '');
    setPoints(Number(initialValues?.points || 50));
    setContent(initialValues?.content || '');
    setContentType(String(initialValues?.contentType || 'video') === 'article' ? 'article' : 'video');
    setSourceType(String(initialValues?.sourceType || 'native') === 'video_channel' ? 'video_channel' : 'native');
    setStatus(
      String(initialValues?.status || 'published') === 'draft'
        ? 'draft'
        : String(initialValues?.status || 'published') === 'inactive'
          ? 'inactive'
          : 'published'
    );
    setCoverUrl(String(initialValues?.coverUrl || ''));
    setVideoChannelTarget(resolveVideoChannelLaunchTarget(initialValues?.videoChannelMeta || null));
    setVideoChannelMeta(
      normalizeLearningVideoChannelMeta(initialValues?.videoChannelMeta || { coverUrl: initialValues?.coverUrl || '' })
    );
    setUploads(
      Array.isArray(initialValues?.media)
        ? initialValues!.media!.map((m, idx) => ({
            name: String(m?.name || `资料-${idx + 1}`),
            type: String(m?.type || 'image/*'),
            preview: String(m?.preview || m?.url || m?.path || ''),
            url: String(m?.url || ''),
            path: String(m?.path || ''),
          }))
        : []
    );
  }, [initialValues]);

  const updateVideoChannelMeta = (patch: Partial<LearningVideoChannelMetaForm>) => {
    setVideoChannelMeta((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors text-sm font-semibold"
          >
            <ArrowLeft size={18} />
            返回
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-2xl font-bold text-gray-900">{mode === 'edit' ? '编辑知识学习' : '新增知识学习'}</h2>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <Bell size={18} />
          <HelpCircle size={18} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 space-y-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <label className="block lg:col-span-2">
              <span className="text-sm font-bold text-gray-800">资料标题 <span className="text-red-500">*</span></span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                placeholder="请输入知识学习标题，例如：2024家庭资产配置白皮书"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-gray-800">积分奖励 <span className="text-red-500">*</span></span>
              <div className="mt-2 h-12 rounded-xl border border-gray-200 bg-white flex items-center px-3">
                <div className="w-8 h-5 rounded-full bg-blue-600 relative mr-3">
                  <span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-white" />
                </div>
                <input
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value || 0))}
                  className="flex-1 text-sm outline-none"
                  placeholder="请输入学习完成后奖励积分"
                />
                <span className="text-xs text-gray-400 font-semibold">积分</span>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-gray-800">资料状态</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'published' | 'draft' | 'inactive')}
                className="mt-2 w-full h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {CONTENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section>
            <h3 className="text-sm font-bold text-gray-800">资料介绍 <span className="text-red-500">*</span></h3>
            <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-12 px-4 flex items-center gap-3 bg-gray-50 border-b border-gray-100 text-gray-600">
                <button className="font-black">B</button>
                <button className="italic font-semibold">I</button>
                <span className="h-4 w-px bg-gray-200"></span>
                <button><ListIcon size={16} /></button>
                <button><Link size={16} /></button>
                <button><ImageIcon size={16} /></button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-48 p-4 text-sm outline-none resize-none"
                placeholder="请输入详细的资料介绍、学习目标和重点提示..."
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-gray-800">
                {sourceType === 'video_channel' ? '视频号跳转配置' : '资料上传'} <span className="text-red-500">*</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">资料类型</span>
                <button
                  onClick={() => setContentType('video')}
                  className={`px-3 h-8 rounded-lg text-xs font-semibold ${contentType === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  视频
                </button>
                <button
                  onClick={() => {
                    setContentType('article');
                    setSourceType('native');
                  }}
                  className={`px-3 h-8 rounded-lg text-xs font-semibold ${contentType === 'article' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  文章
                </button>
              </div>
            </div>

            {contentType === 'video' ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">视频来源</span>
                <button
                  onClick={() => setSourceType('native')}
                  className={`px-3 h-8 rounded-lg text-xs font-semibold ${sourceType === 'native' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  站内视频
                </button>
                <button
                  onClick={() => setSourceType('video_channel')}
                  className={`px-3 h-8 rounded-lg text-xs font-semibold ${sourceType === 'video_channel' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  视频号承接
                </button>
              </div>
            ) : null}

            {contentType === 'video' && sourceType === 'video_channel' ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-4">
                <p className="text-sm text-emerald-900 font-semibold">
                  这类课程不会在 H5 内直接播放。前端只需要配置视频号ID和 feedId，系统会自动生成小程序承接路径；如果具体视频不稳定，也可以切到“主页兜底”模式。
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-900/70">跳转类型</span>
                  <button
                    type="button"
                    onClick={() => setVideoChannelTarget('activity')}
                    className={`px-3 h-9 rounded-lg text-xs font-semibold ${videoChannelTarget === 'activity' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-900 border border-emerald-200'}`}
                  >
                    单视频跳转
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoChannelTarget('profile')}
                    className={`px-3 h-9 rounded-lg text-xs font-semibold ${videoChannelTarget === 'profile' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-900 border border-emerald-200'}`}
                  >
                    主页兜底
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-bold text-gray-800">视频号ID <span className="text-red-500">*</span></span>
                    <input
                      value={videoChannelMeta.finderUserName}
                      onChange={(e) => updateVideoChannelMeta({ finderUserName: e.target.value })}
                      className="mt-2 w-full h-12 rounded-xl border border-emerald-200 px-4 text-sm outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      placeholder="例如：sphGX4fco229Lvf"
                    />
                    <p className="mt-2 text-xs text-emerald-800/80">视频号助手里的 `sph...` 视频号ID，前端页面可直接修改。</p>
                  </label>
                  {videoChannelTarget === 'activity' ? (
                    <label className="block">
                      <span className="text-sm font-bold text-gray-800">feedId <span className="text-red-500">*</span></span>
                      <input
                        value={videoChannelMeta.feedId}
                        onChange={(e) => updateVideoChannelMeta({ feedId: e.target.value })}
                        className="mt-2 w-full h-12 rounded-xl border border-emerald-200 px-4 text-sm outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                        placeholder="例如：export/UzFfAgt..."
                      />
                      <p className="mt-2 text-xs text-emerald-800/80">视频号里打开目标视频后，点“分享 -&gt; 复制视频ID”，把拿到的 `export/...` 填在这里。</p>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 px-4 py-4 text-sm text-emerald-900">
                      主页兜底模式只需要视频号ID，不需要填 `feedId / nonceId`。
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-white/80 p-4 space-y-4">
                  <div className="space-y-4">
                    <div className="block">
                      <span className="text-sm font-bold text-gray-800">封面图</span>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-emerald-200 bg-white text-xs font-semibold text-emerald-900 cursor-pointer hover:bg-emerald-50">
                          <UploadCloud size={14} />
                          {uploading ? '上传中...' : '上传本地图片'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = (Array.from(e.target.files || []) as File[])[0];
                              if (!file || uploading) return;
                              try {
                                setUploading(true);
                                const [uploaded] = await uploadMediaFiles([file]);
                                const nextCoverUrl = String(uploaded?.url || uploaded?.preview || '').trim();
                                updateVideoChannelMeta({ coverUrl: nextCoverUrl });
                                setCoverUrl(nextCoverUrl);
                              } catch (err: any) {
                                setSubmitError(err?.message || ERROR_COPY.fileUploadFailed);
                              } finally {
                                setUploading(false);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>
                        {videoChannelMeta.coverUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateVideoChannelMeta({ coverUrl: '' });
                              setCoverUrl('');
                            }}
                            className="px-3 h-9 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            清空封面
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-emerald-800/80">只支持本地上传图片，上传后会自动回填成 H5 卡片封面。</p>
                      {videoChannelMeta.coverUrl ? (
                        <div className="mt-3 h-28 w-44 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
                          <img
                            src={videoChannelMeta.coverUrl}
                            alt="视频号课程封面预览"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <details className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-amber-900">
                    兼容旧数据
                  </summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-sm font-bold text-gray-800">feed-token</span>
                      <input
                        value={videoChannelMeta.feedToken}
                        onChange={(e) => updateVideoChannelMeta({ feedToken: e.target.value })}
                        className="mt-2 w-full h-12 rounded-xl border border-amber-200 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-500"
                        placeholder="仅历史内嵌课程兼容，例如：export/UzFf..."
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-amber-900/80">
                    新建课程优先使用前面的 `视频号ID + feedId`。这里只有旧内嵌数据迁移时才需要填写。
                  </p>
                </details>
                {usesLegacyEmbedCompatOnly ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
                    当前资料仍带有旧的 `feed-token` 内嵌兼容参数。若要切回跳转承接，请补齐 `视频号ID`，并在单视频模式下补齐 `feedId`；小程序路径会自动改成新承接页。
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-4 gap-3">
                  {uploads.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="relative h-36 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                      {file.type.startsWith('video') ? (
                        <video src={file.preview} className="w-full h-full object-cover" />
                      ) : (
                        <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => setUploads((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="border-2 border-dashed border-blue-100 bg-blue-50/20 rounded-2xl h-36 flex flex-col items-center justify-center text-center cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-white border border-gray-100 flex items-center justify-center mb-3 text-blue-600">
                      <UploadCloud size={22} />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">点击上传</p>
                    <p className="text-[11px] text-gray-400 mt-1">图片/视频/PDF</p>
                    <input
                      type="file"
                      accept="image/*,video/*,.pdf,.ppt,.pptx"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = (Array.from(e.target.files || []) as File[]).slice(0, 8);
                        if (!files.length || uploading) return;
                        try {
                          setUploading(true);
                          const next = await uploadMediaFiles(files);
                          setUploads((prev) => [...prev, ...next].slice(0, 8));
                        } catch (err: any) {
                          setSubmitError(err?.message || ERROR_COPY.fileUploadFailed);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="mt-2 text-sm text-gray-400">{uploading ? '资料上传中...' : '支持格式：MP4, PDF, PPT, PNG, JPG'}</div>
              </>
            )}
          </section>
          {submitError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {submitError}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="h-20 bg-white border-t border-gray-200 px-8 flex items-center justify-end gap-4 shrink-0">
        <button
          onClick={onBack}
          className="px-8 h-12 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50"
        >
          取消
        </button>
        <button
          disabled={submitting || uploading}
          onClick={async () => {
            const nextError = validateLearningMaterialSubmit({
              mode: mode || 'create',
              title,
              uploadsCount: sourceType === 'video_channel' ? 0 : uploads.length,
              sourceType: contentType === 'video' ? sourceType : 'native',
              finderUserName: preparedVideoChannelMeta.finderUserName,
              feedToken: preparedVideoChannelMeta.feedToken,
              feedId: preparedVideoChannelMeta.feedId,
              nonceId: preparedVideoChannelMeta.nonceId,
              launchTarget: videoChannelTarget,
              miniProgramAppId: preparedVideoChannelMeta.miniProgramAppId,
              miniProgramPath: preparedVideoChannelMeta.miniProgramPath,
            });
            if (nextError) {
              setSubmitError(nextError);
              return;
            }
            try {
              setSubmitting(true);
              setSubmitError('');
              await onSubmit({
                title: title.trim(),
                category: '通用培训',
                points: Number(points || 0),
                contentType,
                sourceType: contentType === 'video' ? sourceType : 'native',
                videoChannelMeta:
                  contentType === 'video' && sourceType === 'video_channel'
                    ? {
                        finderUserName: preparedVideoChannelMeta.finderUserName.trim(),
                        feedToken: preparedVideoChannelMeta.feedToken.trim(),
                        feedId: preparedVideoChannelMeta.feedId.trim(),
                        nonceId: preparedVideoChannelMeta.nonceId.trim(),
                        miniProgramAppId: preparedVideoChannelMeta.miniProgramAppId.trim(),
                        miniProgramPath: preparedVideoChannelMeta.miniProgramPath.trim(),
                        miniProgramEnvVersion: preparedVideoChannelMeta.miniProgramEnvVersion,
                        coverUrl: preparedVideoChannelMeta.coverUrl.trim(),
                      }
                    : null,
                level: '中级',
                content: content.trim(),
                status,
                coverUrl:
                  contentType === 'video' && sourceType === 'video_channel'
                    ? preparedVideoChannelMeta.coverUrl.trim()
                    : String((uploads[0] as any)?.preview || coverUrl || '').trim(),
                media:
                  contentType === 'video' && sourceType === 'video_channel'
                    ? []
                    : uploads.map((x) => ({ name: x.name, type: x.type, preview: x.preview, url: x.url, path: x.path })),
              });
            } catch (err: any) {
              setSubmitError(err?.message || ERROR_COPY.learningCreateFailed);
            } finally {
              setSubmitting(false);
            }
          }}
          className="px-8 h-12 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60"
        >
          <Upload size={16} />
          {submitting
            ? mode === 'edit'
              ? '保存中...'
              : '提交中...'
            : uploading
              ? '资料上传中...'
              : mode === 'edit'
                ? '保存修改'
                : sourceType === 'video_channel'
                  ? '创建视频号承接课程'
                  : '上传资料'}
        </button>
      </footer>
    </div>
  );
};
