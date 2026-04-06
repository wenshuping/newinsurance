import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import {
  Search,
  Megaphone,
  FileEdit,
  FileText,
  Scan,
  Users,
  BadgeCheck,
  ReceiptText,
  TrendingUp,
  BarChart2,
  Gift,
  LineChart,
  User,
  Briefcase,
  UserPlus,
  Bell,
  SlidersHorizontal,
  ChevronDown,
  MessageCircle,
  Tag,
  Plus,
  ArrowLeft,
  RefreshCw,
  Edit2,
  Save,
  GraduationCap,
  Gamepad2,
  CalendarCheck,
  ShoppingBasket,
  Filter,
  X,
  Sparkles,
  PlayCircle,
  Eye,
  Share2,
  Wrench,
  Edit,
  PlusCircle,
  ArrowUpDown,
  Trash2,
  PartyPopper,
  TimerOff,
  LayoutDashboard,
  Activity,
  Settings,
  Camera,
  Contact2,
  ChevronRight,
  Lock,
  ShieldCheck,
  HelpCircle,
  Info,
  LogOut,
  HelpCircle as HelpOutline,
  CheckCircle2,
  Smartphone,
  ShieldAlert,
  Image as ImageIcon,
  QrCode,
  Keyboard
} from 'lucide-react';
import {
  bApi,
  normalizeShareUrl,
  onAuthInvalid,
  trackEvent,
  type BCustomer,
  type BCustomerInteraction,
  type BCustomerProfile,
  type InsurancePolicy,
  type BOrder,
  type BLoginSession,
  type BAdvisorProfile,
  type BContentItem,
  type BActivityConfig,
  type BMallProduct,
  type BMallActivity,
  type BTemplateSource,
  type BShareType,
  type BShareOverviewResponse,
  type BShareEffectParticipantRow,
  type BShareEffectParticipantsResponse,
  type BShareParticipantMetricKind,
  type BDashboardMetricsResponse,
  type BDashboardActivityParticipantsResponse,
  type BDashboardCustomerListMetricKey,
  type BDashboardCustomerListResponse,
  type BDashboardCustomerActivityFeedRow,
  type BDashboardCustomerActivityFeedResponse,
  type BShareRecord,
  type BShareRecordDetailResponse,
  type BShareRecordEvent,
  type BPagePermissionResponse,
} from './lib/api';
import InsurancePolicyDetailSheet from './components/insurance/PolicyDetail';
import FamilyPolicyReportSheet from './components/insurance/FamilyPolicyReportSheet';
import { B_NAV_ORDER, buildBPermissionAccess, type BPermissionAccess, getVisibleBNavIds } from './lib/b-nav';
import {
  createBActivityConfigIdempotencyKey,
  rotateBActivityConfigIdempotencyKey,
} from './lib/activity-config-idempotency';
import { resolveApiErrorMessage } from '@contracts/error-ui';
import { showApiError } from './lib/ui-error';
import {
  buildPolicyCompanyOptions,
  buildPolicyCoveragePeriodOptions,
  buildPolicyNameOptions,
  buildPolicyPaymentPeriodOptions,
  buildPolicyRelationOptions,
  isValidPolicyCoveragePeriod,
  isValidPolicyPaymentPeriod,
  normalizePolicyCompany,
  normalizePolicyCoveragePeriod,
  normalizePolicyPaymentPeriod,
  rememberPolicyFormValues,
  sanitizePositiveNumberInput,
  validatePositiveNumberInput,
} from './lib/policyFormOptions';
import {
  buildInsuranceNeedAxes,
  buildProtectionDistribution,
  formatCoverageAmount,
  formatCurrency,
  inferProtectionType,
  type InsuranceNeedAxis,
  type ProtectionDistributionItem,
} from './lib/policyReport';
import { ERROR_COPY } from './lib/errorCopy';
import { VALIDATION_COPY } from './lib/validationCopy';
import { NOTICE_COPY } from './lib/noticeCopy';
import { ACTION_COPY } from './lib/uiCopy';
import { getDashboardCustomerActivityFullRows, getDashboardCustomerActivityPreviewRows } from './lib/dashboard-customer-activity';
import SuggestionInput from './components/insurance/SuggestionInput';
import {
  CONTENT_STATUS_FILTER_OPTIONS,
  CONTENT_STATUS_OPTIONS,
  RUNNING_STATUS_FILTER_OPTIONS,
  RUNNING_STATUS_OPTIONS,
  normalizeContentStatus,
  normalizeRunningStatus,
  isRunningStatusActive,
  toContentStatusLabel,
  toRunningStatusLabel,
  type ContentRunningStatusFilter,
} from './lib/templateStatus';
import {
  B_SHARE_TRACK_EVENTS,
  bToolKindDetailSharePath,
  bToolKindDetailTitle,
  bToolKindShareButtonLabel,
  bToolKindShareLabel,
  type BSharePath,
  type BToolKind,
} from './lib/shareTypes';

type ShareSheetState = {
  kind: BToolKind;
  itemId: number;
  shareCode: string;
  title: string;
  shareLabel: string;
  shareType: BShareType;
  sharePath: BSharePath;
  shareUrl: string;
  targetCPath: string;
  expiresAt: string;
  previewPayload?: {
    title?: string;
    subtitle?: string;
    cover?: string;
    tag?: string;
    ctaText?: string;
    pointsHint?: number;
  };
};

type ShareSuccessMethod = 'system' | 'clipboard' | 'manual' | 'poster';
type BHomeActivityDetailItem = {
  id: number;
  title: string;
  image: string;
  status: string;
  rawStatus: string;
  description: string;
  rewardPoints: number;
  participants: string;
  attendees: string;
  shares: string;
  orderNo?: string;
  updatedAt?: string;
};

function isCompactViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

async function copyTextWithFallback(text: string) {
  const content = String(text || '').trim();
  if (!content) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      // fall through
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return copied;
}

const CUSTOMERS = [
  {
    id: 0,
    name: '',
    mobile: '',
    avatar: '',
    intent: 0,
    tags: [],
    activity: ''
  }
];

const CONTENT_ITEMS = [
  {
    id: 0,
    title: '',
    image: '',
    status: '',
    rawStatus: '',
    type: 'article',
    views: '0',
    participants: '0',
    shares: '0',
    order: 0,
    templateSource: 'personal' as BTemplateSource,
    templateTag: '个人模板',
  }
];

const ACTIVITY_ITEMS = [
  {
    id: 0,
    title: '',
    image: '',
    status: '',
    rawStatus: '',
    participants: '0',
    attendees: '0',
    shares: '0',
    order: 0,
    templateSource: 'personal' as BTemplateSource,
    templateTag: '个人模板',
  }
];

const MALL_PRODUCTS = [
  {
    id: 0,
    title: '',
    image: '',
    status: '',
    rawStatus: '',
    views: '0',
    participants: '0',
    shares: '0',
    order: 0,
    templateSource: 'personal' as BTemplateSource,
    templateTag: '个人模板',
  }
];

const MALL_ACTIVITIES = [
  {
    id: 0,
    title: '',
    icon: PartyPopper,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    views: '0',
    participants: '0',
    shares: '0',
    order: 0,
    active: false,
    status: '',
    rawStatus: '',
    templateSource: 'personal' as BTemplateSource,
    templateTag: '个人模板',
  }
];

function getInitials(value: string) {
  const text = String(value || '').trim();
  if (!text) return 'U';
  return text.slice(0, 1).toUpperCase();
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0));
}

function contentStatusBadgeClass(value?: string) {
  const normalized = normalizeContentStatus(value);
  if (normalized === 'published') return 'tool-status-badge tool-status-badge--success';
  if (normalized === 'inactive') return 'tool-status-badge tool-status-badge--danger';
  return 'tool-status-badge tool-status-badge--warning';
}

function runningStatusBadgeClass(value?: string) {
  const normalized = normalizeRunningStatus(value);
  if (normalized === 'active') return 'tool-status-badge tool-status-badge--success';
  if (normalized === 'inactive') return 'tool-status-badge tool-status-badge--danger';
  return 'tool-status-badge tool-status-badge--warning';
}

function normalizeTemplateSource(value?: string): BTemplateSource {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'platform') return 'platform';
  if (normalized === 'company') return 'company';
  return 'personal';
}

function templateSourceLabel(value?: string) {
  const normalized = normalizeTemplateSource(value);
  if (normalized === 'platform') return '平台模板';
  if (normalized === 'company') return '公司模板';
  return '个人模板';
}

function templateSourceBadgeClass(value?: string) {
  const normalized = normalizeTemplateSource(value);
  if (normalized === 'platform') {
    return 'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700';
  }
  if (normalized === 'company') {
    return 'inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700';
  }
  return 'inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700';
}

function dayKeyFromDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildRecentOrderSeries(orders: BOrder[], days = 7) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const rows = Array.from({ length: days }, (_, idx) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (days - idx - 1));
    return {
      key: dayKeyFromDate(d),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count: 0,
    };
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  for (const order of orders || []) {
    const raw = String(order.createdAt || order.updatedAt || '').trim();
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const hit = byKey.get(dayKeyFromDate(date));
    if (hit) hit.count += 1;
  }
  return rows;
}

function countOrdersInRecentDays(orders: BOrder[], days = 7) {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return (orders || []).filter((order) => {
    const raw = String(order.createdAt || order.updatedAt || '').trim();
    if (!raw) return false;
    const time = new Date(raw).getTime();
    return Number.isFinite(time) && time >= threshold;
  }).length;
}

function countPendingPaymentOrders(orders: BOrder[]) {
  return (orders || []).filter((order) => String(order.paymentStatus || '').toLowerCase() === 'pending').length;
}

function countPendingFulfillmentOrders(orders: BOrder[]) {
  return (orders || []).filter((order) => {
    const status = String(order.status || '').toLowerCase();
    const fulfillment = String(order.fulfillmentStatus || '').toLowerCase();
    if (status === 'cancelled') return false;
    return fulfillment !== 'fulfilled' && fulfillment !== 'written_off';
  }).length;
}

function trendLabel(current: number, previous: number, upLabel = '较前期增长', downLabel = '较前期回落') {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (cur === prev) return '较前期持平';
  if (prev <= 0 && cur > 0) return upLabel;
  return cur > prev ? upLabel : downLabel;
}

function buildTickerRows<T>(rows: readonly T[], minRows = 6) {
  const list = Array.isArray(rows) ? [...rows] : [];
  if (list.length <= 1) {
    return { rows: list, copies: list.length ? 1 : 0 };
  }
  let copies = 2;
  while (list.length * copies < minRows) copies += 1;
  return {
    rows: Array.from({ length: copies }).flatMap(() => list),
    copies,
  };
}

function buildDailyActiveTrendPath(
  series: Array<{ count?: number | string }>,
  width: number,
  height: number,
  padding: number
) {
  const rows = Array.isArray(series) && series.length > 0 ? series : [{ count: 0 }];
  const counts = rows.map((row) => Number(row.count || 0));
  const max = Math.max(1, ...counts);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const step = rows.length <= 1 ? 0 : innerWidth / (rows.length - 1);
  const points = rows.map((row, index) => {
    const x = padding + step * index;
    const y = padding + innerHeight - (Number(row.count || 0) / max) * innerHeight;
    return { x, y, count: Number(row.count || 0) };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;
  return { points, linePath, areaPath };
}

function DailyActiveTrendChart({
  series,
  heightClass = 'h-44',
}: {
  series: Array<{ key: string; label: string; count?: number | string }>;
  heightClass?: string;
}) {
  const width = 360;
  const plotHeight = 132;
  const totalHeight = 208;
  const padding = 16;
  const rows = Array.isArray(series) && series.length > 0 ? series : [{ key: 'na', label: '-', count: 0 }];
  const { points, linePath, areaPath } = buildDailyActiveTrendPath(rows, width, plotHeight, padding);
  const gridYs = [padding, plotHeight / 2, plotHeight - padding];
  const labelY = 166;
  const countY = 190;

  return (
    <div className={`w-full ${heightClass}`}>
      <svg
        viewBox={`0 0 ${width} ${totalHeight}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="xMinYMin meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="daily-active-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(37,99,235,0.24)" />
            <stop offset="100%" stopColor="rgba(37,99,235,0.03)" />
          </linearGradient>
        </defs>
        {gridYs.map((y) => (
          <line
            key={y}
            x1={padding}
            x2={width - padding}
            y1={y}
            y2={y}
            stroke="rgba(148,163,184,0.18)"
            strokeDasharray="4 4"
          />
        ))}
        <path d={areaPath} fill="url(#daily-active-fill)" />
        <path d={linePath} fill="none" stroke="rgb(37,99,235)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${rows[index].key}-${rows[index].label}`}>
            <circle cx={point.x} cy={point.y} r="6.5" fill="white" stroke="rgb(37,99,235)" strokeWidth="3" />
            <circle cx={point.x} cy={point.y} r="2.5" fill="rgb(37,99,235)" />
            <text x={point.x} y={labelY} textAnchor="middle" className="fill-slate-400 text-[14px] font-bold">
              {rows[index].label}
            </text>
            <text x={point.x} y={countY} textAnchor="middle" className="fill-slate-600 text-[16px] font-semibold">
              {formatCount(Number(point.count || 0))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function shareTypeByKind(kind: BToolKind): BShareType | null {
  if (kind === 'content') return 'learning_course';
  if (kind === 'activity') return 'activity';
  if (kind === 'product') return 'mall_item';
  if (kind === 'mall-activity') return 'mall_activity';
  return null;
}

function kindByShareType(shareType: BShareType): BToolKind {
  if (shareType === 'learning_course') return 'content';
  if (shareType === 'activity') return 'activity';
  if (shareType === 'mall_item') return 'product';
  return 'mall-activity';
}

type BEffectShareType = 'activity' | 'learning_course' | 'mall_item' | 'mall_activity';
type SelectedShareEffect = { id: number; title: string; shareType: BEffectShareType };

function resolveShareTargetPageName(shareType: BShareType) {
  if (shareType === 'activity') return '活动详情页';
  if (shareType === 'learning_course') return '课程详情页';
  if (shareType === 'mall_item') return '商品详情页';
  if (shareType === 'mall_activity') return '商城活动详情页';
  if (shareType === 'mall_home') return '积分商城首页';
  return '目标页面';
}

function isEffectShareType(value: BShareType | string | null | undefined): value is BEffectShareType {
  return value === 'activity' || value === 'learning_course' || value === 'mall_item' || value === 'mall_activity';
}

function effectTabByShareType(shareType: BEffectShareType) {
  if (shareType === 'learning_course') return 'learning';
  if (shareType === 'mall_item' || shareType === 'mall_activity') return 'mall';
  return 'activity';
}

function effectCopyByShareType(shareType: BEffectShareType) {
  if (shareType === 'learning_course') {
    return {
      tabLabel: '学习效果',
      singularLabel: '课程',
      listLabel: '课程分享列表',
      shareMetricLabel: '课程分享次数',
      viewMetricLabel: '课程查看次数',
      participantMetricLabel: '学习参与人数',
      participantListLabel: '学习参与客户',
      currentLabel: '当前课程',
      emptyLabel: '当前范围还没有课程分享记录。先从知识学习点一次分享。',
      refreshError: '学习参与客户获取失败',
      participantTag: '学习参与客户',
      participantSummaryPrefix: '参与课程：',
      attendedMetricLabel: undefined,
      attendedListLabel: undefined,
      attendedRefreshError: undefined,
      attendedTag: undefined,
      attendedSummaryPrefix: undefined,
    };
  }
  if (shareType === 'mall_item') {
    return {
      tabLabel: '商城效果',
      singularLabel: '商品',
      listLabel: '商品分享列表',
      shareMetricLabel: '商品分享次数',
      viewMetricLabel: '商品查看次数',
      participantMetricLabel: '商品参与人数',
      participantListLabel: '商品参与客户',
      currentLabel: '当前商品',
      emptyLabel: '当前范围还没有商品分享记录。先从积分商城点一次分享。',
      refreshError: '商品参与客户获取失败',
      participantTag: '商品参与客户',
      participantSummaryPrefix: '参与商品：',
      attendedMetricLabel: undefined,
      attendedListLabel: undefined,
      attendedRefreshError: undefined,
      attendedTag: undefined,
      attendedSummaryPrefix: undefined,
    };
  }
  if (shareType === 'mall_activity') {
    return {
      tabLabel: '商城效果',
      singularLabel: '商城活动',
      listLabel: '商城活动分享列表',
      shareMetricLabel: '商城活动分享次数',
      viewMetricLabel: '商城活动查看次数',
      participantMetricLabel: '商城活动参与人数',
      participantListLabel: '商城活动参与客户',
      currentLabel: '当前商城活动',
      emptyLabel: '当前范围还没有商城活动分享记录。先从积分商城点一次分享。',
      refreshError: '商城活动参与客户获取失败',
      participantTag: '商城活动参与客户',
      participantSummaryPrefix: '参与商城活动：',
      attendedMetricLabel: undefined,
      attendedListLabel: undefined,
      attendedRefreshError: undefined,
      attendedTag: undefined,
      attendedSummaryPrefix: undefined,
    };
  }
  return {
    tabLabel: '活动效果',
    singularLabel: '活动',
    listLabel: '活动分享列表',
    shareMetricLabel: '活动分享次数',
    viewMetricLabel: '活动查看次数',
    participantMetricLabel: '活动报名人数',
    participantListLabel: '活动报名客户',
    currentLabel: '当前活动',
    emptyLabel: '当前范围还没有活动分享记录。先从活动中心点一次分享。',
    refreshError: '活动报名客户获取失败',
    participantTag: '活动报名客户',
    participantSummaryPrefix: '报名活动：',
    attendedMetricLabel: '活动参加人数',
    attendedListLabel: '活动参加客户',
    attendedRefreshError: '活动参加客户获取失败',
    attendedTag: '活动参加客户',
    attendedSummaryPrefix: '参加活动：',
  };
}

function mallAggregateEffectCopy() {
  return {
    tabLabel: '商城效果',
    singularLabel: '商城项目',
    listLabel: '商城分享列表',
    shareMetricLabel: '商城分享次数',
    viewMetricLabel: '商城查看次数',
    participantMetricLabel: '商城参与人数',
    participantListLabel: '商城参与客户',
    currentLabel: '当前项目',
    emptyLabel: '当前范围还没有商城分享记录。先从积分商城点一次分享。',
    refreshError: '商城参与客户获取失败',
    participantTag: '商城参与客户',
    participantSummaryPrefix: '参与商城项目：',
    attendedMetricLabel: undefined,
    attendedListLabel: undefined,
    attendedRefreshError: undefined,
    attendedTag: undefined,
    attendedSummaryPrefix: undefined,
  };
}

function shouldSplitShareRecordsBySource(tab: 'overview' | 'activity' | 'learning' | 'mall' | 'integration') {
  return tab === 'activity' || tab === 'learning';
}

function resolveShareChannelBucket(channel: string) {
  return String(channel || '').trim().toLowerCase() === 'b-web' ? 'b' : 'c';
}

function resolveShareChannelLabel(channel: string) {
  return resolveShareChannelBucket(channel) === 'b' ? 'B端获客工具' : 'C端客户转发';
}

function resolveCustomerEventPageName(record: BShareRecord, event: BShareRecordEvent) {
  if (event.event === 'share_h5_view') return '分享 H5 页面';
  if (event.event === 'share_h5_click_cta') return resolveShareTargetPageName(record.shareType);
  if (event.event === 'share_customer_identified') return '实名确认弹窗';
  return '客户页面';
}

function resolveCustomerEventButtonName(record: BShareRecord, event: BShareRecordEvent) {
  if (event.event === 'share_h5_click_cta') return String(record.previewPayload?.ctaText || '立即查看');
  if (event.event === 'share_customer_identified') return '提交认证';
  return '';
}

function isCustomerTimelineEvent(event: BShareRecordEvent) {
  return event.event === 'share_h5_view' || event.event === 'share_h5_click_cta' || event.event === 'share_customer_identified';
}

function hasImage(url?: string) {
  return Boolean(String(url || '').trim());
}

function resolveTemplateMediaUrl(media?: any) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return String(media.preview || media.url || media.path || media.name || '');
}

function pickTemplatePreviewImage(media?: Array<any>) {
  const list = Array.isArray(media) ? media : [];
  const imageHit = list.find((item) => {
    const type = String(item?.type || '').toLowerCase();
    const name = String(item?.name || item?.preview || item?.url || '').toLowerCase();
    return type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name);
  });
  return resolveTemplateMediaUrl(imageHit || list[0]);
}

function isActivityOrder(order: BOrder) {
  return String(order.orderType || '').toLowerCase() === 'activity' || /活动|报名|参与/.test(String(order.productName || ''));
}

function resolveActivityConfigForOrder(list: BActivityConfig[], order: BOrder) {
  const activityId = Number(order.productId || 0);
  if (activityId > 0) {
    const byId = list.find((item) => Number(item.id || 0) === activityId);
    if (byId) return byId;
  }
  const orderTitle = String(order.productName || '').trim();
  if (!orderTitle) return null;
  const normalize = (value: string) => value.replace(/\s+/g, '').trim().toLowerCase();
  const normalizedTitle = normalize(orderTitle);
  return list.find((item) => normalize(String(item.title || '')) === normalizedTitle) || null;
}

function toHomeActivityDetailItem(
  item: BActivityConfig,
  options?: {
    shares?: number;
    participants?: number;
    attendees?: number;
    orderNo?: string;
  },
): BHomeActivityDetailItem {
  return {
    id: Number(item.id || 0),
    title: String(item.title || `活动#${Number(item.id || 0)}`),
    image: pickTemplatePreviewImage(item.media),
    status: toRunningStatusLabel(String(item.status || 'online')),
    rawStatus: String(item.status || 'online'),
    description: String((item as any).content || ''),
    rewardPoints: Number(item.rewardPoints || 0),
    participants: String(Number(options?.participants || 0)),
    attendees: String(Number(options?.attendees || 0)),
    shares: String(Number(options?.shares || 0)),
    orderNo: options?.orderNo,
    updatedAt: item.updatedAt || '',
  };
}

function getMostRecentOrderForCustomer(customerId: number, orders: BOrder[]) {
  return [...(orders || [])]
    .filter((order) => Number(order.customerId) === Number(customerId))
    .sort((a, b) => {
      const aTime = new Date(String(a.createdAt || a.updatedAt || '')).getTime();
      const bTime = new Date(String(b.createdAt || b.updatedAt || '')).getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })[0];
}

function buildCustomerActivitySummary(customerId: number, orders: BOrder[]) {
  const latest = getMostRecentOrderForCustomer(customerId, orders);
  if (!latest) return '暂无关联订单记录';
  const orderNo = String(latest.orderNo || '').trim() || `订单${Number(latest.id || 0)}`;
  const productName = String(latest.productName || '').trim() || '未命名商品';
  const fulfillment = String(latest.fulfillmentStatus || '').trim();
  const payment = String(latest.paymentStatus || '').trim();
  const status = fulfillment || payment || String(latest.status || '').trim() || '状态未知';
  return `${orderNo} · ${productName} · ${status}`;
}

function dashboardCustomerActivityVisual(category: string) {
  const normalized = String(category || '').trim().toLowerCase();
  if (normalized === 'login') return { icon: User, wrapClass: 'bg-sky-50 text-sky-500' };
  if (normalized === 'share') return { icon: Share2, wrapClass: 'bg-violet-50 text-violet-500' };
  if (normalized === 'verify') return { icon: ShieldCheck, wrapClass: 'bg-emerald-50 text-emerald-500' };
  if (normalized === 'sign_in') return { icon: CheckCircle2, wrapClass: 'bg-amber-50 text-amber-500' };
  if (normalized === 'learning') return { icon: GraduationCap, wrapClass: 'bg-indigo-50 text-indigo-500' };
  if (normalized === 'activity') return { icon: PartyPopper, wrapClass: 'bg-orange-50 text-orange-500' };
  if (normalized === 'redeem') return { icon: Gift, wrapClass: 'bg-rose-50 text-rose-500' };
  return { icon: Eye, wrapClass: 'bg-slate-100 text-slate-500' };
}

function toDashboardActivityCustomerShell(
  row: BDashboardCustomerActivityFeedRow,
  matched?: (typeof CUSTOMERS)[number],
) {
  const customerId = Number(row.userId || 0);
  return {
    id: customerId,
    name: String(row.name || matched?.name || `客户#${customerId}`),
    mobile: String(row.mobile || matched?.mobile || ''),
    avatar: String(matched?.avatar || ''),
    intent: Number(matched?.intent || 0),
    tags: matched?.tags?.length ? matched.tags : [{ text: '今日动态客户', color: 'text-primary bg-primary/10' }],
    activity: row.detail ? `${row.event} · ${row.detail}` : row.event,
  } as (typeof CUSTOMERS)[number];
}

function SwipeableCard({
  customer,
  canOpenTags,
  onOpenTags,
  onOpenDetail,
}: {
  customer: typeof CUSTOMERS[0];
  canOpenTags: boolean;
  onOpenTags: () => void;
  onOpenDetail: (customer: typeof CUSTOMERS[0]) => void;
}) {
  return (
    <div className="relative rounded-xl border border-slate-200 shadow-sm bg-slate-50 overflow-hidden">
      {/* Background Actions */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end px-4 gap-3">
        {canOpenTags ? (
          <button
            onClick={onOpenTags}
            className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Tag className="w-5 h-5" />
          </button>
        ) : null}
        <button className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors">
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Foreground Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={0.1}
        onClick={() => onOpenDetail(customer)}
        className="relative bg-white p-4 flex items-start gap-3 z-10 rounded-xl cursor-grab active:cursor-grabbing border-r border-slate-100"
      >
        <div className="relative w-14 h-14 shrink-0 rounded-full bg-slate-200 overflow-hidden border-2 border-white">
          {hasImage(customer.avatar) ? (
            <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover pointer-events-none" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary font-bold">
              {getInitials(customer.name)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="text-base font-semibold text-slate-900 truncate">{customer.name}</h3>
            <span className="text-xs shrink-0 text-slate-400">{customer.mobile || '-'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {customer.tags.map((tag, idx) => (
              <span key={idx} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tag.color}`}>
                {tag.text}
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-500 line-clamp-1 italic">{customer.activity || '暂无最近互动记录'}</p>
        </div>
      </motion.div>
    </div>
  );
}

function HomeView({
  onOpenToolsTab,
  onOpenAnalyticsTab,
  onOpenPolicyEntry,
  onOpenScanVerification,
  onOpenCustomerOrders,
  onOpenAllCustomerActivities,
  onOpenDashboardCustomerList,
  onOpenRecentCustomerActivity,
  onOpenRecentCustomerOrder,
  customers,
  orders,
  customerActivityFeed,
  customerActivityFeedLoading,
  dashboardMetrics,
  dashboardMetricsLoading,
}: {
  onOpenToolsTab: () => void;
  onOpenAnalyticsTab: () => void;
  onOpenPolicyEntry: () => void;
  onOpenScanVerification: () => void;
  onOpenCustomerOrders: () => void;
  onOpenAllCustomerActivities: () => void;
  onOpenDashboardCustomerList: (metric: BDashboardCustomerListMetricKey) => void;
  onOpenRecentCustomerActivity: (row: BDashboardCustomerActivityFeedRow) => void;
  onOpenRecentCustomerOrder: (order: BOrder) => void;
  customers: typeof CUSTOMERS;
  orders: BOrder[];
  customerActivityFeed: BDashboardCustomerActivityFeedRow[];
  customerActivityFeedLoading: boolean;
  dashboardMetrics: BDashboardMetricsResponse | null;
  dashboardMetricsLoading: boolean;
}) {
  const dailyActiveSeries = dashboardMetrics?.dailyActiveSeries || [];
  const customerTotal = Number(dashboardMetrics?.customerTotal || customers.length || 0);
  const activityParticipants7d = Number(dashboardMetrics?.activityParticipants7d || 0);
  const newCustomersToday = Number(dashboardMetrics?.newCustomersToday || 0);
  const signInCustomersToday = Number(dashboardMetrics?.signInCustomersToday || 0);
  const dailyActive7dTotal = Number(dashboardMetrics?.dailyActive7dTotal || 0);
  const dailyActive7dPrevTotal = Number(dashboardMetrics?.dailyActive7dPrevTotal || 0);
  const customerMap = new Map(customers.map((customer) => [Number(customer.id), customer]));
  const latestOrders = useMemo(
    () =>
      [...(orders || [])]
        .sort((left, right) => {
          const rightTime = new Date(String(right.updatedAt || right.createdAt || 0)).getTime();
          const leftTime = new Date(String(left.updatedAt || left.createdAt || 0)).getTime();
          return rightTime - leftTime;
        })
        .slice(0, 3),
    [orders],
  );
  const latestActivities = getDashboardCustomerActivityPreviewRows(customerActivityFeed, 2);
  const activityTickerRef = useRef<HTMLDivElement | null>(null);
  const [activityTickerPaused, setActivityTickerPaused] = useState(false);
  const activityTickerData = useMemo(() => buildTickerRows(latestActivities, 6), [latestActivities]);
  const scrollingActivities = activityTickerData.rows;

  useEffect(() => {
    const container = activityTickerRef.current;
    if (!container) return;
    container.scrollTop = 0;
  }, [latestActivities]);

  useEffect(() => {
    const container = activityTickerRef.current;
    if (!container || activityTickerData.copies <= 1) return;

    let rafId = 0;
    let lastTs = 0;
    const pixelsPerMs = 0.018;
    const loopHeight = container.scrollHeight / activityTickerData.copies;

    const step = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const delta = ts - lastTs;
      lastTs = ts;

      if (!activityTickerPaused) {
        container.scrollTop += delta * pixelsPerMs;
        if (container.scrollTop >= loopHeight) {
          container.scrollTop -= loopHeight;
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [activityTickerData, activityTickerPaused]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-slate-200 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">工作台</h1>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <Search className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">
            B
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 pb-32 overflow-y-auto">
        <section>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => onOpenDashboardCustomerList('customer_total')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">客户总数</p>
              <p className="text-2xl font-bold mt-1 text-slate-900">{formatCount(customerTotal)}</p>
              <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
            </button>
            <button
              type="button"
              onClick={() => onOpenDashboardCustomerList('activity_participants_7d')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">近7日活动参与人数</p>
              <p className="text-2xl font-bold mt-1 text-primary">{formatCount(activityParticipants7d)}</p>
              <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
            </button>
            <button
              type="button"
              onClick={() => onOpenDashboardCustomerList('new_customers_today')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">今日新客户数</p>
              <p className="text-2xl font-bold mt-1 text-slate-900">{formatCount(newCustomersToday)}</p>
              <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
            </button>
            <button
              type="button"
              onClick={() => onOpenDashboardCustomerList('signin_customers_today')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">今日签到客户数</p>
              <p className="text-2xl font-bold mt-1 text-slate-900">{formatCount(signInCustomersToday)}</p>
              <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-sm font-medium text-slate-500">最近7日日活趋势</p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="text-3xl font-black text-emerald-600 leading-none">{formatCount(dailyActive7dTotal)}</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">7天活跃总人次</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">近7天</span>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{trendLabel(dailyActive7dTotal, dailyActive7dPrevTotal, '较上个7天增长', '较上个7天回落')}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white px-3 py-3">
              <DailyActiveTrendChart series={dailyActiveSeries} heightClass="h-44" />
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {dashboardMetricsLoading
                ? '正在刷新最近7日日活统计...'
                : '当前趋势按客户当日真实活跃行为去重统计，包括实名、签到、活动参与、课程完成等行为。'}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 px-1">效率工具</h2>
          <div className="flex justify-between px-2">
            <button onClick={onOpenToolsTab} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 group-active:scale-95 transition-transform">
                <Megaphone className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-700">获客工具</span>
            </button>
            <button onClick={onOpenAnalyticsTab} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-primary flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                <FileEdit className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-700">营销分析</span>
            </button>
            <button onClick={onOpenPolicyEntry} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-primary flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-700">录入保单</span>
            </button>
            <button onClick={onOpenScanVerification} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-primary flex items-center justify-center shadow-sm group-active:scale-95 transition-transform">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-700">核销</span>
            </button>
          </div>
        </section>

        {latestOrders.length ? (
          <section className="space-y-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">客户订单</h2>
              <button onClick={onOpenCustomerOrders} className="text-xs font-bold text-primary transition-colors hover:text-primary/80">{ACTION_COPY.viewAll}</button>
            </div>
            <div className="space-y-3">
              {latestOrders.map((order) => {
                const customer = customerMap.get(Number(order.customerId || 0));
                const isActivity = String(order.orderType || '') === 'activity' || /活动|报名|参与/.test(String(order.productName || ''));
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => onOpenRecentCustomerOrder(order)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/[0.03]"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isActivity ? 'bg-blue-50 text-primary' : 'bg-orange-50 text-orange-500'}`}>
                        {isActivity ? <CalendarCheck className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-1 text-sm font-bold text-slate-900">
                            {(customer?.name || `客户#${order.customerId || '-'}`)} · {order.productName || '未命名订单'}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatRelativeTime(String(order.updatedAt || order.createdAt || ''))}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          订单号 {order.orderNo || `ORD-${order.id}`} · {order.paymentStatus || order.status || '订单处理中'}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold text-primary">点击查看订单详情</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1 mb-1">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">今日用户动态</h2>
            <button onClick={onOpenAllCustomerActivities} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">{ACTION_COPY.viewAll}</button>
          </div>
          <div
            ref={activityTickerRef}
            onMouseEnter={() => setActivityTickerPaused(true)}
            onMouseLeave={() => setActivityTickerPaused(false)}
            onTouchStart={() => setActivityTickerPaused(true)}
            onTouchEnd={() => setActivityTickerPaused(false)}
            className={`${latestActivities.length > 1 ? 'h-[11.75rem] overflow-y-auto pr-1 hide-scrollbar' : ''}`}
          >
            {customerActivityFeedLoading && !latestActivities.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                正在加载今天的客户动态...
              </div>
            ) : latestActivities.length ? (
              <div className="space-y-3">
                {scrollingActivities.map((row, index) => {
                const visual = dashboardCustomerActivityVisual(row.category);
                const Icon = visual.icon;
                const owner = customerMap.get(Number(row.userId || 0));
                return (
                    <button
                      key={`${row.id}-${index}`}
                      type="button"
                      onClick={() => onOpenRecentCustomerActivity(row)}
                      className="w-full h-[5.5rem] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left shadow-sm flex gap-3 transition-colors hover:border-primary/35 hover:bg-primary/[0.03]"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${visual.wrapClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start gap-3">
                          <p className="font-bold text-sm text-slate-900 line-clamp-1">
                            {(owner?.name || row.name || `客户#${row.userId || '-'}`)} · {row.event || '客户动态'}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatRelativeTime(String(row.occurredAt || ''))}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-1">
                          {row.detail || row.mobile || '今日客户行为'}
                        </p>
                        <p className="mt-1.5 text-[11px] font-semibold text-primary">点击查看客户详情</p>
                      </div>
                    </button>
                );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                今天还没有客户动态
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function HomeRecentActivityDetailView({
  activity,
  signups,
  loading,
  error,
  onBack,
  onRetry,
  onOpenParticipantCustomer,
}: {
  activity: BHomeActivityDetailItem;
  signups: BShareEffectParticipantRow[];
  loading: boolean;
  error: string;
  onBack: () => void;
  onRetry: () => void;
  onOpenParticipantCustomer: (row: {
    userId: number;
    name: string;
    mobile: string;
    shareType: BEffectShareType;
    targetTitle?: string;
    occurredAt?: string;
    tagLabel?: string;
    summaryPrefix?: string;
  }) => void;
}) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center px-4 py-3">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold flex-1 text-center pr-9 text-slate-900">活动详情</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-52 w-full bg-slate-200">
            {hasImage(activity.image) ? (
              <img src={activity.image} alt={activity.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50">
                <PartyPopper className="h-12 w-12 text-orange-400" />
              </div>
            )}
            <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
              {activity.status}
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Activity Detail</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 line-clamp-2">{activity.title}</h2>
                {activity.orderNo ? <p className="mt-2 text-xs text-slate-500">最近订单号 {activity.orderNo}</p> : null}
              </div>
              <div className="rounded-2xl bg-primary/8 px-3 py-2 text-right shrink-0">
                <p className="text-[11px] text-slate-500">奖励积分</p>
                <p className="text-base font-bold text-primary">{activity.rewardPoints}</p>
              </div>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              {activity.description || '暂无活动详情内容'}
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] text-slate-400">报名人数</p>
                <p className="mt-2 text-xl font-black text-slate-900">{activity.participants}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] text-slate-400">参加人数</p>
                <p className="mt-2 text-xl font-black text-slate-900">{activity.attendees}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[11px] text-slate-400">分享次数</p>
                <p className="mt-2 text-xl font-black text-slate-900">{activity.shares}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">报名客户</h3>
              <p className="mt-1 text-xs text-slate-500">可直接查看是谁报名了这个活动</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              刷新
            </button>
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                正在加载活动详情和报名客户...
              </div>
            ) : null}

            {!loading && error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            {!loading && !error ? (
              signups.length ? (
                signups.map((row) => (
                  <button
                    key={`${row.userId || 0}:${row.mobile || ''}:${row.occurredAt || ''}`}
                    type="button"
                    onClick={() =>
                      onOpenParticipantCustomer({
                        userId: Number(row.userId || 0),
                        name: String(row.name || ''),
                        mobile: String(row.mobile || ''),
                        shareType: 'activity',
                        targetTitle: activity.title,
                        occurredAt: String(row.occurredAt || ''),
                        tagLabel: '活动报名客户',
                        summaryPrefix: '报名活动：',
                      })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{row.name || `客户${row.userId}`}</p>
                        <p className="mt-1 text-sm text-slate-500">{row.mobile || '未留手机号'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                        {row.occurredAt ? new Date(row.occurredAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  当前还没有报名客户
                </div>
              )
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function DashboardCustomerActivityFeedView({
  data,
  loading,
  error,
  dashboardMetrics,
  fallbackRows,
  customers,
  onBack,
  onOpenCustomer,
}: {
  data: BDashboardCustomerActivityFeedResponse | null;
  loading: boolean;
  error: string;
  dashboardMetrics: BDashboardMetricsResponse | null;
  fallbackRows: BDashboardCustomerActivityFeedRow[];
  customers: typeof CUSTOMERS;
  onBack: () => void;
  onOpenCustomer: (customer: (typeof CUSTOMERS)[number]) => void;
}) {
  const rows = data?.list || [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center px-4 py-3">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1 text-center pr-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Customer Activity</p>
            <h1 className="mt-1 text-base font-bold text-slate-900">今日用户动态</h1>
            <p className="mt-1 text-xs text-slate-500">
              {(data?.scope?.label || dashboardMetrics?.scope?.label || '当前统计范围') +
                ' · ' +
                (data?.rangeLabel || '今日') +
                ` · 共 ${Number(data?.total || fallbackRows.length || 0)} 条`}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            正在加载今日用户动态...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          rows.length ? (
            <div className="space-y-3">
              {rows.map((row) => {
                const visual = dashboardCustomerActivityVisual(row.category);
                const Icon = visual.icon;
                const matched = customers.find((item) => Number(item.id || 0) === Number(row.userId || 0));
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      const customerId = Number(row.userId || 0);
                      if (customerId <= 0) return;
                      onOpenCustomer(toDashboardActivityCustomerShell(row, matched));
                    }}
                    className="w-full bg-white px-4 py-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.03]"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${visual.wrapClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-3">
                        <p className="font-bold text-sm text-slate-900 line-clamp-1">
                          {row.name || `客户${row.userId || ''}`} · {row.event || '客户动态'}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {row.occurredAt ? new Date(row.occurredAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                        {row.detail || row.mobile || '今日客户行为'}
                      </p>
                      <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户详情</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              今天还没有客户动态
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}

type CustomerOrderFilterTab = 'all' | 'completed' | 'pending' | 'aftersale';

function toLocalTime(raw?: string) {
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getOrderTab(order: BOrder): CustomerOrderFilterTab {
  const status = String(order.status || '').toLowerCase();
  const payment = String(order.paymentStatus || '').toLowerCase();
  const fulfillment = String(order.fulfillmentStatus || '').toLowerCase();
  const refund = String(order.refundStatus || '').toLowerCase();
  if (refund.includes('processing') || refund.includes('approved') || refund.includes('refund')) return 'aftersale';
  if (status === 'completed' || fulfillment === 'fulfilled' || fulfillment === 'written_off' || status === 'finished') return 'completed';
  if (payment === 'pending' || status === 'pending' || status === 'created' || fulfillment === 'pending') return 'pending';
  return 'all';
}

function canWriteoffOrder(order: BOrder) {
  const payment = String(order.paymentStatus || '').toLowerCase();
  const fulfillment = String(order.fulfillmentStatus || '').toLowerCase();
  const status = String(order.status || '').toLowerCase();
  return (
    payment === 'paid'
    && fulfillment !== 'written_off'
    && fulfillment !== 'fulfilled'
    && status !== 'completed'
    && status !== 'finished'
  );
}

function CustomerOrdersView({
  orders,
  customers,
  onBack,
  initialSelectedOrder = null,
  onWriteoff,
  writeoffSubmittingId = 0,
}: {
  orders: BOrder[];
  customers: typeof CUSTOMERS;
  onBack: () => void;
  initialSelectedOrder?: BOrder | null;
  onWriteoff: (order: BOrder, overrideToken?: string) => Promise<void>;
  writeoffSubmittingId?: number;
}) {
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<CustomerOrderFilterTab>('all');
  const [selected, setSelected] = useState<BOrder | null>(initialSelectedOrder);

  useEffect(() => {
    setSelected(initialSelectedOrder || null);
  }, [initialSelectedOrder]);

  useEffect(() => {
    if (!selected) return;
    const latest = orders.find((order) => Number(order.id || 0) === Number(selected.id || 0));
    if (latest && latest !== selected) setSelected(latest);
  }, [orders, selected]);

  const customerMap = new Map(customers.map((c) => [Number(c.id), c]));
  const filtered = orders.filter((order) => {
    const owner = customerMap.get(Number(order.customerId));
    const hitKeyword = !keyword
      || String(order.productName || '').toLowerCase().includes(keyword.toLowerCase())
      || String(order.orderNo || '').toLowerCase().includes(keyword.toLowerCase())
      || String(owner?.name || '').toLowerCase().includes(keyword.toLowerCase());
    if (!hitKeyword) return false;
    if (tab === 'all') return true;
    return getOrderTab(order) === tab;
  });

  const selectedCustomer = selected ? customerMap.get(Number(selected.customerId)) : null;
  const selectedKind = selected && (String(selected.orderType || '') === 'activity' || /活动|报名|参与/.test(String(selected.productName || ''))) ? '活动' : '商品';
  const selectedCanWriteoff = selected ? canWriteoffOrder(selected) : false;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center px-4 py-3">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold flex-1 text-center pr-9 text-slate-900">客户订单</h1>
        </div>
        {!selected && (
          <>
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3 py-2.5">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索商品、活动、客户或订单号"
                  className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="px-4 flex gap-6 border-b border-slate-100">
              {[
                ['all', '全部订单'],
                ['completed', '已完成'],
                ['pending', '待处理'],
                ['aftersale', '售后中'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key as CustomerOrderFilterTab)}
                  className={`pb-3 text-sm border-b-2 ${
                    tab === key ? 'text-primary border-primary font-bold' : 'text-slate-500 border-transparent font-medium'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {!selected && filtered.map((order) => {
          const customer = customerMap.get(Number(order.customerId));
          const isActivity = String(order.orderType || '') === 'activity' || /活动|报名|参与/.test(String(order.productName || ''));
          return (
            <button
              key={order.id}
              onClick={() => setSelected(order)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex gap-3"
            >
              <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${isActivity ? 'bg-blue-50' : 'bg-orange-50'}`}>
                {isActivity ? <CalendarCheck className="w-7 h-7 text-primary" /> : <Gift className="w-7 h-7 text-orange-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActivity ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    [{isActivity ? '活动' : '商品'}]
                  </span>
                  <p className="text-sm font-semibold text-slate-900 truncate">{order.productName || '未命名订单'}</p>
                </div>
                <p className="text-xs text-slate-500 mt-1">订单编号：{order.orderNo || `ORD-${order.id}`}</p>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>{customer?.name || `客户#${order.customerId}`}</span>
                  <span>{toLocalTime(order.createdAt)}</span>
                </div>
              </div>
            </button>
          );
        })}

        {!selected && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">暂无符合条件的客户订单</div>
        )}

        {selected && (
          <div className="space-y-4">
            <section className="bg-primary/5 rounded-xl p-4 border border-primary/10">
              <div className="flex items-center gap-2 text-primary font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>{selected.fulfillmentStatus === 'fulfilled' || selected.status === 'completed' ? '交易完成' : '订单处理中'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">该订单来自当前业务员可见客户，数据已做隔离</p>
            </section>
            <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-900">订单信息</h3>
              <div className="flex justify-between text-xs"><span className="text-slate-500">订单编号</span><span className="text-slate-800">{selected.orderNo}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">下单时间</span><span className="text-slate-800">{toLocalTime(selected.createdAt)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">客户姓名</span><span className="text-slate-800">{selectedCustomer?.name || `客户#${selected.customerId}`}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">联系电话</span><span className="text-slate-800">{selectedCustomer?.mobile || '-'}</span></div>
            </section>
            <section className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">{selectedKind}详情</h3>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{selected.productName}</span>
                <span className="text-primary font-bold">{Number(selected.pointsAmount || 0)} 积分</span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">数量</span><span className="text-slate-800">x {Number(selected.quantity || 1)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">状态</span><span className="text-slate-800">{selected.status || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">支付状态</span><span className="text-slate-800">{selected.paymentStatus || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">履约状态</span><span className="text-slate-800">{selected.fulfillmentStatus || '-'}</span></div>
              </div>
            </section>
            {selectedCanWriteoff ? (
              <button
                type="button"
                onClick={() => void onWriteoff(selected)}
                disabled={writeoffSubmittingId === Number(selected.id || 0)}
                className="w-full h-12 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {writeoffSubmittingId === Number(selected.id || 0) ? '核销中...' : `核销${selectedKind}`}
              </button>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function CustomersView({
  onOpenDetail,
  onOpenCreate,
  canOpenTags,
  onOpenTags,
  customers,
}: {
  onOpenDetail: (customer: typeof CUSTOMERS[0]) => void;
  onOpenCreate: () => void;
  canOpenTags: boolean;
  onOpenTags: () => void;
  customers: typeof CUSTOMERS;
}) {
  const [keyword, setKeyword] = useState('');
  const filteredCustomers = useMemo(() => {
    const needle = String(keyword || '').trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.mobile,
        customer.activity,
        ...(Array.isArray(customer.tags) ? customer.tags.map((tag) => tag?.text || '') : []),
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    });
  }, [customers, keyword]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex flex-col gap-4 p-4 pb-2 bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">客户库</h1>
          <div className="flex gap-2">
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              <UserPlus className="w-5 h-5" />
            </button>
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索客户姓名、手机号或标签..." 
              className="w-full h-11 pl-10 pr-4 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-primary text-sm placeholder:text-slate-500 outline-none"
            />
          </div>
          <button className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
          {canOpenTags ? (
            <button
              onClick={onOpenTags}
              className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-primary text-white px-4 text-xs font-semibold"
            >
              标签 <ChevronDown className="w-3 h-3" />
            </button>
          ) : null}
          <button className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-slate-100 text-slate-700 px-4 text-xs font-medium">
            意向度 <ChevronDown className="w-3 h-3" />
          </button>
          <button className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-slate-100 text-slate-700 px-4 text-xs font-medium">
            互动 <ChevronDown className="w-3 h-3" />
          </button>
          <button className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-slate-100 text-slate-700 px-4 text-xs font-medium">
            等级 <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Customer List */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
        {filteredCustomers.length ? (
          filteredCustomers.map(customer => (
            <React.Fragment key={customer.id}>
              <SwipeableCard customer={customer} canOpenTags={canOpenTags} onOpenTags={onOpenTags} onOpenDetail={onOpenDetail} />
            </React.Fragment>
          ))
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
            <p className="text-base font-semibold text-slate-900">没有找到匹配的客户</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">试试输入客户姓名、手机号，或者清空搜索条件后重试。</p>
          </section>
        )}
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={onOpenCreate}
        className="absolute bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-20"
      >
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const diff = Date.now() - d.getTime();
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getProtectionPalette(type: string) {
  return {
    borderColor: 'rgba(17,82,212,0.16)',
    background: 'rgba(17,82,212,0.04)',
    badgeBackground: 'rgba(17,82,212,0.08)',
    badgeColor: '#1152d4',
    titleColor: '#0F172A',
    bodyColor: '#64748B',
    metricBorder: 'rgba(17,82,212,0.12)',
  };
}

type ShareRelationshipFilter = 'invited' | 'verified';

type CustomerProfileDetailView =
  | { type: 'main' }
  | { type: 'share-network'; filter: ShareRelationshipFilter }
  | { type: 'policy-overview' }
  | { type: 'policy-category'; categoryType: string }
  | { type: 'interaction-detail'; selectedKey?: string }
  | { type: 'points-detail' };

function buildInteractionRowKey(row: BCustomerInteraction, index: number) {
  return `${row.type}-${row.occurredAt}-${index}`;
}

function CustomerPolicyRadar({
  axes,
  onOpenPolicies,
  actionLabel = '查看保单类别',
  mode = 'detail',
}: {
  axes: InsuranceNeedAxis[];
  onOpenPolicies: () => void;
  actionLabel?: string;
  mode?: 'summary' | 'detail';
}) {
  const isSummary = mode === 'summary';
  if (!axes.length) {
    return (
      <button
        type="button"
        onClick={onOpenPolicies}
        className="w-full rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-primary/20 hover:bg-primary/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <p className="text-sm leading-7 text-slate-500">当前客户还没有足够的保单数据，暂时无法生成保单网状图。</p>
        {!isSummary ? (
          <span className="mt-4 inline-flex items-center justify-center rounded-2xl border border-primary/15 bg-white px-4 py-2 text-sm font-bold text-primary">
            {actionLabel}
          </span>
        ) : (
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            点击进入详情
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </button>
    );
  }

  const width = 420;
  const height = 350;
  const centerX = width / 2;
  const centerY = 164;
  const radius = 114;
  const levels = [0.25, 0.5, 0.75, 1];
  const angleStep = (Math.PI * 2) / axes.length;
  const polarPoint = (score: number, index: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const distance = (Math.max(0, Math.min(100, score)) / 100) * radius;
    return {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      angle,
    };
  };
  const gridPolygon = (ratio: number) =>
    axes
      .map((_, index) => {
        const angle = -Math.PI / 2 + index * angleStep;
        return `${centerX + Math.cos(angle) * radius * ratio},${centerY + Math.sin(angle) * radius * ratio}`;
      })
      .join(' ');
  const points = axes.map((axis, index) => ({
    ...axis,
    ...polarPoint(axis.score, index),
  }));
  const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const strongest = [...axes].sort((a, b) => b.score - a.score || b.coverage - a.coverage)[0];
  const weakest = [...axes].sort((a, b) => a.score - b.score || a.coverage - b.coverage)[0];
  const totalPolicies = axes.reduce((sum, axis) => sum + Number(axis.policyCount || 0), 0);
  const totalPremium = axes.reduce((sum, axis) => sum + Number(axis.annualPremium || 0), 0);
  const totalCoverage = axes.reduce((sum, axis) => sum + Number(axis.coverage || 0), 0);
  const coveredAxes = axes.filter((axis) => Number(axis.policyCount || 0) > 0 || Number(axis.score || 0) > 0).length;

  if (isSummary) {
    return (
      <button
        type="button"
        onClick={onOpenPolicies}
        className="w-full overflow-hidden rounded-[28px] border border-primary/15 bg-white text-left shadow-[0_20px_48px_-40px_rgba(15,23,42,0.16)] transition hover:border-primary/25 hover:bg-primary/[0.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <div className="px-6 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">客户保单视图</p>
              <h4 className="mt-3 text-[17px] font-bold tracking-tight text-slate-900 md:text-[18px]">该客户保单网状图</h4>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/[0.05] px-3 py-1 text-[12px] font-semibold text-primary">
              点击查看
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="border-t border-primary/10 px-6 py-5">
          <div className="rounded-[24px] border border-dashed border-primary/15 bg-primary/[0.02] px-3 py-5">
            <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto max-w-[420px]">
              {levels.map((ratio) => (
                <polygon
                  key={ratio}
                  points={gridPolygon(ratio)}
                  fill={ratio === 1 ? '#F8FBFF' : 'none'}
                  stroke="#DBEAFE"
                  strokeWidth="2"
                />
              ))}
              {points.map((axis, index) => {
                const edge = polarPoint(100, index);
                const label = polarPoint(118, index);
                return (
                  <g key={axis.key}>
                    <line x1={centerX} y1={centerY} x2={edge.x} y2={edge.y} stroke="#DBEAFE" strokeWidth="1.5" />
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor={Math.abs(Math.cos(label.angle)) < 0.25 ? 'middle' : label.x > centerX ? 'start' : 'end'}
                      dominantBaseline={label.y > centerY + 6 ? 'hanging' : label.y < centerY - 6 ? 'auto' : 'middle'}
                      fill="#0F172A"
                      fontSize="14"
                      fontWeight="700"
                    >
                      {axis.label}
                    </text>
                  </g>
                );
              })}
              <polygon points={polygonPoints} fill="rgba(37,99,235,0.12)" stroke="#2563EB" strokeWidth="4" />
              {points.map((point) => (
                <g key={point.key}>
                  <circle cx={point.x} cy={point.y} r="7" fill="#2563EB" />
                  <circle cx={point.x} cy={point.y} r="12" fill="rgba(37,99,235,0.10)" />
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pb-6 2xl:grid-cols-4">
          <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
            <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">保单数量</p>
            <p className="mt-2 text-[26px] font-bold leading-none text-[#0F172A]">{totalPolicies}</p>
          </div>
          <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
            <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">已覆盖层数</p>
            <p className="mt-2 text-[26px] font-bold leading-none text-[#0F172A]">{coveredAxes}</p>
          </div>
          <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
            <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">年度保费</p>
            <p className="mt-2 text-[18px] font-bold leading-tight text-[#0F172A]">{formatCurrency(totalPremium)}</p>
          </div>
          <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
            <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">可识别保额</p>
            <p className="mt-2 text-[18px] font-bold leading-tight text-[#0F172A]">{formatCoverageAmount(totalCoverage)}</p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-primary/15 bg-white shadow-[0_20px_48px_-40px_rgba(15,23,42,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">客户保单视图</p>
          <h4 className="mt-3 text-[17px] font-bold tracking-tight text-slate-900 md:text-[18px]">该客户保单网状图</h4>
          <p className="mt-2 text-[14px] leading-7 text-[#64748B]">
            按当前客户已录入保单归类，点击图形可进入保单视图，再继续查看保单类别与单张保单详情。
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenPolicies}
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-[18px] bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          {actionLabel}
        </button>
      </div>

      <div className="border-t border-primary/10 px-6 py-5">
        <button
          type="button"
          onClick={onOpenPolicies}
          className="block w-full cursor-pointer rounded-[24px] border border-dashed border-primary/15 bg-primary/[0.02] px-3 py-5 text-left transition hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto max-w-[420px]">
            {levels.map((ratio) => (
              <polygon
                key={ratio}
                points={gridPolygon(ratio)}
                fill={ratio === 1 ? '#F8FBFF' : 'none'}
                stroke="#DBEAFE"
                strokeWidth="2"
              />
            ))}
            {points.map((axis, index) => {
              const edge = polarPoint(100, index);
              const label = polarPoint(118, index);
              return (
                <g key={axis.key}>
                  <line x1={centerX} y1={centerY} x2={edge.x} y2={edge.y} stroke="#DBEAFE" strokeWidth="1.5" />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor={Math.abs(Math.cos(label.angle)) < 0.25 ? 'middle' : label.x > centerX ? 'start' : 'end'}
                    dominantBaseline={label.y > centerY + 6 ? 'hanging' : label.y < centerY - 6 ? 'auto' : 'middle'}
                    fill="#0F172A"
                    fontSize="14"
                    fontWeight="700"
                  >
                    {axis.label}
                  </text>
                </g>
              );
            })}
            <polygon points={polygonPoints} fill="rgba(37,99,235,0.12)" stroke="#2563EB" strokeWidth="4" />
            {points.map((point) => (
              <g key={point.key}>
                <circle cx={point.x} cy={point.y} r="7" fill="#2563EB" />
                <circle cx={point.x} cy={point.y} r="12" fill="rgba(37,99,235,0.10)" />
              </g>
            ))}
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 pb-5 2xl:grid-cols-4">
        <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
          <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">保单数量</p>
          <p className="mt-2 text-[26px] font-bold leading-none text-[#0F172A]">{totalPolicies}</p>
        </div>
        <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
          <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">已覆盖层数</p>
          <p className="mt-2 text-[26px] font-bold leading-none text-[#0F172A]">{coveredAxes}</p>
        </div>
        <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
          <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">年度保费</p>
          <p className="mt-2 text-[18px] font-bold leading-tight text-[#0F172A]">{formatCurrency(totalPremium)}</p>
        </div>
        <div className="min-h-[88px] rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-3">
          <p className="text-[11px] font-medium leading-5 text-[#94A3B8]">可识别保额</p>
          <p className="mt-2 text-[18px] font-bold leading-tight text-[#0F172A]">{formatCoverageAmount(totalCoverage)}</p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-primary/10 bg-[#FCFEFF] px-6 py-5 md:grid-cols-2">
        <div className="rounded-[20px] border border-primary/15 bg-primary/[0.04] px-5 py-4">
          <p className="text-[12px] font-semibold text-primary">当前较完整</p>
          <p className="mt-2 text-[22px] font-bold leading-none text-primary">{strongest?.label || '-'}</p>
          <p className="mt-2 text-sm leading-7 text-[#4F6B8C]">
            {strongest ? `${strongest.score} 分 · ${strongest.policyCount} 张保单 · ${formatCoverageAmount(strongest.coverage)}` : '暂无数据'}
          </p>
        </div>
        <div className="rounded-[20px] border border-primary/10 bg-slate-50 px-5 py-4">
          <p className="text-[12px] font-semibold text-[#059669]">优先补看</p>
          <p className="mt-2 text-[22px] font-bold leading-none text-slate-900">{weakest?.label || '-'}</p>
          <p className="mt-2 text-sm leading-7 text-[#4A6B5A]">
            {weakest ? `${weakest.score} 分 · ${weakest.policyCount} 张保单 · ${formatCoverageAmount(weakest.coverage)}` : '暂无数据'}
          </p>
        </div>
      </div>
    </div>
  );
}

function CustomerPolicyCategoryCards({
  categories,
  onSelectCategory,
  onOpenReport,
}: {
  categories: ProtectionDistributionItem[];
  onSelectCategory?: (categoryType: string) => void;
  onOpenReport?: () => void;
}) {
  if (!categories.length) {
    return null;
  }

  return (
    <div className="space-y-5">
      {categories.map((category) => {
        const palette = getProtectionPalette(category.type);
        return (
          <button
            key={category.type}
            type="button"
            onClick={() => onSelectCategory?.(category.type)}
            className={`w-full overflow-hidden rounded-[24px] border bg-white text-left shadow-[0_14px_28px_-32px_rgba(15,23,42,0.14)] transition ${
              onSelectCategory
                ? 'cursor-pointer hover:border-primary/20 hover:bg-primary/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'
                : 'cursor-default'
            }`}
            style={{ borderColor: palette.borderColor }}
          >
            <div className="border-b px-6 py-5" style={{ borderColor: palette.metricBorder }}>
              <p className="text-[22px] font-bold tracking-tight" style={{ color: palette.titleColor }}>
                {category.type}
              </p>
              <p className="mt-3 text-sm leading-7" style={{ color: palette.bodyColor }}>
                这里展示该类别下的全部保单，点击保单可进入单张保单详情，继续查看责任分析报告。
              </p>
            </div>

            <div className="grid gap-3 px-6 py-5 md:grid-cols-3">
              <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: palette.metricBorder, background: palette.background }}>
                <p className="text-[11px] font-medium leading-5 text-slate-400">保单数量</p>
                <p className="mt-2 text-[28px] font-bold leading-none" style={{ color: palette.titleColor }}>
                  {category.policyCount}
                </p>
              </div>
              <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: palette.metricBorder, background: palette.background }}>
                <p className="text-[11px] font-medium leading-5 text-slate-400">年缴保费</p>
                <p className="mt-2 text-[20px] font-bold leading-tight" style={{ color: palette.titleColor }}>
                  {formatCurrency(category.annualPremium)}
                </p>
              </div>
              <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: palette.metricBorder, background: palette.background }}>
                <p className="text-[11px] font-medium leading-5 text-slate-400">可识别保额</p>
                <p className="mt-2 text-[20px] font-bold leading-tight" style={{ color: palette.titleColor }}>
                  {formatCoverageAmount(category.coverage)}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenReport?.();
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-primary/15 bg-primary/[0.03] text-sm font-bold text-primary transition hover:border-primary/25 hover:bg-primary/[0.05]"
              >
                <ShieldCheck className="h-4 w-4" />
                进入完整保单分析报告
              </button>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CustomerPolicyList({
  policies,
  onSelect,
  onEdit,
  onDelete,
  deletingPolicyId,
}: {
  policies: InsurancePolicy[];
  onSelect: (policy: InsurancePolicy) => void;
  onEdit: (policy: InsurancePolicy) => void;
  onDelete: (policy: InsurancePolicy) => void;
  deletingPolicyId?: number | null;
}) {
  return (
    <div className="space-y-3">
      {policies.map((policy, index) => (
        <div
          key={policy.id}
          onClick={() => onSelect(policy)}
          className="group relative block w-full cursor-pointer rounded-[22px] border border-slate-200 bg-white px-5 py-5 text-left shadow-[0_12px_24px_-28px_rgba(15,23,42,0.12)] transition hover:border-primary/20 hover:bg-primary/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(policy);
            }}
            disabled={Number(deletingPolicyId || 0) === Number(policy.id)}
            aria-label={Number(deletingPolicyId || 0) === Number(policy.id) ? '删除中' : '删除保单'}
            title={Number(deletingPolicyId || 0) === Number(policy.id) ? '删除中...' : '删除保单'}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 shadow-[0_12px_24px_-22px_rgba(244,63,94,0.35)] transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4.5 w-4.5" />
            <span className="sr-only">{Number(deletingPolicyId || 0) === Number(policy.id) ? '删除中...' : '删除'}</span>
          </button>
          <div className="space-y-4">
            <div className="rounded-[18px] border border-primary/10 bg-[linear-gradient(180deg,rgba(17,82,212,0.04)_0%,rgba(255,255,255,0.96)_100%)] px-4 py-4 pr-16">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-primary/12 bg-white text-primary shadow-[0_8px_18px_-18px_rgba(17,82,212,0.45)]">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-600 ring-1 ring-green-100">{policy.status}</span>
                  </div>
                  <p
                    className="mt-2 text-[16px] font-semibold leading-[1.4] text-[#0F172A]"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {policy.name}
                  </p>
                  <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#53718F] ring-1 ring-primary/10">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/45" />
                    <span className="truncate">{policy.company}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex min-h-[84px] flex-col justify-between rounded-[16px] border border-primary/10 bg-primary/[0.02] px-3 py-3">
                <p className="text-[11px] font-medium leading-none text-slate-400">被保人</p>
                <p className="mt-3 text-[15px] font-semibold leading-6 text-[#0F172A]">{policy.insured || '-'}</p>
              </div>
              <div className="flex min-h-[84px] flex-col justify-between rounded-[16px] border border-primary/10 bg-primary/[0.02] px-3 py-3">
                <p className="text-[11px] font-medium leading-none text-slate-400">年度保费</p>
                <p className="mt-3 text-[15px] font-semibold leading-6 text-[#0F172A]">{formatCurrency(Number(policy.annualPremium || 0))}</p>
              </div>
              <div className="flex min-h-[84px] flex-col justify-between rounded-[16px] border border-primary/10 bg-primary/[0.02] px-3 py-3">
                <p className="text-[11px] font-medium leading-none text-slate-400">保障额度</p>
                <p className="mt-3 text-[15px] font-semibold leading-6 text-[#0F172A]">{formatCoverageAmount(Number(policy.amount || 0))}</p>
              </div>
              <div className="flex min-h-[84px] flex-col justify-between rounded-[16px] border border-primary/10 bg-primary/[0.02] px-3 py-3">
                <p className="text-[11px] font-medium leading-none text-slate-400">保单生效日</p>
                <p className="mt-3 text-[15px] font-semibold leading-6 text-[#0F172A]">{policy.periodStart || '-'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(policy);
                }}
                disabled={Number(deletingPolicyId || 0) === Number(policy.id)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[14px] border border-[#D7E2F1] bg-white px-4 text-[14px] font-semibold text-[#4E6784] shadow-[0_10px_20px_-22px_rgba(15,23,42,0.22)] transition hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Edit2 className="h-4 w-4" />
                修改
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerShareNetworkDetailView({
  filter,
  onFilterChange,
  shareReferral,
}: {
  filter: ShareRelationshipFilter;
  onFilterChange: (filter: ShareRelationshipFilter) => void;
  shareReferral: BCustomerProfile['shareReferral'];
}) {
  const invitedFriendRows = Array.isArray(shareReferral.invitedFriends) ? shareReferral.invitedFriends : [];
  const verifiedFriendRows = invitedFriendRows.filter((friend) => Boolean(friend.verifiedAt));
  const visibleRows = filter === 'verified' ? verifiedFriendRows : invitedFriendRows;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-primary/15 bg-white px-6 py-6 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.16)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">客户裂变关系</p>
        <h3 className="mt-3 text-[18px] font-bold tracking-tight text-slate-900">查看客户分享来源与裂变好友明细</h3>
        <p className="mt-2 text-sm leading-7 text-[#64748B]">
          点击顶部统计卡可切换查看全部裂变好友或已实名好友。上游分享来源和实名结果都会在这里单独展开。
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onFilterChange('invited')}
            className={`rounded-[20px] border px-5 py-4 text-left transition ${
              filter === 'invited'
                ? 'border-primary/20 bg-primary/[0.05] shadow-[0_16px_30px_-28px_rgba(17,82,212,0.45)]'
                : 'border-primary/10 bg-primary/[0.02] hover:border-primary/20 hover:bg-primary/[0.04]'
            }`}
          >
            <p className="text-[11px] tracking-[0.12em] text-[#94A3B8]">裂变好友</p>
            <p className="mt-2 text-[28px] font-bold text-[#0F172A]">{shareReferral.stats.invitedCount}</p>
            <p className="mt-2 text-xs text-slate-500">查看通过这位客户分享链接进入的全部好友</p>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('verified')}
            className={`rounded-[20px] border px-5 py-4 text-left transition ${
              filter === 'verified'
                ? 'border-emerald-200 bg-emerald-50 shadow-[0_16px_30px_-28px_rgba(16,185,129,0.45)]'
                : 'border-emerald-100 bg-emerald-50/60 hover:border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <p className="text-[11px] tracking-[0.12em] text-emerald-500">已实名</p>
            <p className="mt-2 text-[28px] font-bold text-emerald-700">{shareReferral.stats.verifiedCount}</p>
            <p className="mt-2 text-xs text-slate-500">查看通过分享完成实名的客户明细</p>
          </button>
        </div>
      </section>

      <section className="rounded-[24px] border border-amber-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">上游分享人</p>
            <p className="text-xs text-slate-500">如果这位客户本身是被别人分享进来的，会显示在这里。</p>
          </div>
        </div>

        {shareReferral.upstream ? (
          <div className="mt-4 rounded-[20px] border border-amber-100 bg-amber-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-slate-900">{shareReferral.upstream.name || `客户#${shareReferral.upstream.id}`}</p>
                <p className="mt-1 text-sm text-slate-500">{shareReferral.upstream.mobile || '-'}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                {shareReferral.upstream.label || '上游'}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              绑定时间：{String(shareReferral.upstream.referredAt || shareReferral.upstream.verifiedAt || '').slice(0, 10) || '已记录'}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-dashed border-amber-200 bg-slate-50 p-4 text-sm text-slate-500">
            当前没有标记到上游分享来源。
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{filter === 'verified' ? '已实名好友' : '裂变好友明细'}</p>
              <p className="text-xs text-slate-500">
                {filter === 'verified' ? '仅展示通过分享完成实名的好友。' : '展示全部通过分享进入的好友。'}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-primary/10 bg-primary/[0.03] px-3 py-1 text-[11px] font-semibold text-primary">
            {visibleRows.length} 人
          </span>
        </div>

        {visibleRows.length ? (
          <div className="mt-4 space-y-3">
            {visibleRows.map((friend) => (
              <div key={friend.id} className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-slate-900">{friend.name || `朋友#${friend.id}`}</p>
                    <p className="mt-1 text-sm text-slate-500">{friend.mobile || '-'}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${friend.verifiedAt ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200/70 text-slate-500'}`}>
                    {friend.verifiedAt ? '已实名' : '待实名'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{friend.shareCode ? `分享码 ${String(friend.shareCode).slice(0, 8)}...` : '来源已记录'}</span>
                  <span>{String(friend.referredAt || friend.verifiedAt || '').slice(0, 10) || '已绑定'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-dashed border-primary/15 bg-slate-50 p-4 text-sm text-slate-500">
            {filter === 'verified' ? '当前还没有通过分享完成实名的好友。' : '当前还没有裂变好友。'}
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerInteractionDetailView({
  rows,
  selectedKey,
}: {
  rows: BCustomerInteraction[];
  selectedKey?: string;
}) {
  const selectedRow = rows.find((row, index) => buildInteractionRowKey(row, index) === selectedKey) || null;

  const interactionIcon = (type: string) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('course')) return { Icon: GraduationCap, cls: 'bg-primary/20 text-primary' };
    if (t.includes('activity')) return { Icon: Gamepad2, cls: 'bg-orange-100 text-orange-600' };
    if (t.includes('sign')) return { Icon: CalendarCheck, cls: 'bg-green-100 text-green-600' };
    if (t.includes('redeem')) return { Icon: ShoppingBasket, cls: 'bg-slate-100 text-slate-600' };
    return { Icon: Activity, cls: 'bg-slate-100 text-slate-600' };
  };

  return (
    <div className="space-y-6">
      {selectedRow ? (
        <section className="rounded-[28px] border border-primary/15 bg-white px-6 py-6 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.16)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">互动详情</p>
          <h3 className="mt-3 text-[20px] font-bold tracking-tight text-slate-900">{selectedRow.title}</h3>
          <p className="mt-2 text-sm leading-7 text-[#64748B]">{selectedRow.detail || '暂无补充说明'}</p>
          <div className="mt-4 inline-flex rounded-full border border-primary/10 bg-primary/[0.03] px-3 py-1.5 text-xs font-semibold text-primary">
            {formatRelativeTime(selectedRow.occurredAt)} · {selectedRow.occurredAt.slice(0, 19).replace('T', ' ')}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">互动轨迹详情</p>
            <h3 className="mt-2 text-[18px] font-bold text-slate-900">展示全部互动记录</h3>
            <p className="mt-1 text-sm leading-7 text-slate-500">按最近时间倒序展示客户在知识学习、活动、签到和兑换等轨迹。</p>
          </div>
          <span className="rounded-full border border-primary/10 bg-primary/[0.03] px-3 py-1 text-[11px] font-semibold text-primary">
            {rows.length} 条
          </span>
        </div>

        {rows.length ? (
          <div className="mt-5 space-y-4">
            {rows.map((row, index) => {
              const icon = interactionIcon(row.type);
              const isSelected = buildInteractionRowKey(row, index) === selectedKey;
              return (
                <div
                  key={buildInteractionRowKey(row, index)}
                  className={`flex gap-4 rounded-[20px] border px-4 py-4 transition ${
                    isSelected ? 'border-primary/20 bg-primary/[0.03]' : 'border-slate-100 bg-slate-50/70'
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${icon.cls}`}>
                    <icon.Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                      <span className="text-xs text-slate-400">{formatRelativeTime(row.occurredAt)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{row.detail || '暂无补充说明'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            暂无互动轨迹。
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerPointsDetailView({
  rows,
  currentBalance,
}: {
  rows: BCustomerProfile['points']['transactions'];
  currentBalance: number;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-primary/15 bg-white px-6 py-6 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.16)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">积分流水详情</p>
        <h3 className="mt-3 text-[20px] font-bold tracking-tight text-slate-900">查看全部积分收支记录</h3>
        <p className="mt-2 text-sm leading-7 text-[#64748B]">展示客户积分的收入来源、支出来源、发生时间和变动数额。</p>
        <div className="mt-4 inline-flex rounded-full border border-primary/10 bg-primary/[0.03] px-3 py-1.5 text-xs font-semibold text-primary">
          当前余额：{Number(currentBalance || 0).toLocaleString('zh-CN')} pts
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">全部流水</p>
            <h3 className="mt-2 text-[18px] font-bold text-slate-900">按最近时间倒序展示</h3>
            <p className="mt-1 text-sm leading-7 text-slate-500">便于业务员快速确认客户当前积分来源和使用情况。</p>
          </div>
          <span className="rounded-full border border-primary/10 bg-primary/[0.03] px-3 py-1 text-[11px] font-semibold text-primary">
            {rows.length} 条
          </span>
        </div>

        {rows.length ? (
          <div className="mt-5 space-y-3">
            {rows.map((row) => {
              const isIncome = Number(row.amount || 0) >= 0;
              return (
                <div key={row.id} className="rounded-[20px] border border-slate-100 bg-slate-50/70 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{row.detail || '-'}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatRelativeTime(row.occurredAt)} · {row.occurredAt.slice(0, 19).replace('T', ' ')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[18px] font-bold ${isIncome ? 'text-green-600' : 'text-slate-900'}`}>
                        {isIncome ? '+' : ''}
                        {row.amount}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">余额 {Number(row.balance || 0).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            暂无积分流水。
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerPolicyOverviewDetailView({
  axes,
  categories,
  onOpenCategory,
  onOpenReport,
}: {
  axes: InsuranceNeedAxis[];
  categories: ProtectionDistributionItem[];
  onOpenCategory: (categoryType: string) => void;
  onOpenReport: () => void;
}) {
  return (
    <div className="space-y-6">
      <section>
        <CustomerPolicyRadar
          axes={axes}
          onOpenPolicies={() => {
            if (categories[0]) onOpenCategory(categories[0].type);
          }}
          actionLabel="查看保单类别"
        />
      </section>

      <section className="overflow-hidden rounded-[28px] border border-primary/15 bg-white shadow-[0_20px_48px_-38px_rgba(15,23,42,0.16)]">
        <div className="border-b border-primary/10 px-6 py-6">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">客户保单类别</p>
            <h3 className="mt-3 text-[16px] font-bold tracking-tight text-slate-900 md:text-[18px]">点击类别卡片进入对应类别详情页面</h3>
            <p className="mt-2 text-[14px] leading-7 text-[#64748B]">
              先看保障结构，再按类别进入具体保单。进入类别详情后，会展示该类别下的全部保单和保障数据。
            </p>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          {categories.length ? (
            <CustomerPolicyCategoryCards categories={categories} onSelectCategory={onOpenCategory} onOpenReport={onOpenReport} />
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm leading-7 text-slate-500">
              当前客户还没有可归类的保单数据。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CustomerPolicyCategoryDetailView({
  category,
  policies,
  onSelectPolicy,
  onEditPolicy,
  onDeletePolicy,
  deletingPolicyId,
  onOpenReport,
}: {
  category: ProtectionDistributionItem | null;
  policies: InsurancePolicy[];
  onSelectPolicy: (policy: InsurancePolicy) => void;
  onEditPolicy: (policy: InsurancePolicy) => void;
  onDeletePolicy: (policy: InsurancePolicy) => void;
  deletingPolicyId?: number | null;
  onOpenReport: () => void;
}) {
  if (!category) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm leading-7 text-slate-500">
        当前没有找到这个保单类别。
      </div>
    );
  }

  const palette = getProtectionPalette(category.type);

  return (
    <div className="space-y-6">
      <section
        className="overflow-hidden rounded-[28px] border bg-white shadow-[0_20px_48px_-38px_rgba(15,23,42,0.16)]"
        style={{ borderColor: palette.borderColor }}
      >
        <div className="border-b px-6 py-6" style={{ borderColor: palette.metricBorder }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: palette.badgeColor }}>
            保单类别详情
          </p>
          <h3 className="mt-3 text-[20px] font-bold tracking-tight" style={{ color: palette.titleColor }}>
            {category.type}
          </h3>
          <p className="mt-2 text-sm leading-7" style={{ color: palette.bodyColor }}>
            这里展示该类别下的全部保单，点击保单可进入单张保单详情，继续查看责任分析报告。
          </p>
        </div>

        <div className="grid gap-3 px-6 py-5 md:grid-cols-3">
          <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: palette.metricBorder, background: palette.background }}>
            <p className="text-[11px] font-medium leading-5 text-slate-400">保单数量</p>
            <p className="mt-2 text-[28px] font-bold leading-none" style={{ color: palette.titleColor }}>
              {category.policyCount}
            </p>
          </div>
          <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: palette.metricBorder, background: palette.background }}>
            <p className="text-[11px] font-medium leading-5 text-slate-400">年缴保费</p>
            <p className="mt-2 text-[20px] font-bold leading-tight" style={{ color: palette.titleColor }}>
              {formatCurrency(category.annualPremium)}
            </p>
          </div>
          <div className="rounded-[18px] border px-4 py-4" style={{ borderColor: palette.metricBorder, background: palette.background }}>
            <p className="text-[11px] font-medium leading-5 text-slate-400">可识别保额</p>
            <p className="mt-2 text-[20px] font-bold leading-tight" style={{ color: palette.titleColor }}>
              {formatCoverageAmount(category.coverage)}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onOpenReport}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-primary/15 bg-primary/[0.03] text-sm font-bold text-primary transition hover:border-primary/25 hover:bg-primary/[0.05]"
          >
            <ShieldCheck className="h-4 w-4" />
            进入完整保单分析报告
          </button>
        </div>
      </section>

      {policies.length ? (
        <CustomerPolicyList
          policies={policies}
          onSelect={onSelectPolicy}
          onEdit={onEditPolicy}
          onDelete={onDeletePolicy}
          deletingPolicyId={deletingPolicyId}
        />
      ) : (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm leading-7 text-slate-500">
          当前类别下还没有保单。
        </div>
      )}
    </div>
  );
}

function CustomerProfileView({ onBack, customer }: { onBack: () => void; customer: typeof CUSTOMERS[0] }) {
  const [profile, setProfile] = useState<BCustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [detailView, setDetailView] = useState<CustomerProfileDetailView>({ type: 'main' });
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
  const [showFamilyReport, setShowFamilyReport] = useState(false);
  const [deletingPolicyId, setDeletingPolicyId] = useState<number | null>(null);

  const loadProfile = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setRefreshing(!showLoading);
    setError('');
    try {
      const res = await bApi.customerProfile(Number(customer.id));
      setProfile(res);
    } catch (err: any) {
      setError(err?.message || ERROR_COPY.trackLoadFailed);
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    const guardedLoad = async (showLoading = false) => {
      if (disposed) return;
      await loadProfile(showLoading);
    };
    guardedLoad(true);
    const timer = window.setInterval(() => {
      guardedLoad(false);
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [customer.id]);

  const interactionRows = Array.isArray(profile?.interactionTimeline) ? profile!.interactionTimeline : [];
  const pointRows = Array.isArray(profile?.points?.transactions) ? profile!.points.transactions : [];
  const policyRows = Array.isArray(profile?.policies) ? profile!.policies : [];
  const shareReferral = profile?.shareReferral || { upstream: null, invitedFriends: [], stats: { invitedCount: 0, verifiedCount: 0 } };
  const upstreamReferral = shareReferral.upstream;
  const insuranceNeedAxes = useMemo(() => buildInsuranceNeedAxes(policyRows), [policyRows]);
  const policyCategories = useMemo(() => buildProtectionDistribution(policyRows), [policyRows]);
  const interactionPreviewRows = interactionRows.slice(0, 5);
  const pointPreviewRows = pointRows.slice(0, 5);
  const policyRowsByCategory = useMemo(() => {
    const grouped = new Map<string, InsurancePolicy[]>();
    for (const policy of policyRows) {
      const key = inferProtectionType(policy);
      const current = grouped.get(key) || [];
      current.push(policy);
      grouped.set(key, current);
    }
    return grouped;
  }, [policyRows]);
  const selectedPolicyCategory =
    detailView.type === 'policy-category'
      ? policyCategories.find((category) => category.type === detailView.categoryType) || null
      : null;
  const selectedCategoryPolicies =
    detailView.type === 'policy-category' ? policyRowsByCategory.get(detailView.categoryType) || [] : [];

  const openProfileMain = () => setDetailView({ type: 'main' });
  const openShareNetwork = (filter: ShareRelationshipFilter) => setDetailView({ type: 'share-network', filter });
  const openPolicyOverview = () => setDetailView({ type: 'policy-overview' });
  const openPolicyCategory = (categoryType: string) => setDetailView({ type: 'policy-category', categoryType });
  const openInteractionDetail = (selectedKey?: string) => setDetailView({ type: 'interaction-detail', selectedKey });
  const openPointsDetail = () => setDetailView({ type: 'points-detail' });
  const handleBack = () => {
    if (detailView.type === 'main') {
      onBack();
      return;
    }
    openProfileMain();
  };
  const viewTitle =
    detailView.type === 'main'
      ? '客户档案'
      : detailView.type === 'share-network'
        ? '客户裂变关系'
        : detailView.type === 'policy-overview'
          ? '客户保单视图'
          : detailView.type === 'policy-category'
            ? detailView.categoryType
            : detailView.type === 'interaction-detail'
              ? '互动轨迹详情'
              : '积分流水详情';

  const handleDeletePolicy = async (policy: InsurancePolicy) => {
    if (Number(deletingPolicyId || 0) === Number(policy.id)) return;
    const confirmed = window.confirm(`确认删除保单“${policy.name}”吗？删除后不可恢复。`);
    if (!confirmed) return;
    try {
      setDeletingPolicyId(Number(policy.id));
      await bApi.deletePolicy(Number(policy.id));
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          policies: Array.isArray(prev.policies)
            ? prev.policies.filter((item) => Number(item.id || 0) !== Number(policy.id))
            : [],
        };
      });
      if (Number(selectedPolicy?.id || 0) === Number(policy.id)) setSelectedPolicy(null);
      if (Number(editingPolicy?.id || 0) === Number(policy.id)) setEditingPolicy(null);
      void loadProfile(false);
    } catch (err: any) {
      showApiError(err, '保单删除失败，请稍后重试');
      void loadProfile(false);
    } finally {
      setDeletingPolicyId(null);
    }
  };

  const interactionIcon = (type: string) => {
    const t = String(type || '').toLowerCase();
    if (t.includes('course')) return { Icon: GraduationCap, cls: 'bg-primary/20 text-primary' };
    if (t.includes('activity')) return { Icon: Gamepad2, cls: 'bg-orange-100 text-orange-600' };
    if (t.includes('sign')) return { Icon: CalendarCheck, cls: 'bg-green-100 text-green-600' };
    if (t.includes('redeem')) return { Icon: ShoppingBasket, cls: 'bg-slate-100 text-slate-600' };
    return { Icon: Activity, cls: 'bg-slate-100 text-slate-600' };
  };

  const mainContent =
    detailView.type === 'main' ? (
      <>
        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative shrink-0">
              {hasImage(customer.avatar) ? (
                <img
                  src={customer.avatar}
                  alt={customer.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10 text-2xl font-black text-primary">
                  {getInitials(customer.name)}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{customer.name}</h2>
              <p className="text-sm text-slate-500">
                {customer.mobile ? `手机号：${customer.mobile}` : `客户 ID：${Number(customer.id || 0)}`}
              </p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs font-semibold px-3 py-1 bg-primary text-white rounded-full">活跃</span>
                <button className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> {ACTION_COPY.edit}
                </button>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">客户电话</label>
              <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{customer.mobile || '-'}</div>
            </div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">业务员私有备注</label>
            <div className="relative group">
              <textarea
                className="w-full bg-slate-50 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/50 min-h-[100px] transition-all resize-none outline-none text-slate-700"
                placeholder="填写真实客户备注，未保存前不会自动生成演示内容。"
                defaultValue=""
              ></textarea>
              <div className="absolute top-2 right-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <Save className="w-5 h-5" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">分享关系</p>
              <h3 className="mt-2 text-[16px] font-bold text-slate-900">客户裂变关系</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">点击下面卡片进入裂变详情页，查看全部好友或已实名好友。</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openShareNetwork('invited')}
              className="rounded-[18px] border border-primary/10 bg-primary/[0.03] px-4 py-4 text-left transition hover:border-primary/20 hover:bg-primary/[0.05]"
            >
              <p className="text-[11px] tracking-[0.12em] text-[#94A3B8]">裂变好友</p>
              <p className="mt-1 text-[22px] font-bold text-[#0F172A]">{shareReferral.stats.invitedCount}</p>
              <p className="mt-2 text-xs text-slate-500">点击查看全部裂变好友明细</p>
            </button>
            <button
              type="button"
              onClick={() => openShareNetwork('verified')}
              className="rounded-[18px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/80"
            >
              <p className="text-[11px] tracking-[0.12em] text-emerald-500">已实名</p>
              <p className="mt-1 text-[22px] font-bold text-emerald-700">{shareReferral.stats.verifiedCount}</p>
              <p className="mt-2 text-xs text-slate-500">点击查看已实名好友详情</p>
            </button>
          </div>

          <div className="mt-4 rounded-[20px] border border-amber-100 bg-amber-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">上游分享人</p>
                <p className="mt-1 text-sm text-slate-500">
                  {upstreamReferral ? `${upstreamReferral.name || `客户#${upstreamReferral.id}`} · ${upstreamReferral.mobile || '-'}` : '当前没有标记到上游分享来源。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openShareNetwork('invited')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
              >
                查看
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section>
          <CustomerPolicyRadar axes={insuranceNeedAxes} onOpenPolicies={openPolicyOverview} actionLabel="进入保单视图" mode="summary" />
        </section>

        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-900">互动轨迹</h3>
              <p className="mt-1 text-xs text-slate-500">仅展示最近 5 条，点击可进入详情页。</p>
            </div>
            <button type="button" onClick={() => openInteractionDetail()} className="text-primary text-xs font-semibold">
              {ACTION_COPY.viewAll}
            </button>
          </div>
          {loading ? <div className="text-sm text-slate-400">加载中...</div> : null}
          {error ? <div className="text-sm text-rose-500">{error}</div> : null}
          {!loading && !error ? (
            interactionPreviewRows.length ? (
              <div className="space-y-6 relative ml-2">
                <div className="absolute left-[15px] top-8 bottom-8 w-0.5 bg-slate-100"></div>
                {interactionPreviewRows.map((row, idx) => {
                  const icon = interactionIcon(row.type);
                  const rowKey = buildInteractionRowKey(row, idx);
                  return (
                    <button
                      key={rowKey}
                      type="button"
                      onClick={() => openInteractionDetail(rowKey)}
                      className="flex w-full gap-4 relative text-left rounded-[18px] transition hover:bg-primary/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${icon.cls}`}>
                        <icon.Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 pb-2 pr-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{row.detail || '-'} • {formatRelativeTime(row.occurredAt)}</p>
                          </div>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-400">暂无互动轨迹</div>
            )
          ) : null}
        </section>

        <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-900 mb-4">标签与画像</h3>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">VIP等级</span>
            <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">养老意向</span>
            <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">传承线索</span>
            <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">马拉松爱好者</span>
            <button className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform shadow-sm">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={openPointsDetail}
          className="block w-full rounded-xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-primary/20 hover:bg-primary/[0.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-900">积分流水</h3>
              <p className="text-xs text-slate-500 mt-0.5">当前余额: {Number(profile?.points?.currentBalance || 0).toLocaleString('zh-CN')} pts · 仅展示最近 5 条</p>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
              <Filter className="w-4 h-4" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-50">
                <tr>
                  <th className="pb-3 font-semibold">活动</th>
                  <th className="pb-3 font-semibold text-right">积分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pointPreviewRows.length ? (
                  pointPreviewRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3">
                        <p className="font-medium text-slate-900">{row.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{row.detail || '-'} • {formatRelativeTime(row.occurredAt)}</p>
                      </td>
                      <td className={`py-3 text-right font-bold ${row.amount >= 0 ? 'text-green-600' : 'text-slate-900'}`}>
                        {row.amount >= 0 ? '+' : ''}{row.amount}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-4 text-sm text-slate-400" colSpan={2}>暂无积分流水</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </button>
      </>
    ) : detailView.type === 'share-network' ? (
      <CustomerShareNetworkDetailView
        filter={detailView.filter}
        onFilterChange={openShareNetwork}
        shareReferral={shareReferral}
      />
    ) : detailView.type === 'policy-overview' ? (
      <CustomerPolicyOverviewDetailView
        axes={insuranceNeedAxes}
        categories={policyCategories}
        onOpenCategory={openPolicyCategory}
        onOpenReport={() => setShowFamilyReport(true)}
      />
    ) : detailView.type === 'policy-category' ? (
      <CustomerPolicyCategoryDetailView
        category={selectedPolicyCategory}
        policies={selectedCategoryPolicies}
        onSelectPolicy={setSelectedPolicy}
        onEditPolicy={(policy) => {
          setSelectedPolicy(null);
          setEditingPolicy(policy);
        }}
        onDeletePolicy={(policy) => void handleDeletePolicy(policy)}
        deletingPolicyId={deletingPolicyId}
        onOpenReport={() => setShowFamilyReport(true)}
      />
    ) : detailView.type === 'points-detail' ? (
      <CustomerPointsDetailView rows={pointRows} currentBalance={Number(profile?.points?.currentBalance || 0)} />
    ) : (
      <CustomerInteractionDetailView rows={interactionRows} selectedKey={detailView.selectedKey} />
    );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-[70] absolute inset-0">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">{viewTitle}</h1>
          {detailView.type === 'main' ? (
            <button
              onClick={() => loadProfile(false)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              title="刷新轨迹"
            >
              <RefreshCw className={`w-5 h-5 text-slate-700 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">{mainContent}</main>

      {editingPolicy ? (
        <PolicyEntryView
          onBack={() => setEditingPolicy(null)}
          customers={[customer]}
          selectedCustomer={customer}
          initialPolicy={editingPolicy}
          onSaved={async () => {
            await loadProfile(false);
            setEditingPolicy(null);
          }}
        />
      ) : null}
      {selectedPolicy ? (
        <InsurancePolicyDetailSheet
          customerId={Number(customer.id)}
          policy={selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
          loadFamilyPolicies={async () => policyRows}
          familyReportCustomerName={customer.name}
        />
      ) : null}
      {showFamilyReport ? (
        <FamilyPolicyReportSheet
          customerId={Number(customer.id)}
          onClose={() => setShowFamilyReport(false)}
          loadPolicies={async () => policyRows}
          customerName={customer.name}
          scopeLabel="客户库内已录入保单"
        />
      ) : null}
    </div>
  );
}

function TagEditorView({ onBack }: { onBack: () => void }) {
  const [showCustomTagModal, setShowCustomTagModal] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-[70] absolute inset-0">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-primary/10 shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onBack} className="flex items-center justify-center p-2 rounded-full hover:bg-primary/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">编辑标签</h1>
          <button className="text-primary font-bold px-4 py-2 hover:bg-primary/10 rounded-lg transition-colors">{ACTION_COPY.save}</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Selected Tags Section */}
        <section className="p-4 bg-white mb-2">
          <h2 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">已选标签</h2>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm shadow-primary/20">
              VIP
              <X className="w-4 h-4 cursor-pointer" />
            </div>
            <div className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm shadow-primary/20">
              高潜力
              <X className="w-4 h-4 cursor-pointer" />
            </div>
            <div className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm shadow-primary/20">
              重疾险意向
              <X className="w-4 h-4 cursor-pointer" />
            </div>
          </div>
        </section>

        {/* Search Bar */}
        <div className="px-4 py-3">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
            </div>
            <input 
              type="text" 
              className="block w-full pl-10 pr-4 py-3 bg-white border-none rounded-xl text-sm focus:ring-2 focus:ring-primary shadow-sm outline-none" 
              placeholder="搜索标签..." 
            />
          </div>
        </div>

        {/* Recommended Tags (AI Suggested) */}
        <section className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-slate-800">推荐标签 (AI)</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary hover:text-white transition-all">
              养老规划
            </button>
            <button className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary hover:text-white transition-all">
              教育金需求
            </button>
            <button className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary hover:text-white transition-all">
              高净值
            </button>
            <button
              onClick={() => setShowCustomTagModal(true)}
              className="bg-white text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:border-primary hover:text-primary transition-all"
            >
              + 自定义
            </button>
          </div>
        </section>

        {/* Tag Library Categories */}
        <div className="space-y-6 mt-4 px-4">
          {/* Category: Customer Intent */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1 h-3 bg-primary rounded-full"></span>
              意向程度
            </h3>
            <div className="flex flex-wrap gap-2">
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">强意向</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">中等意向</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">观望中</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">无意向</button>
            </div>
          </section>

          {/* Category: Product Interest */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1 h-3 bg-primary rounded-full"></span>
              产品意向
            </h3>
            <div className="flex flex-wrap gap-2">
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">医疗险</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">年金险</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">家庭财产险</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">意外险</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">定期寿险</button>
            </div>
          </section>

          {/* Category: Family Status */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-1 h-3 bg-primary rounded-full"></span>
              家庭情况
            </h3>
            <div className="flex flex-wrap gap-2">
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">单身贵族</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">新婚夫妇</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">三口之家</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">二胎家庭</button>
              <button className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-200 transition-colors">退休生活</button>
            </div>
          </section>
        </div>

        {/* Custom Tag Input */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="flex-1 relative">
              <input 
                type="text" 
                className="w-full pl-4 pr-10 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary shadow-inner outline-none" 
                placeholder="添加自定义标签..." 
              />
              <button
                onClick={() => setShowCustomTagModal(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5 bg-primary text-white rounded-lg"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {showCustomTagModal && (
          <div className="absolute inset-0 z-[60]">
            <button
              aria-label="close-custom-tag-modal"
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
              onClick={() => setShowCustomTagModal(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 p-5">
              <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mb-4"></div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-2xl font-bold text-slate-900">添加自定义标签</h3>
                <button
                  onClick={() => setShowCustomTagModal(false)}
                  className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div>
                <p className="text-base font-bold text-slate-900 mb-2">标签名称</p>
                <div className="relative">
                  <input
                    maxLength={10}
                    className="w-full h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-20 text-lg outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="请输入标签名称..."
                  />
                  <span className="absolute right-3 bottom-3 text-xs text-slate-400">0 / 10</span>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-sm text-slate-400 font-bold mb-3">快捷推荐</p>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-base">VIP</button>
                  <button className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-base">待跟进</button>
                  <button className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-base">已邀约</button>
                </div>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowCustomTagModal(false)}
                  className="h-12 rounded-xl bg-slate-100 text-slate-700 font-bold text-lg"
                >
                  取消
                </button>
                <button
                  onClick={() => setShowCustomTagModal(false)}
                  className="h-12 rounded-xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AddContentManageView({
  onBack,
  onSaved,
  initialItem,
}: {
  onBack: () => void;
  onSaved: () => void;
  initialItem?: any;
}) {
  const isEdit = Boolean(initialItem?.id);
  const [title, setTitle] = useState(String(initialItem?.title || '2024年人寿保险最新理赔指南'));
  const [body, setBody] = useState(String(initialItem?.description || '本指南旨在为保险经纪人提供最新的理赔流程及注意事项。在协助客户进行理赔时，请务必确认以下材料的完整性。'));
  const [rewardPoints, setRewardPoints] = useState(Number(initialItem?.rewardPoints || 50));
  const [sortOrder, setSortOrder] = useState(Number(initialItem?.sortOrder ?? initialItem?.order ?? 1));
  const [status, setStatus] = useState(String(initialItem?.rawStatus || 'published'));
  const [media, setMedia] = useState<Array<{ name: string; type: string; preview: string; url?: string; path?: string }>>(
    Array.isArray(initialItem?.media)
      ? initialItem.media.map((m: any, idx: number) =>
          typeof m === 'string'
            ? { name: `media-${idx + 1}`, type: 'image/*', preview: m, url: m }
            : {
                name: String(m?.name || `media-${idx + 1}`),
                type: String(m?.type || 'image/*'),
                preview: String(m?.preview || m?.url || m?.path || ''),
                url: String(m?.url || m?.preview || ''),
                path: String(m?.path || ''),
              }
        )
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputId = 'b-add-content-media';

  useEffect(() => {
    setTitle(String(initialItem?.title || '2024年人寿保险最新理赔指南'));
    setBody(String(initialItem?.description || '本指南旨在为保险经纪人提供最新的理赔流程及注意事项。在协助客户进行理赔时，请务必确认以下材料的完整性。'));
    setRewardPoints(Number(initialItem?.rewardPoints || 50));
    setSortOrder(Number(initialItem?.sortOrder ?? initialItem?.order ?? 1));
    setStatus(String(initialItem?.rawStatus || 'published'));
    setMedia(
      Array.isArray(initialItem?.media)
        ? initialItem.media.map((m: any, idx: number) =>
            typeof m === 'string'
              ? { name: `media-${idx + 1}`, type: 'image/*', preview: m, url: m }
              : {
                  name: String(m?.name || `media-${idx + 1}`),
                  type: String(m?.type || 'image/*'),
                  preview: String(m?.preview || m?.url || m?.path || ''),
                  url: String(m?.url || m?.preview || ''),
                  path: String(m?.path || ''),
                }
          )
        : []
    );
  }, [initialItem]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (uploading) return;
    const convert = (file: File) =>
      new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', dataUrl: String(reader.result || '') });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    try {
      setUploading(true);
      const picked = await Promise.all(Array.from(files).slice(0, 3 - media.length).map(convert));
      const uploaded = await Promise.all(
        picked.map(async (item) => {
          const resp = await bApi.uploadMediaBase64({ name: item.name, type: item.type, dataUrl: item.dataUrl });
          return {
            name: resp.file.name || item.name,
            type: resp.file.type || item.type,
            preview: resp.file.url,
            url: resp.file.url,
            path: resp.file.path,
          };
        })
      );
      setMedia((prev) => [...prev, ...uploaded].slice(0, 3));
    } catch (e: any) {
      showApiError(e, ERROR_COPY.mediaUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (saving || uploading) return;
    try {
      setSaving(true);
      const payload = {
        title,
        body,
        rewardPoints,
        sortOrder,
        status,
        media,
      };
      if (isEdit) {
        await bApi.updateContentItem(Number(initialItem.id), payload);
      } else {
        await bApi.createContentItem(payload);
      }
      onSaved();
      onBack();
    } catch (e: any) {
      showApiError(e, ERROR_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-[70] absolute inset-0">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors">
          <X className="w-7 h-7 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{isEdit ? '编辑知识学习' : '新增知识学习'}</h1>
        <button onClick={submit} className="px-5 h-10 rounded-full bg-primary text-white font-bold text-base shadow-lg shadow-primary/20">{saving ? ACTION_COPY.saving : ACTION_COPY.save}</button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28 p-4 space-y-5">
        <label className="block">
          <span className="text-base font-bold text-slate-900">标题</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 h-12 text-base outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        <label className="block">
          <span className="text-base font-bold text-slate-900">内容详情</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-base leading-relaxed outline-none focus:ring-2 focus:ring-primary/30 min-h-72 resize-none" />
        </label>

        <section>
          <h2 className="text-base font-bold text-slate-900">图片/视频</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {media.map((m, idx) => (
              <div key={`${m.name}-${idx}`} className="rounded-3xl h-28 bg-white border border-slate-200 shadow-sm overflow-hidden relative">
                {String(m.type).startsWith('video/') ? (
                  <video src={m.preview} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.preview} className="w-full h-full object-cover" />
                )}
                <button onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {media.length < 3 && (
              <>
                <input id={fileInputId} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
                <label htmlFor={fileInputId} className="rounded-3xl h-28 border-2 border-dashed border-slate-200 text-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <ImageIcon className="w-7 h-7 text-primary" />
                  <span className="text-sm">{uploading ? '上传中...' : '上传媒体'}</span>
                </label>
              </>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-base font-bold text-slate-900 mb-2">奖励积分</p>
            <input type="number" value={rewardPoints} onChange={(e) => setRewardPoints(Number(e.target.value || 0))} className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xl font-bold outline-none" />
          </div>
          <div>
            <SortOrderEditor value={sortOrder} onChange={setSortOrder} />
          </div>
        </section>
        <label className="block">
          <span className="text-base font-bold text-slate-900">状态</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 h-12 text-base outline-none focus:ring-2 focus:ring-primary/30"
          >
            {CONTENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </main>
    </div>
  );
}

function normalizeSortOrderValue(value: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 1;
  return Math.min(99, Math.max(1, Math.round(next)));
}

function SortOrderEditor({
  value,
  onChange,
  hint = '数字越小，在列表中越靠前',
}: {
  value: number;
  onChange: (next: number) => void;
  hint?: string;
}) {
  const normalized = normalizeSortOrderValue(value);

  return (
    <div className="mt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-slate-900">排序</p>
          <p className="text-xs text-slate-500 mt-1">{hint}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-2 py-2">
          <button
            type="button"
            onClick={() => onChange(normalizeSortOrderValue(normalized - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-2xl font-semibold leading-none text-slate-500 transition-colors hover:bg-slate-50"
            aria-label="减少排序"
          >
            -
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(normalized)}
            onChange={(e) => {
              const digits = String(e.target.value || '').replace(/\D+/g, '');
              onChange(normalizeSortOrderValue(Number(digits || 1)));
            }}
            className="h-10 w-14 rounded-xl border border-slate-200 bg-white text-center text-xl font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => onChange(normalizeSortOrderValue(normalized + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-2xl font-semibold leading-none text-slate-500 transition-colors hover:bg-slate-50"
            aria-label="增加排序"
          >
            +
          </button>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={99}
        value={normalized}
        onChange={(e) => onChange(normalizeSortOrderValue(Number(e.target.value || 1)))}
        className="mt-4 w-full accent-primary"
      />
    </div>
  );
}

function AddMallProductView({
  onBack,
  onSaved,
  initialItem,
}: {
  onBack: () => void;
  onSaved: () => void;
  initialItem?: any;
}) {
  const isEdit = Boolean(initialItem?.id);
  const [name, setName] = useState(String(initialItem?.title || ''));
  const [desc, setDesc] = useState(String(initialItem?.description || ''));
  const [points, setPoints] = useState(Number(initialItem?.points || 1000));
  const [stock, setStock] = useState(Number(initialItem?.stock || 99));
  const [sortOrder, setSortOrder] = useState(Number(initialItem?.sortOrder ?? initialItem?.order ?? 1));
  const [status, setStatus] = useState(String(initialItem?.rawStatus || 'active'));
  const [media, setMedia] = useState<Array<{ name: string; type: string; preview: string; url?: string; path?: string }>>(
    Array.isArray(initialItem?.media)
      ? initialItem.media.map((m: any, idx: number) =>
          typeof m === 'string'
            ? { name: `media-${idx + 1}`, type: 'image/*', preview: m, url: m }
            : {
                name: String(m?.name || `media-${idx + 1}`),
                type: String(m?.type || 'image/*'),
                preview: String(m?.preview || m?.url || m?.path || ''),
                url: String(m?.url || m?.preview || ''),
                path: String(m?.path || ''),
              }
        )
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputId = 'b-add-mall-product-media';

  useEffect(() => {
    setName(String(initialItem?.title || ''));
    setDesc(String(initialItem?.description || ''));
    setPoints(Number(initialItem?.points || 1000));
    setStock(Number(initialItem?.stock || 99));
    setSortOrder(Number(initialItem?.sortOrder ?? initialItem?.order ?? 1));
    setStatus(String(initialItem?.rawStatus || 'active'));
    setMedia(
      Array.isArray(initialItem?.media)
        ? initialItem.media.map((m: any, idx: number) =>
            typeof m === 'string'
              ? { name: `media-${idx + 1}`, type: 'image/*', preview: m, url: m }
              : {
                  name: String(m?.name || `media-${idx + 1}`),
                  type: String(m?.type || 'image/*'),
                  preview: String(m?.preview || m?.url || m?.path || ''),
                  url: String(m?.url || m?.preview || ''),
                  path: String(m?.path || ''),
                }
          )
        : []
    );
  }, [initialItem]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (uploading) return;
    const convert = (file: File) =>
      new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', dataUrl: String(reader.result || '') });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    try {
      setUploading(true);
      const picked = await Promise.all(Array.from(files).slice(0, 3 - media.length).map(convert));
      const uploaded = await Promise.all(
        picked.map(async (item) => {
          const resp = await bApi.uploadMediaBase64({ name: item.name, type: item.type, dataUrl: item.dataUrl });
          return {
            name: resp.file.name || item.name,
            type: resp.file.type || item.type,
            preview: resp.file.url,
            url: resp.file.url,
            path: resp.file.path,
          };
        })
      );
      setMedia((prev) => [...prev, ...uploaded].slice(0, 3));
    } catch (e: any) {
      showApiError(e, ERROR_COPY.mediaUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (saving || uploading) return;
    if (!name.trim()) {
      alert(VALIDATION_COPY.bProductNameRequired);
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        desc,
        points,
        stock,
        sortOrder,
        status,
        media,
      };
      if (isEdit) {
        await bApi.updateMallProduct(Number(initialItem.id), payload);
      } else {
        await bApi.createMallProduct(payload);
      }
      onSaved();
      onBack();
    } catch (e: any) {
      showApiError(e, ERROR_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-50 absolute inset-0">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{isEdit ? '编辑商品' : '新增商品'}</h1>
        <button className="text-primary font-semibold">{ACTION_COPY.preview}</button>
      </header>

      <main className="flex-1 overflow-y-auto pb-56">
        <section className="p-4 bg-white border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">商品图片 <span className="text-sm font-medium text-slate-400">（最多3张）</span></h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {media.map((m, idx) => (
              <div key={`${m.name}-${idx}`} className="rounded-xl h-28 bg-cover bg-center relative overflow-hidden border border-slate-200">
                {String(m.type).startsWith('video/') ? (
                  <video src={m.preview} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.preview} className="w-full h-full object-cover" />
                )}
                <button onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {media.length < 3 && (
              <>
                <input id={fileInputId} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
                <label htmlFor={fileInputId} className="rounded-xl h-28 border-2 border-dashed border-slate-200 text-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-sm">{uploading ? '上传中...' : '添加图片'}</span>
                </label>
              </>
            )}
          </div>
        </section>

        <section className="p-4 space-y-4">
          <label className="block">
            <span className="text-base font-bold text-slate-900">商品名称</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 h-14 text-lg outline-none focus:ring-2 focus:ring-primary/30" placeholder="请输入商品名称，如：智能极简腕表" />
          </label>
          <label className="block">
            <span className="text-base font-bold text-slate-900">商品描述</span>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/30 min-h-36 resize-none" placeholder="请输入商品的详细规格、功能特点或售后说明..." />
          </label>
        </section>

        <section className="bg-white border-y border-slate-100 px-4">
          <div className="py-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-slate-900">所需积分</p>
              <p className="text-sm text-slate-500 mt-1">用户兑换此商品所需的积分值</p>
            </div>
            <div className="h-14 px-3 rounded-full bg-slate-100 flex items-center gap-4">
              <button onClick={() => setPoints((v) => Math.max(0, v - 1))} className="w-9 h-9 rounded-full bg-white text-primary flex items-center justify-center text-2xl leading-none">-</button>
              <span className="text-3xl font-bold text-slate-900">{points}</span>
              <button onClick={() => setPoints((v) => v + 1)} className="w-9 h-9 rounded-full bg-white text-primary flex items-center justify-center text-2xl leading-none">+</button>
            </div>
          </div>
          <div className="py-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-slate-900">商品库存</p>
              <p className="text-sm text-slate-500 mt-1">用户可兑换的最大数量</p>
            </div>
            <div className="h-14 px-3 rounded-full bg-slate-100 flex items-center gap-4">
              <button onClick={() => setStock((v) => Math.max(0, v - 1))} className="w-9 h-9 rounded-full bg-white text-primary flex items-center justify-center text-2xl leading-none">-</button>
              <span className="text-3xl font-bold text-slate-900">{stock}</span>
              <button onClick={() => setStock((v) => v + 1)} className="w-9 h-9 rounded-full bg-white text-primary flex items-center justify-center text-2xl leading-none">+</button>
            </div>
          </div>
          <div className="py-5">
            <SortOrderEditor value={sortOrder} onChange={setSortOrder} hint="数字越小，在商城展示越靠前" />
          </div>
          <div className="py-5 border-t border-slate-100">
            <p className="text-lg font-bold text-slate-900 mb-2">状态</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              {RUNNING_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </main>

      <div className="absolute bottom-[4.75rem] left-0 right-0 bg-white border-t border-slate-200 p-4 flex gap-3">
        <button onClick={onBack} className="flex-1 h-12 rounded-xl border border-slate-300 text-slate-700 font-bold">{ACTION_COPY.discardEdit}</button>
        <button onClick={submit} className="flex-[2] h-12 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25">{saving ? ACTION_COPY.saving : isEdit ? ACTION_COPY.saveChanges : ACTION_COPY.saveAndPublish}</button>
      </div>
    </div>
  );
}

function AddActivityConfigView({
  onBack,
  onSaved,
  initialItem,
}: {
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  initialItem?: any;
}) {
  const isEdit = Boolean(initialItem?.id);
  const buildInitialMedia = (value?: Array<any>) =>
    Array.isArray(value)
      ? value.map((m: any, idx: number) =>
          typeof m === 'string'
            ? { name: `media-${idx + 1}`, type: 'image/*', preview: m, url: m }
            : {
                name: String(m?.name || `media-${idx + 1}`),
                type: String(m?.type || 'image/*'),
                preview: String(m?.preview || m?.url || m?.path || ''),
                url: String(m?.url || m?.preview || ''),
                path: String(m?.path || ''),
              }
        )
      : [];
  const [title, setTitle] = useState(String(initialItem?.title || '2024年度健康跑'));
  const [desc, setDesc] = useState(String(initialItem?.description || '邀请客户参与线上5公里健康跑活动，完成后可领取专属礼包。'));
  const [rewardPoints, setRewardPoints] = useState(Number(initialItem?.rewardPoints || 100));
  const [sortOrder, setSortOrder] = useState(Number(initialItem?.sortOrder ?? initialItem?.order ?? 12));
  const [status, setStatus] = useState(String(initialItem?.rawStatus || 'active'));
  const [media, setMedia] = useState<Array<{ name: string; type: string; preview: string; url?: string; path?: string }>>(
    buildInitialMedia(initialItem?.media)
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitGuardRef = useRef(false);
  const createIdempotencyKeyRef = useRef(createBActivityConfigIdempotencyKey());
  const fileInputId = 'b-add-mall-activity-media';

  useEffect(() => {
    setTitle(String(initialItem?.title || '2024年度健康跑'));
    setDesc(String(initialItem?.description || '邀请客户参与线上5公里健康跑活动，完成后可领取专属礼包。'));
    setRewardPoints(Number(initialItem?.rewardPoints || 100));
    setSortOrder(Number(initialItem?.sortOrder ?? initialItem?.order ?? 12));
    setStatus(String(initialItem?.rawStatus || 'active'));
    setMedia(buildInitialMedia(initialItem?.media));
  }, [initialItem]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (uploading) return;
    const convert = (file: File) =>
      new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', dataUrl: String(reader.result || '') });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    try {
      setUploading(true);
      const picked = await Promise.all(Array.from(files).slice(0, 3 - media.length).map(convert));
      const uploaded = await Promise.all(
        picked.map(async (item) => {
          const resp = await bApi.uploadMediaBase64({ name: item.name, type: item.type, dataUrl: item.dataUrl });
          return {
            name: resp.file.name || item.name,
            type: resp.file.type || item.type,
            preview: resp.file.url,
            url: resp.file.url,
            path: resp.file.path,
          };
        })
      );
      setMedia((prev) => [...prev, ...uploaded].slice(0, 3));
    } catch (e: any) {
      showApiError(e, ERROR_COPY.mediaUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (submitGuardRef.current || saving || uploading) return;
    if (!title.trim()) {
      alert(VALIDATION_COPY.bActivityNameRequired);
      return;
    }
    try {
      submitGuardRef.current = true;
      setSaving(true);
      const payload = {
        title: title.trim(),
        desc,
        rewardPoints,
        sortOrder,
        status,
        media,
        idempotencyKey: isEdit ? undefined : createIdempotencyKeyRef.current,
      };
      if (isEdit) {
        await bApi.updateActivityConfig(Number(initialItem.id), payload);
      } else {
        await bApi.createActivityConfig(payload);
        createIdempotencyKeyRef.current = rotateBActivityConfigIdempotencyKey(createIdempotencyKeyRef.current);
      }
      await onSaved();
      onBack();
    } catch (e: any) {
      showApiError(e, ERROR_COPY.saveFailed);
    } finally {
      submitGuardRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-50 absolute inset-0">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{isEdit ? '编辑活动中心' : '新增活动中心'}</h1>
        <button className="text-slate-500">
          <Eye className="w-7 h-7" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-56 p-4 space-y-5">
        <label className="block">
          <span className="text-base font-bold text-slate-900">活动名称</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 h-12 text-base outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        <label className="block">
          <span className="text-base font-bold text-slate-900">活动描述</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/30 min-h-44 resize-none" />
        </label>

        <section>
          <h2 className="text-base font-bold text-slate-900">媒体素材</h2>
          <p className="text-sm text-slate-500 mt-1">支持图片或视频（最多3张）</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {media.map((m, idx) => (
              <div key={`${m.name}-${idx}`} className="rounded-xl h-28 bg-cover bg-center relative overflow-hidden border border-slate-200">
                {String(m.type).startsWith('video/') ? (
                  <video src={m.preview} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.preview} className="w-full h-full object-cover" />
                )}
                <button onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {media.length < 3 && (
              <>
                <input id={fileInputId} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
                <label htmlFor={fileInputId} className="rounded-xl h-28 border-2 border-dashed border-slate-200 text-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <Camera className="w-6 h-6" />
                  <span className="text-xs">{uploading ? '上传中...' : '添加媒体'}</span>
                </label>
              </>
            )}
          </div>
        </section>

        <section className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-slate-900">奖励积分</p>
              <p className="text-xs text-slate-500 mt-1">完成活动后自动发放</p>
            </div>
            <div className="h-14 px-3 rounded-xl bg-slate-100 flex items-center gap-4">
              <button onClick={() => setRewardPoints((v) => Math.max(0, v - 1))} className="text-3xl text-slate-500 leading-none">-</button>
              <span className="text-xl font-bold text-slate-900">{rewardPoints}</span>
              <button onClick={() => setRewardPoints((v) => v + 1)} className="text-3xl text-slate-500 leading-none">+</button>
            </div>
          </div>
          <SortOrderEditor value={sortOrder} onChange={setSortOrder} />
          <div className="mt-5">
            <p className="text-base font-bold text-slate-900 mb-2">状态</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              {RUNNING_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </main>

      <div className="absolute bottom-[4.75rem] left-0 right-0 bg-white border-t border-slate-200 p-4">
        <button disabled={saving || uploading} onClick={submit} className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed">{saving ? ACTION_COPY.saving : isEdit ? ACTION_COPY.saveChanges : ACTION_COPY.save}</button>
      </div>
    </div>
  );
}

function AddMallActivityView({
  onBack,
  onSaved,
  initialItem,
}: {
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  initialItem?: any;
}) {
  const isEdit = Boolean(initialItem?.id);
  const [title, setTitle] = useState(String(initialItem?.title || '2024年度健康跑'));
  const [desc, setDesc] = useState(String(initialItem?.description || '邀请客户参与线上5公里健康跑活动，完成后可领取专属礼包。'));
  const [rewardPoints, setRewardPoints] = useState(Number(initialItem?.rewardPoints || 100));
  const [sortOrder, setSortOrder] = useState(Number(initialItem?.sortOrder ?? initialItem?.order ?? 12));
  const [status, setStatus] = useState(String(initialItem?.rawStatus || 'active'));
  const [media, setMedia] = useState<Array<{ name: string; type: string; preview: string; url?: string; path?: string }>>(
    Array.isArray(initialItem?.media)
      ? initialItem.media.map((m: any, idx: number) =>
          typeof m === 'string'
            ? { name: `media-${idx + 1}`, type: 'image/*', preview: m, url: m }
            : {
                name: String(m?.name || `media-${idx + 1}`),
                type: String(m?.type || 'image/*'),
                preview: String(m?.preview || m?.url || m?.path || ''),
                url: String(m?.url || m?.preview || ''),
                path: String(m?.path || ''),
              }
        )
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputId = 'b-add-mall-activity-media';

  useEffect(() => {
    setTitle(String(initialItem?.title || '2024年度健康跑'));
    setDesc(String(initialItem?.description || '邀请客户参与线上5公里健康跑活动，完成后可领取专属礼包。'));
    setRewardPoints(Number(initialItem?.rewardPoints || 100));
    setSortOrder(Number(initialItem?.sortOrder ?? initialItem?.order ?? 12));
    setStatus(String(initialItem?.rawStatus || 'active'));
    setMedia(
      Array.isArray(initialItem?.media)
        ? initialItem.media.map((m: any, idx: number) =>
            typeof m === 'string'
              ? { name: `media-${idx + 1}`, type: 'image/*', preview: m, url: m }
              : {
                  name: String(m?.name || `media-${idx + 1}`),
                  type: String(m?.type || 'image/*'),
                  preview: String(m?.preview || m?.url || m?.path || ''),
                  url: String(m?.url || m?.preview || ''),
                  path: String(m?.path || ''),
                }
          )
        : []
    );
  }, [initialItem]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (uploading) return;
    const convert = (file: File) =>
      new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', dataUrl: String(reader.result || '') });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    try {
      setUploading(true);
      const picked = await Promise.all(Array.from(files).slice(0, 3 - media.length).map(convert));
      const uploaded = await Promise.all(
        picked.map(async (item) => {
          const resp = await bApi.uploadMediaBase64({ name: item.name, type: item.type, dataUrl: item.dataUrl });
          return {
            name: resp.file.name || item.name,
            type: resp.file.type || item.type,
            preview: resp.file.url,
            url: resp.file.url,
            path: resp.file.path,
          };
        })
      );
      setMedia((prev) => [...prev, ...uploaded].slice(0, 3));
    } catch (e: any) {
      showApiError(e, ERROR_COPY.mediaUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (saving || uploading) return;
    if (!title.trim()) {
      alert(VALIDATION_COPY.bActivityNameRequired);
      return;
    }
    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        desc,
        rewardPoints,
        sortOrder,
        status,
        media,
      };
      if (isEdit) {
        await bApi.updateMallActivity(Number(initialItem.id), payload);
      } else {
        await bApi.createMallActivity(payload);
      }
      await onSaved();
      onBack();
    } catch (e: any) {
      showApiError(e, ERROR_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-[70] absolute inset-0">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{isEdit ? '编辑活动货架' : '新增活动货架'}</h1>
        <button className="text-slate-500">
          <Eye className="w-7 h-7" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-56 p-4 space-y-5">
        <label className="block">
          <span className="text-base font-bold text-slate-900">活动名称</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 h-12 text-base outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        <label className="block">
          <span className="text-base font-bold text-slate-900">活动描述</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/30 min-h-44 resize-none" />
        </label>

        <section>
          <h2 className="text-base font-bold text-slate-900">媒体素材</h2>
          <p className="text-sm text-slate-500 mt-1">支持图片或视频（最多3张）</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {media.map((m, idx) => (
              <div key={`${m.name}-${idx}`} className="rounded-xl h-28 bg-cover bg-center relative overflow-hidden border border-slate-200">
                {String(m.type).startsWith('video/') ? (
                  <video src={m.preview} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.preview} className="w-full h-full object-cover" />
                )}
                <button onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {media.length < 3 && (
              <>
                <input id={fileInputId} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
                <label htmlFor={fileInputId} className="rounded-xl h-28 border-2 border-dashed border-slate-200 text-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <Camera className="w-6 h-6" />
                  <span className="text-xs">{uploading ? '上传中...' : '添加媒体'}</span>
                </label>
              </>
            )}
          </div>
        </section>

        <section className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-slate-900">奖励积分</p>
              <p className="text-xs text-slate-500 mt-1">完成活动后自动发放</p>
            </div>
            <div className="h-14 px-3 rounded-xl bg-slate-100 flex items-center gap-4">
              <button onClick={() => setRewardPoints((v) => Math.max(0, v - 1))} className="text-3xl text-slate-500 leading-none">-</button>
              <span className="text-xl font-bold text-slate-900">{rewardPoints}</span>
              <button onClick={() => setRewardPoints((v) => v + 1)} className="text-3xl text-slate-500 leading-none">+</button>
            </div>
          </div>
          <SortOrderEditor value={sortOrder} onChange={setSortOrder} />
          <div className="mt-5">
            <p className="text-base font-bold text-slate-900 mb-2">状态</p>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              {RUNNING_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </main>

      <div className="absolute bottom-[4.75rem] left-0 right-0 bg-white border-t border-slate-200 p-4">
        <button onClick={submit} className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/25">{saving ? ACTION_COPY.saving : isEdit ? ACTION_COPY.saveChanges : ACTION_COPY.save}</button>
      </div>
    </div>
  );
}

function ToolsView({
  access,
  onOpenShareEffect,
  onOpenToolMetricParticipants,
}: {
  access: BPermissionAccess;
  onOpenShareEffect: (effect: SelectedShareEffect) => void;
  onOpenToolMetricParticipants: (
    item: { id: number; title: string; shareType: BEffectShareType },
    metric?: BShareParticipantMetricKind,
  ) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState('activities');
  const [statusFilter, setStatusFilter] = useState<ContentRunningStatusFilter>('all');
  const [templateKeyword, setTemplateKeyword] = useState('');
  const [editorView, setEditorView] = useState<'none' | 'add-content' | 'add-product' | 'add-activity-config' | 'add-mall-activity' | 'product-detail'>('none');
  const [editingItem, setEditingItem] = useState<{ kind: BToolKind; item: any } | null>(null);
  const [contentItems, setContentItems] = useState<typeof CONTENT_ITEMS>([]);
  const [activityItems, setActivityItems] = useState<typeof ACTIVITY_ITEMS>([]);
  const [mallProducts, setMallProducts] = useState<typeof MALL_PRODUCTS>([]);
  const [mallActivities, setMallActivities] = useState<typeof MALL_ACTIVITIES>([]);
  const [toolError, setToolError] = useState('');
  const [detailModal, setDetailModal] = useState<{ kind: BToolKind; item: any } | null>(null);
  const [deletingContentItemId, setDeletingContentItemId] = useState<number | null>(null);
  const [movingContentItemId, setMovingContentItemId] = useState<number | null>(null);
  const [movingActivityItemId, setMovingActivityItemId] = useState<number | null>(null);
  const [movingMallProductId, setMovingMallProductId] = useState<number | null>(null);
  const [movingMallActivityId, setMovingMallActivityId] = useState<number | null>(null);
  const [sharingKey, setSharingKey] = useState('');
  const [shareSheet, setShareSheet] = useState<ShareSheetState | null>(null);
  const [mallCreateMenuOpen, setMallCreateMenuOpen] = useState(false);
  const [detailPageItem, setDetailPageItem] = useState<{ kind: BToolKind; item: any } | null>(null);
  const [shareOverview, setShareOverview] = useState<BShareOverviewResponse | null>(null);
  const [, setShareOverviewLoading] = useState(false);
  const [shareQrDataUrl, setShareQrDataUrl] = useState('');
  const [sharePosterGenerating, setSharePosterGenerating] = useState(false);

  const availableSubTabs = [
    access.learning ? { id: 'content', label: '知识学习' } : null,
    access.activity ? { id: 'activities', label: '活动中心' } : null,
    access.shop ? { id: 'mall', label: '积分商城' } : null,
  ].filter(Boolean) as Array<{ id: 'content' | 'activities' | 'mall'; label: string }>;

  const currentFilterOptions =
    activeSubTab === 'content'
      ? CONTENT_STATUS_FILTER_OPTIONS
      : RUNNING_STATUS_FILTER_OPTIONS;

  const matchesStatus = (rawStatus: string | undefined, kind: 'content' | 'running') => {
    if (statusFilter === 'all') return true;
    if (kind === 'content') return normalizeContentStatus(rawStatus) === statusFilter;
    return normalizeRunningStatus(rawStatus) === statusFilter;
  };


  const matchesTemplateKeyword = (item: { title?: string; description?: string; templateSource?: string; templateTag?: string }) => {
    const keyword = String(templateKeyword || '').trim().toLowerCase();
    if (!keyword) return true;
    const source = normalizeTemplateSource(item.templateSource);
    const sourceKeywords =
      source === 'platform'
        ? ['平台', '平台模板', 'platform']
        : source === 'company'
          ? ['公司', '公司模板', 'company']
          : ['个人', '个人模板', 'personal'];
    const haystack = [
      item.title,
      item.description,
      item.templateTag,
      templateSourceLabel(source),
      ...sourceKeywords,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  };

  const normalizeToolOrder = (value: unknown) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : 0;
  };

  const formatToolOrder = (value: unknown) => {
    const next = normalizeToolOrder(value);
    return next > 0 ? String(next) : '未排';
  };

  function sortToolItemsByOrder<T extends { id?: number | string; order?: number; sortOrder?: number }>(list: T[]) {
    return [...list].sort((left, right) => {
      const leftOrder = normalizeToolOrder(left.sortOrder ?? left.order);
      const rightOrder = normalizeToolOrder(right.sortOrder ?? right.order);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return Number(left.id || 0) - Number(right.id || 0);
    });
  }

  function moveOrderedToolItems<T extends { id?: number | string }>(ordered: T[], id: number, direction: 'up' | 'down') {
    const index = ordered.findIndex((item) => Number(item.id || 0) === Number(id));
    if (index < 0) return null;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) return null;
    const next = [...ordered];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    return next;
  }

  const shareCountText = (value: unknown) => {
    const num = Number(String(value ?? '0').replace(/[^\d]/g, ''));
    if (!Number.isFinite(num) || num <= 0) return '0';
    return String(num);
  };

  const bumpShareCount = (value: unknown) => String((Number(shareCountText(value)) || 0) + 1);

  const increaseShareCount = (kind: BToolKind, id: number) => {
    if (kind === 'content') {
      setContentItems((prev) => prev.map((item) => (Number(item.id) === Number(id) ? { ...item, shares: bumpShareCount(item.shares) } : item)));
    } else if (kind === 'activity') {
      setActivityItems((prev) => prev.map((item) => (Number(item.id) === Number(id) ? { ...item, shares: bumpShareCount(item.shares) } : item)));
    } else if (kind === 'product') {
      setMallProducts((prev) => prev.map((item) => (Number(item.id) === Number(id) ? { ...item, shares: bumpShareCount(item.shares) } : item)));
    } else {
      setMallActivities((prev) => prev.map((item) => (Number(item.id) === Number(id) ? { ...item, shares: bumpShareCount(item.shares) } : item)));
    }
    setDetailModal((prev) => {
      if (!prev || prev.kind !== kind || Number(prev.item?.id) !== Number(id)) return prev;
      return { ...prev, item: { ...prev.item, shares: bumpShareCount(prev.item?.shares) } };
    });
  };

  const mergeCreatedShareIntoOverview = (payload: {
    shareCode: string;
    shareType: BShareType;
    targetId: number | null;
    targetTitle: string;
    sharePath: string;
    channel: string;
    shareUrl: string;
    targetCPath: string;
    fallbackCPath: string;
    loginRequired: boolean;
    expiresAt: string;
    previewPayload?: BShareRecord['previewPayload'];
  }) => {
    const optimisticRecord: BShareRecord = {
      shareCode: payload.shareCode,
      shareType: payload.shareType,
      sharePath: payload.sharePath,
      channel: payload.channel,
      targetId: payload.targetId,
      targetTitle: payload.targetTitle,
      shareUrl: payload.shareUrl,
      targetCPath: payload.targetCPath,
      fallbackCPath: payload.fallbackCPath,
      loginRequired: payload.loginRequired,
      expiresAt: payload.expiresAt,
      createdAt: new Date().toISOString(),
      previewPayload: payload.previewPayload || {},
      metrics: {
        views: 0,
        clicks: 0,
        deliveries: 0,
        clickThroughRate: 0,
      },
    };

    setShareOverview((prev) => {
      if (!prev) {
        return {
          ok: true,
          summary: {
            totalLinks: 1,
            totalViews: 0,
            totalClicks: 0,
            totalDeliveries: 0,
            clickThroughRate: 0,
          },
          byType: [
            {
              shareType: payload.shareType,
              totalLinks: 1,
              totalViews: 0,
              totalClicks: 0,
              totalDeliveries: 0,
              clickThroughRate: 0,
            },
          ],
          targetStats: [
            {
              shareType: payload.shareType,
              targetId: payload.targetId,
              targetTitle: payload.targetTitle,
              totalLinks: 1,
              totalViews: 0,
              totalClicks: 0,
              totalParticipants: 0,
              totalAttendees: 0,
              clickThroughRate: 0,
            },
          ],
          list: [optimisticRecord],
        };
      }

      const withoutSame = (prev.list || []).filter((row) => String(row.shareCode || '') !== payload.shareCode);
      const byType = [...(prev.byType || [])];
      const typeIndex = byType.findIndex((row) => row.shareType === payload.shareType);
      if (typeIndex >= 0) {
        byType[typeIndex] = {
          ...byType[typeIndex],
          totalLinks: Number(byType[typeIndex].totalLinks || 0) + 1,
        };
      } else {
        byType.unshift({
          shareType: payload.shareType,
          totalLinks: 1,
          totalViews: 0,
          totalClicks: 0,
          totalDeliveries: 0,
          clickThroughRate: 0,
        });
      }

      const targetStats = [...(prev.targetStats || [])];
      const targetIndex = targetStats.findIndex(
        (row) => row.shareType === payload.shareType && Number(row.targetId || 0) === Number(payload.targetId || 0),
      );
      if (targetIndex >= 0) {
        targetStats[targetIndex] = {
          ...targetStats[targetIndex],
          totalLinks: Number(targetStats[targetIndex].totalLinks || 0) + 1,
        };
      } else {
        targetStats.unshift({
          shareType: payload.shareType,
          targetId: payload.targetId,
          targetTitle: payload.targetTitle,
          totalLinks: 1,
          totalViews: 0,
          totalClicks: 0,
          totalParticipants: 0,
          totalAttendees: 0,
          clickThroughRate: 0,
        });
      }

      return {
        ...prev,
        summary: {
          ...prev.summary,
          totalLinks: Number(prev.summary?.totalLinks || 0) + 1,
        },
        byType,
        targetStats,
        list: [optimisticRecord, ...withoutSame].slice(0, 20),
      };
    });
  };

  const toShareSheetState = (payload: {
    kind: BToolKind;
    itemId: number;
    shareCode: string;
    title: string;
    shareLabel: string;
    shareType: BShareType;
    sharePath: BSharePath;
    shareUrl: string;
    targetCPath: string;
    expiresAt: string;
    previewPayload?: ShareSheetState['previewPayload'];
  }): ShareSheetState => ({
    kind: payload.kind,
    itemId: payload.itemId,
    shareCode: payload.shareCode,
    title: payload.title,
    shareLabel: payload.shareLabel,
    shareType: payload.shareType,
    sharePath: payload.sharePath,
    shareUrl: normalizeShareUrl(payload.shareUrl),
    targetCPath: payload.targetCPath,
    expiresAt: payload.expiresAt,
    previewPayload: payload.previewPayload,
  });

  const applyShareTargetStats = (overview: BShareOverviewResponse | null) => {
    const shareStatMap = new Map(
      (overview?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalLinks || 0)]),
    );
    const viewStatMap = new Map(
      (overview?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalViews || 0)]),
    );
    const participantStatMap = new Map(
      (overview?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalParticipants || 0)]),
    );
    const attendeeStatMap = new Map(
      (overview?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalAttendees || 0)]),
    );
    const shareCountFor = (shareType: BShareType, targetId: number) =>
      String(shareStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);
    const viewCountFor = (shareType: BShareType, targetId: number) =>
      String(viewStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);
    const participantCountFor = (shareType: BShareType, targetId: number) =>
      String(participantStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);
    const attendeeCountFor = (shareType: BShareType, targetId: number) =>
      String(attendeeStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);

    setContentItems((prev) =>
      prev.map((item) => ({
        ...item,
        views: viewCountFor('learning_course', Number(item.id || 0)),
        participants: participantCountFor('learning_course', Number(item.id || 0)),
        shares: shareCountFor('learning_course', Number(item.id || 0)),
      })),
    );
    setActivityItems((prev) =>
      prev.map((item) => ({
        ...item,
        participants: participantCountFor('activity', Number(item.id || 0)),
        attendees: attendeeCountFor('activity', Number(item.id || 0)),
        shares: shareCountFor('activity', Number(item.id || 0)),
      })),
    );
    setMallProducts((prev) =>
      prev.map((item) => ({
        ...item,
        views: viewCountFor('mall_item', Number(item.id || 0)),
        participants: participantCountFor('mall_item', Number(item.id || 0)),
        shares: shareCountFor('mall_item', Number(item.id || 0)),
      })),
    );
    setMallActivities((prev) =>
      prev.map((item) => ({
        ...item,
        views: viewCountFor('mall_activity', Number(item.id || 0)),
        participants: participantCountFor('mall_activity', Number(item.id || 0)),
        shares: shareCountFor('mall_activity', Number(item.id || 0)),
      })),
    );
    setDetailModal((prev) => {
      if (!prev) return prev;
      const shareType = shareTypeByKind(prev.kind);
      if (!shareType) return prev;
      return {
        ...prev,
        item: {
          ...prev.item,
          views:
            shareType === 'learning_course' || shareType === 'mall_item' || shareType === 'mall_activity'
              ? viewCountFor(shareType, Number(prev.item?.id || 0))
              : prev.item?.views,
          participants:
            shareType === 'learning_course' || shareType === 'activity' || shareType === 'mall_item' || shareType === 'mall_activity'
              ? participantCountFor(shareType, Number(prev.item?.id || 0))
              : prev.item?.participants,
          attendees:
            shareType === 'activity'
              ? attendeeCountFor(shareType, Number(prev.item?.id || 0))
              : prev.item?.attendees,
          shares: shareCountFor(shareType, Number(prev.item?.id || 0)),
        },
      };
    });
  };

  const buildShareCopyText = (sheet: ShareSheetState) =>
    [
      `【${sheet.shareLabel}】${sheet.previewPayload?.title || sheet.title}`,
      sheet.previewPayload?.subtitle || '打开后可先看 H5，再跳转到 C 端对应页面。',
      `访问链接：${sheet.shareUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

  const handleDeleteContentItem = async (item: { id: number; title?: string }) => {
    const itemId = Number(item?.id || 0);
    if (itemId <= 0 || Number(deletingContentItemId || 0) === itemId) return;
    const confirmed = window.confirm(`确认删除学习资料“${String(item?.title || '未命名资料')}”吗？删除后不可恢复。`);
    if (!confirmed) return;
    try {
      setDeletingContentItemId(itemId);
      await bApi.deleteContentItem(itemId);
      setContentItems((prev) => prev.filter((row) => Number(row.id || 0) !== itemId));
      setDetailModal((prev) => {
        if (!prev || prev.kind !== 'content' || Number(prev.item?.id || 0) !== itemId) return prev;
        return null;
      });
      setToolError('');
    } catch (err: any) {
      showApiError(err, '学习资料删除失败，请稍后重试');
      void loadToolData();
    } finally {
      setDeletingContentItemId(null);
    }
  };

  const handleMoveContentItem = async (id: number, direction: 'up' | 'down') => {
    if (Number(movingContentItemId || 0) > 0) return;
    const next = moveOrderedToolItems(filteredContentItems, id, direction);
    if (!next) return;
    try {
      setMovingContentItemId(id);
      await bApi.reorderContentItems(next.map((row) => Number(row.id || 0)).filter(Boolean));
      await loadToolData();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.saveFailed);
    } finally {
      setMovingContentItemId(null);
    }
  };

  const handleMoveActivityItem = async (id: number, direction: 'up' | 'down') => {
    if (Number(movingActivityItemId || 0) > 0) return;
    const next = moveOrderedToolItems(filteredActivityItems, id, direction);
    if (!next) return;
    try {
      setMovingActivityItemId(id);
      await bApi.reorderActivityConfigs(next.map((row) => Number(row.id || 0)).filter(Boolean));
      await loadToolData();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.saveFailed);
    } finally {
      setMovingActivityItemId(null);
    }
  };

  const handleMoveMallProduct = async (id: number, direction: 'up' | 'down') => {
    if (Number(movingMallProductId || 0) > 0) return;
    const next = moveOrderedToolItems(filteredMallProducts, id, direction);
    if (!next) return;
    try {
      setMovingMallProductId(id);
      await bApi.reorderMallProducts(next.map((row) => Number(row.id || 0)).filter(Boolean));
      await loadToolData();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.saveFailed);
    } finally {
      setMovingMallProductId(null);
    }
  };

  const handleMoveMallActivity = async (id: number, direction: 'up' | 'down') => {
    if (Number(movingMallActivityId || 0) > 0) return;
    const next = moveOrderedToolItems(filteredMallActivities, id, direction);
    if (!next) return;
    try {
      setMovingMallActivityId(id);
      await bApi.reorderMallActivities(next.map((row) => Number(row.id || 0)).filter(Boolean));
      await loadToolData();
    } catch (err: any) {
      showApiError(err, ERROR_COPY.saveFailed);
    } finally {
      setMovingMallActivityId(null);
    }
  };

  const recordShareSuccess = (payload: {
    kind: BToolKind;
    itemId: number;
    title: string;
    shareLabel: string;
    shareType: BShareType;
    sharePath: BSharePath;
    shareMethod: ShareSuccessMethod;
    shareCode?: string;
  }) => {
    trackEvent({
      event: B_SHARE_TRACK_EVENTS.success,
      properties: {
        sharePath: payload.sharePath,
        kind: payload.kind,
        shareType: payload.shareType,
        itemId: payload.itemId,
        title: payload.title,
        shareLabel: payload.shareLabel,
        shareMethod: payload.shareMethod,
        shareCode: payload.shareCode || '',
      },
    }).catch(() => undefined);
    void loadShareOverview();
  };

  const handleCopyShareUrl = async (sheet: NonNullable<typeof shareSheet>) => {
    try {
      if (await copyTextWithFallback(sheet.shareUrl)) {
        recordShareSuccess({
          kind: sheet.kind,
          itemId: sheet.itemId,
          title: sheet.title,
          shareLabel: sheet.shareLabel,
          shareType: sheet.shareType,
          sharePath: sheet.sharePath,
          shareMethod: 'clipboard',
          shareCode: sheet.shareCode,
        });
        alert(NOTICE_COPY.shareLinkCopied);
        return;
      }
      window.prompt('复制这条链接发给客户', sheet.shareUrl);
      recordShareSuccess({
        kind: sheet.kind,
        itemId: sheet.itemId,
        title: sheet.title,
        shareLabel: sheet.shareLabel,
        shareType: sheet.shareType,
        sharePath: sheet.sharePath,
        shareMethod: 'manual',
        shareCode: sheet.shareCode,
      });
    } catch (err: any) {
      trackEvent({
        event: B_SHARE_TRACK_EVENTS.failed,
        properties: {
          sharePath: sheet.sharePath,
          kind: sheet.kind,
          shareType: sheet.shareType,
          itemId: sheet.itemId,
          title: sheet.title,
          message: String(err?.message || 'copy_share_failed'),
        },
      }).catch(() => undefined);
      alert(NOTICE_COPY.shareFailedRetry);
    }
  };

  const handleSystemShare = async (sheet: NonNullable<typeof shareSheet>) => {
    try {
      if (!navigator.share) {
        await handleCopyShareUrl(sheet);
        return;
      }
      await navigator.share({
        title: `【${sheet.shareLabel}】${sheet.title}`,
        text: `推荐给你：${sheet.title}`,
        url: sheet.shareUrl,
      });
      recordShareSuccess({
        kind: sheet.kind,
        itemId: sheet.itemId,
        title: sheet.title,
        shareLabel: sheet.shareLabel,
        shareType: sheet.shareType,
        sharePath: sheet.sharePath,
        shareMethod: 'system',
        shareCode: sheet.shareCode,
      });
    } catch (err: any) {
      if (String(err?.name || '') === 'AbortError') {
        trackEvent({
          event: B_SHARE_TRACK_EVENTS.cancel,
          properties: {
            sharePath: sheet.sharePath,
            kind: sheet.kind,
            shareType: sheet.shareType,
            itemId: sheet.itemId,
            title: sheet.title,
          },
        }).catch(() => undefined);
        return;
      }
      trackEvent({
        event: B_SHARE_TRACK_EVENTS.failed,
        properties: {
          sharePath: sheet.sharePath,
          kind: sheet.kind,
          shareType: sheet.shareType,
          itemId: sheet.itemId,
          title: sheet.title,
          message: String(err?.message || 'system_share_failed'),
        },
      }).catch(() => undefined);
      alert(NOTICE_COPY.shareFailedRetry);
    }
  };

  const handleOpenSharePreview = (sheet: NonNullable<typeof shareSheet>) => {
    if (typeof window === 'undefined') return;
    if (isCompactViewport()) {
      window.location.assign(sheet.shareUrl);
      return;
    }
    window.open(sheet.shareUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    let cancelled = false;
    if (!shareSheet?.shareUrl) {
      setShareQrDataUrl('');
      return;
    }
    QRCode.toDataURL(shareSheet.shareUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setShareQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setShareQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [shareSheet]);

  const handleDownloadShareQr = (sheet: NonNullable<typeof shareSheet>) => {
    if (!shareQrDataUrl || typeof document === 'undefined') return;
    const link = document.createElement('a');
    const safeTitle = String(sheet.title || 'share').replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
    link.href = shareQrDataUrl;
    link.download = `${safeTitle || 'share'}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadShareOverview = async (disposedRef?: { disposed: boolean }) => {
    const isDisposed = () => Boolean(disposedRef?.disposed);
    if (!isDisposed()) setShareOverviewLoading(true);
    try {
      const overview = await bApi.shareOverview(20);
      if (isDisposed()) return;
      const normalizedOverview = {
        ...overview,
        list: Array.isArray(overview?.list)
          ? overview.list.map((row) => ({ ...row, shareUrl: normalizeShareUrl(String(row?.shareUrl || '')) }))
          : [],
      };
      setShareOverview(normalizedOverview);
      applyShareTargetStats(normalizedOverview);
    } catch {
      if (isDisposed()) return;
    } finally {
      if (!isDisposed()) setShareOverviewLoading(false);
    }
  };

  const handleCopyShareText = async (sheet: NonNullable<typeof shareSheet>) => {
    const shareText = buildShareCopyText(sheet);
    try {
      if (await copyTextWithFallback(shareText)) {
        recordShareSuccess({
          kind: sheet.kind,
          itemId: sheet.itemId,
          title: sheet.title,
          shareLabel: sheet.shareLabel,
          shareType: sheet.shareType,
          sharePath: sheet.sharePath,
          shareMethod: 'clipboard',
          shareCode: sheet.shareCode,
        });
        alert(NOTICE_COPY.shareLinkCopied);
        return;
      }
      window.prompt('复制这段分享文案', shareText);
      recordShareSuccess({
        kind: sheet.kind,
        itemId: sheet.itemId,
        title: sheet.title,
        shareLabel: sheet.shareLabel,
        shareType: sheet.shareType,
        sharePath: sheet.sharePath,
        shareMethod: 'manual',
        shareCode: sheet.shareCode,
      });
    } catch (err: any) {
      trackEvent({
        event: B_SHARE_TRACK_EVENTS.failed,
        properties: {
          sharePath: sheet.sharePath,
          kind: sheet.kind,
          shareType: sheet.shareType,
          itemId: sheet.itemId,
          title: sheet.title,
          shareCode: sheet.shareCode,
          message: String(err?.message || 'copy_share_text_failed'),
        },
      }).catch(() => undefined);
      alert(NOTICE_COPY.shareFailedRetry);
    }
  };

  const handleDownloadSharePoster = async (sheet: NonNullable<typeof shareSheet>) => {
    if (typeof document === 'undefined') return;
    setSharePosterGenerating(true);
    try {
      const safeTitle = String(sheet.title || 'share').replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
      const qrDataUrl =
        shareQrDataUrl ||
        (await QRCode.toDataURL(sheet.shareUrl, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 320,
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
        }));

      const posterDataUrl = await new Promise<string>((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('CANVAS_CONTEXT_REQUIRED'));
          return;
        }

        const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 4) => {
          const content = String(text || '').trim();
          if (!content) return y;
          let line = '';
          let lineCount = 0;
          for (const char of content) {
            const testLine = `${line}${char}`;
            if (ctx.measureText(testLine).width > maxWidth && line) {
              ctx.fillText(line, x, y);
              y += lineHeight;
              line = char;
              lineCount += 1;
              if (lineCount >= maxLines - 1) break;
            } else {
              line = testLine;
            }
          }
          if (line) ctx.fillText(line, x, y);
          return y + lineHeight;
        };

        const qrImage = new Image();
        qrImage.onload = () => {
          const gradient = ctx.createLinearGradient(0, 0, 1080, 1600);
          gradient.addColorStop(0, '#0f172a');
          gradient.addColorStop(0.45, '#1d4ed8');
          gradient.addColorStop(1, '#38bdf8');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(72, 72, 936, 300);

          ctx.fillStyle = '#ffffff';
          ctx.font = '700 42px sans-serif';
          ctx.fillText(sheet.shareLabel, 108, 160);

          ctx.font = '900 72px sans-serif';
          let cursorY = drawWrappedText(sheet.previewPayload?.title || sheet.title, 108, 270, 864, 88, 3);

          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.font = '400 34px sans-serif';
          cursorY = drawWrappedText(
            sheet.previewPayload?.subtitle || '打开 H5 后可跳转到 C 端对应页面',
            108,
            cursorY + 18,
            864,
            50,
            4,
          );

          ctx.fillStyle = '#ffffff';
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(72, 520, 936, 960, 40);
            ctx.fill();
          } else {
            ctx.fillRect(72, 520, 936, 960);
          }

          ctx.fillStyle = '#0f172a';
          ctx.font = '700 42px sans-serif';
          ctx.fillText('分享给客户', 132, 620);
          ctx.font = '400 30px sans-serif';
          ctx.fillStyle = '#475569';
          drawWrappedText(buildShareCopyText(sheet), 132, 700, 520, 46, 6);

          ctx.fillStyle = '#eff6ff';
          ctx.fillRect(704, 640, 240, 240);
          ctx.drawImage(qrImage, 704, 640, 240, 240);

          ctx.fillStyle = '#0f172a';
          ctx.font = '700 32px sans-serif';
          ctx.fillText('扫码打开 H5', 714, 930);
          ctx.font = '400 26px sans-serif';
          ctx.fillStyle = '#64748b';
          drawWrappedText(sheet.targetCPath || '/', 132, 1040, 812, 40, 4);

          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(132, 1200, 816, 120);
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 40px sans-serif';
          ctx.fillText(sheet.previewPayload?.ctaText || '立即查看', 460, 1274);

          resolve(canvas.toDataURL('image/png'));
        };
        qrImage.onerror = () => reject(new Error('POSTER_QR_LOAD_FAILED'));
        qrImage.src = qrDataUrl;
      });

      const link = document.createElement('a');
      link.href = posterDataUrl;
      link.download = `${safeTitle || 'share'}-poster.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      recordShareSuccess({
        kind: sheet.kind,
        itemId: sheet.itemId,
        title: sheet.title,
        shareLabel: sheet.shareLabel,
        shareType: sheet.shareType,
        sharePath: sheet.sharePath,
        shareMethod: 'poster',
        shareCode: sheet.shareCode,
      });
    } catch (err: any) {
      trackEvent({
        event: B_SHARE_TRACK_EVENTS.failed,
        properties: {
          sharePath: sheet.sharePath,
          kind: sheet.kind,
          shareType: sheet.shareType,
          itemId: sheet.itemId,
          title: sheet.title,
          shareCode: sheet.shareCode,
          message: String(err?.message || 'download_share_poster_failed'),
        },
      }).catch(() => undefined);
      alert(NOTICE_COPY.shareFailedRetry);
    } finally {
      setSharePosterGenerating(false);
    }
  };

  const handleShareToolItem = async (kind: BToolKind, item: any, sharePath: BSharePath) => {
    const key = `${kind}:${Number(item?.id || 0)}`;
    setSharingKey(key);
    const title = String(item?.title || '内容');
    const shareLabel = bToolKindShareLabel(kind);
    const shareType = shareTypeByKind(kind);
    if (!shareType) {
      alert(NOTICE_COPY.shareFailedRetry);
      setSharingKey('');
      return;
    }
    trackEvent({
      event: B_SHARE_TRACK_EVENTS.attempt,
      properties: {
        sharePath,
        kind,
        itemId: Number(item?.id || 0),
        title,
      },
    }).catch(() => undefined);

    try {
      const shareResponse = await bApi.createShare({
        shareType,
        targetId: Number(item?.id || 0) || undefined,
        channel: 'b-web',
        sharePath,
      });
      const shareUrl = normalizeShareUrl(String(shareResponse.shareUrl || '').trim());
      if (!shareUrl) throw new Error('SHARE_URL_REQUIRED');
      setShareSheet(toShareSheetState({
        kind,
        itemId: Number(item?.id || 0),
        shareCode: String(shareResponse.shareCode || ''),
        title,
        shareLabel,
        shareType,
        sharePath,
        shareUrl,
        targetCPath: String(shareResponse.targetCPath || ''),
        expiresAt: String(shareResponse.expiresAt || ''),
        previewPayload: shareResponse.previewPayload,
      }));
      increaseShareCount(kind, Number(item?.id || 0));
      mergeCreatedShareIntoOverview({
        shareCode: String(shareResponse.shareCode || ''),
        shareType,
        targetId: Number(item?.id || 0) || null,
        targetTitle: String(shareResponse.targetTitle || title),
        sharePath,
        channel: 'b-web',
        shareUrl,
        targetCPath: String(shareResponse.targetCPath || ''),
        fallbackCPath: String(shareResponse.fallbackCPath || ''),
        loginRequired: Boolean(shareResponse.loginRequired),
        expiresAt: String(shareResponse.expiresAt || ''),
        previewPayload: shareResponse.previewPayload,
      });
      void loadShareOverview();
    } catch (err: any) {
      trackEvent({
        event: B_SHARE_TRACK_EVENTS.failed,
        properties: {
          sharePath,
          kind,
          shareType,
          itemId: Number(item?.id || 0),
          title,
          message: String(err?.message || 'unknown_error'),
        },
      }).catch(() => undefined);
      alert(NOTICE_COPY.shareFailedRetry);
    } finally {
      setSharingKey('');
    }
  };

  const detailPreviewActionLabel = (kind: BToolKind, item: any) => {
    if (kind === 'content') {
      const type = String(item?.type || '').toLowerCase();
      if (type === 'video') return '开始学习';
      if (type === 'comic') return '开始阅读';
      return '查看内容';
    }
    if (kind === 'activity') return '立即参与';
    if (kind === 'product') return '立即兑换';
    return '查看活动';
  };

  const renderDetailTemplatePreview = (kind: BToolKind, item: any) => {
    const title = String(item?.title || '未命名模板');
    const description = String(item?.description || '暂无模板说明');
    const image = String(item?.image || '').trim();
    const videoUrl = String(item?.videoUrl || '').trim();
    const rewardPoints = Number(item?.rewardPoints || 0);
    const productPoints = Number(item?.points || 0);
    const stock = Number(item?.stock || 0);
    const rawStatus = String(item?.rawStatus || item?.status || '');
    const statusLabel =
      kind === 'content'
        ? toContentStatusLabel(rawStatus || 'published')
        : toRunningStatusLabel(rawStatus || 'active');

    if (kind === 'content') {
      return (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Template Preview</p>
              <h4 className="mt-1 text-lg font-bold">{title}</h4>
            </div>
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/90">
              {String(item?.type || 'article').toUpperCase()}
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {videoUrl ? (
              <video controls className="h-52 w-full object-cover" src={videoUrl} />
            ) : image ? (
              <img src={image} alt={title} className="h-52 w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-52 w-full items-center justify-center bg-white/5">
                <GraduationCap className="h-12 w-12 text-white/40" />
              </div>
            )}
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <PlayCircle className="h-4 w-4" />
                <span>{String(item?.duration || '3 分钟')}</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                  奖励 {rewardPoints} 积分
                </span>
              </div>
              <p className="text-sm leading-6 text-white/88">{description}</p>
              <button className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900">
                {detailPreviewActionLabel(kind, item)}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (kind === 'activity') {
      return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="relative h-52 w-full bg-slate-200">
            {image ? (
              <img src={image} alt={title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50">
                <PartyPopper className="h-12 w-12 text-orange-400" />
              </div>
            )}
            <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
              {statusLabel}
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Template Preview</p>
                <h4 className="mt-1 text-lg font-bold text-slate-900">{title}</h4>
              </div>
              <div className="rounded-2xl bg-primary/8 px-3 py-2 text-right">
                <p className="text-[11px] text-slate-500">奖励</p>
                <p className="text-base font-bold text-primary">{rewardPoints} 积分</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
            <button className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
              {detailPreviewActionLabel(kind, item)}
            </button>
          </div>
        </div>
      );
    }

    if (kind === 'product') {
      return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex gap-4 p-4">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
              {image ? (
                <img src={image} alt={title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Gift className="h-10 w-10 text-slate-300" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Template Preview</p>
              <h4 className="text-lg font-bold text-slate-900">{title}</h4>
              <p className="text-sm leading-6 text-slate-600 line-clamp-3">{description}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">{productPoints} 积分</span>
                <span className="text-slate-500">库存 {stock}</span>
              </div>
              <button className="inline-flex h-10 items-center rounded-xl border border-primary/20 bg-primary/5 px-4 text-sm font-semibold text-primary">
                {detailPreviewActionLabel(kind, item)}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="relative h-44 w-full bg-slate-200">
          {image ? (
            <img src={image} alt={title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50">
              <LayoutDashboard className="h-10 w-10 text-slate-300" />
            </div>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Template Preview</p>
              <h4 className="mt-1 text-lg font-bold text-slate-900">{title}</h4>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{statusLabel}</span>
          </div>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              奖励 {rewardPoints} 积分
            </span>
            <button className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
              {detailPreviewActionLabel(kind, item)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const openMallProductDetail = (product: any) => {
    setDetailModal(null);
    setDetailPageItem({ kind: 'product', item: product });
    setEditorView('product-detail');
  };

  const loadToolData = async (disposedRef?: { disposed: boolean }) => {
    const isDisposed = () => Boolean(disposedRef?.disposed);
    const mediaUrl = (m?: any) => {
      if (!m) return '';
      if (typeof m === 'string') return m;
      return String(m.preview || m.url || m.path || m.name || '');
    };
    const pickPreview = (media?: Array<any>) => {
      const list = Array.isArray(media) ? media : [];
      const imageHit = list.find((m) => {
        const type = String(m?.type || '').toLowerCase();
        const name = String(m?.name || m?.preview || m?.url || '').toLowerCase();
        return type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name);
      });
      return mediaUrl(imageHit || list[0]);
    };
    const pickVideo = (media?: Array<any>) => {
      const list = Array.isArray(media) ? media : [];
      const videoHit = list.find((m) => {
        const type = String(m?.type || '').toLowerCase();
        const name = String(m?.name || m?.preview || m?.url || '').toLowerCase();
        return type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(name);
      });
      return mediaUrl(videoHit);
    };
    try {
      const [contentRes, activityRes, productRes, mallActRes, shareOverviewRes] = await Promise.all([
        bApi.contentItems(),
        bApi.activityConfigs(),
        bApi.mallProducts(),
        bApi.mallActivities(),
        bApi.shareOverview(20).catch(() => null),
      ]);
      if (isDisposed()) return;
      if (shareOverviewRes) {
        setShareOverview(shareOverviewRes);
      }
      const shareStatMap = new Map(
        (shareOverviewRes?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalLinks || 0)]),
      );
      const viewStatMap = new Map(
        (shareOverviewRes?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalViews || 0)]),
      );
      const participantStatMap = new Map(
        (shareOverviewRes?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalParticipants || 0)]),
      );
      const attendeeStatMap = new Map(
        (shareOverviewRes?.targetStats || []).map((row) => [`${row.shareType}:${Number(row.targetId || 0)}`, Number(row.totalAttendees || 0)]),
      );
      const shareCountFor = (shareType: BShareType, targetId: number) => String(shareStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);
      const viewCountFor = (shareType: BShareType, targetId: number) => String(viewStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);
      const participantCountFor = (shareType: BShareType, targetId: number) =>
        String(participantStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);
      const attendeeCountFor = (shareType: BShareType, targetId: number) =>
        String(attendeeStatMap.get(`${shareType}:${Number(targetId || 0)}`) || 0);
      const mappedContent = (contentRes.list || []).map((item: BContentItem, idx: number) => ({
          id: Number(item.id || idx + 1),
          title: item.title || `内容${idx + 1}`,
          image: pickPreview(item.media) || '',
          status: toContentStatusLabel(String(item.status || 'published')),
          rawStatus: String(item.status || 'published'),
          type: String(item.contentType || 'article'),
          description: String((item as any).content || ''),
          media: Array.isArray(item.media) ? item.media : [],
          videoUrl: pickVideo(item.media),
          duration: '03:00',
          views: viewCountFor('learning_course', Number(item.id || 0)),
          participants: participantCountFor('learning_course', Number(item.id || 0)),
          shares: shareCountFor('learning_course', Number(item.id || 0)),
          sortOrder: Number(item.sortOrder || 0),
          order: Number(item.sortOrder || 0),
          updatedAt: item.updatedAt || '',
          templateSource: normalizeTemplateSource(item.templateSource),
          templateTag: String(item.templateTag || templateSourceLabel(item.templateSource)),
      }));
      const mappedActivities = (activityRes.list || []).map((item: BActivityConfig, idx: number) => ({
          id: Number(item.id || idx + 1),
          title: item.title || `活动${idx + 1}`,
          image: pickPreview(item.media) || '',
          status: toRunningStatusLabel(String(item.status || 'online')),
          rawStatus: String(item.status || 'online'),
          description: String((item as any).content || ''),
          rewardPoints: Number(item.rewardPoints || 0),
          media: Array.isArray(item.media) ? item.media : [],
          participants: participantCountFor('activity', Number(item.id || 0)),
          attendees: attendeeCountFor('activity', Number(item.id || 0)),
          shares: shareCountFor('activity', Number(item.id || 0)),
          sortOrder: Number(item.sortOrder || 0),
          order: Number(item.sortOrder || 0),
          updatedAt: item.updatedAt || '',
          templateSource: normalizeTemplateSource(item.templateSource),
          templateTag: String(item.templateTag || templateSourceLabel(item.templateSource)),
      }));
      const mappedProducts = (productRes.list || []).map((item: BMallProduct, idx: number) => ({
          id: Number(item.id || idx + 1),
          title: item.title || `商品${idx + 1}`,
          image: pickPreview(item.media) || '',
          description: String((item as any).description || ''),
          points: Number((item as any).points || 0),
          stock: Number((item as any).stock || 0),
          status: toRunningStatusLabel(String((item as any).status || 'active')),
          rawStatus: String((item as any).status || 'active'),
          media: Array.isArray(item.media) ? item.media : [],
          views: viewCountFor('mall_item', Number(item.id || 0)),
          participants: participantCountFor('mall_item', Number(item.id || 0)),
          shares: shareCountFor('mall_item', Number(item.id || 0)),
          sortOrder: Number(item.sortOrder || 0),
          order: Number(item.sortOrder || 0),
          updatedAt: item.updatedAt || '',
          templateSource: normalizeTemplateSource(item.templateSource),
          templateTag: String(item.templateTag || templateSourceLabel(item.templateSource)),
      }));
      const mappedMallActivities = (mallActRes.list || []).map((item: BMallActivity, idx: number) => ({
          id: Number(item.id || idx + 1),
          title: item.title || `货架活动${idx + 1}`,
          image: pickPreview(item.media) || '',
          description: String((item as any).description || ''),
          rewardPoints: Number(item.rewardPoints || 0),
          media: Array.isArray(item.media) ? item.media : [],
          icon: isRunningStatusActive(item.status) ? PartyPopper : TimerOff,
          iconColor: isRunningStatusActive(item.status) ? 'text-primary' : 'text-slate-500',
          iconBg: isRunningStatusActive(item.status) ? 'bg-primary/10' : 'bg-slate-200',
          views: viewCountFor('mall_activity', Number(item.id || 0)),
          participants: participantCountFor('mall_activity', Number(item.id || 0)),
          shares: shareCountFor('mall_activity', Number(item.id || 0)),
          sortOrder: Number(item.sortOrder || 0),
          order: Number(item.sortOrder || 0),
          active: isRunningStatusActive(item.status),
          status: toRunningStatusLabel(String(item.status || 'active')),
          rawStatus: String(item.status || 'active'),
          updatedAt: item.updatedAt || '',
          templateSource: normalizeTemplateSource(item.templateSource),
          templateTag: String(item.templateTag || templateSourceLabel(item.templateSource)),
      }));
      setContentItems(sortToolItemsByOrder(mappedContent));
      setActivityItems(sortToolItemsByOrder(mappedActivities));
      setMallProducts(sortToolItemsByOrder(mappedProducts));
      setMallActivities(sortToolItemsByOrder(mappedMallActivities));
      setToolError('');
    } catch (err: any) {
      if (isDisposed()) return;
      setToolError(err?.message || ERROR_COPY.toolDataLoadFailed);
    }
  };

  useEffect(() => {
    const disposedRef = { disposed: false };
    void loadToolData(disposedRef);
    return () => {
      disposedRef.disposed = true;
    };
  }, []);

  useEffect(() => {
    const disposedRef = { disposed: false };
    const refresh = () => {
      if (disposedRef.disposed) return;
      void loadShareOverview(disposedRef);
    };
    refresh();

    const handleFocus = () => refresh();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    const timer = window.setInterval(refresh, 15000);

    return () => {
      disposedRef.disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    setStatusFilter('all');
  }, [activeSubTab]);

  useEffect(() => {
    setMallCreateMenuOpen(false);
  }, [activeSubTab, editorView]);

  useEffect(() => {
    if (availableSubTabs.some((tab) => tab.id === activeSubTab)) return;
    setActiveSubTab(availableSubTabs[0]?.id || 'activities');
  }, [activeSubTab, availableSubTabs]);

  const openToolEditor = (
    targetView: 'add-content' | 'add-product' | 'add-activity-config' | 'add-mall-activity',
  ) => {
    setEditingItem(null);
    setMallCreateMenuOpen(false);
    setEditorView(targetView);
  };

  const filteredContentItems = sortToolItemsByOrder(
    contentItems.filter((item) =>
      matchesStatus(String(item.rawStatus || item.status || ''), 'content')
      && matchesTemplateKeyword(item)
    )
  );
  const filteredActivityItems = sortToolItemsByOrder(
    activityItems.filter((item) =>
      matchesStatus(String(item.rawStatus || item.status || ''), 'running')
      && matchesTemplateKeyword(item)
    )
  );
  const filteredMallProducts = sortToolItemsByOrder(
    mallProducts.filter((item) =>
      matchesStatus(String(item.rawStatus || item.status || ''), 'running')
      && matchesTemplateKeyword(item)
    )
  );
  const filteredMallActivities = sortToolItemsByOrder(
    mallActivities.filter((item) =>
      matchesStatus(String(item.rawStatus || item.status || ''), 'running')
      && matchesTemplateKeyword(item)
    )
  );

  if (editorView === 'add-content') {
    return <AddContentManageView onBack={() => { setEditorView('none'); setEditingItem(null); }} onSaved={() => void loadToolData()} initialItem={editingItem?.kind === 'content' ? editingItem.item : undefined} />;
  }
  if (editorView === 'add-product') {
    return <AddMallProductView onBack={() => { setEditorView('none'); setEditingItem(null); }} onSaved={() => void loadToolData()} initialItem={editingItem?.kind === 'product' ? editingItem.item : undefined} />;
  }
  if (editorView === 'add-activity-config') {
    return <AddActivityConfigView onBack={() => { setEditorView('none'); setEditingItem(null); }} onSaved={async () => { await loadToolData(); }} initialItem={editingItem?.kind === 'activity' ? editingItem.item : undefined} />;
  }
  if (editorView === 'add-mall-activity') {
    return <AddMallActivityView onBack={() => { setEditorView('none'); setEditingItem(null); }} onSaved={async () => { await loadToolData(); }} initialItem={editingItem?.kind === 'mall-activity' ? editingItem.item : undefined} />;
  }
  if (editorView === 'product-detail') {
    const product = detailPageItem?.kind === 'product' ? detailPageItem.item : null;
    const sharePath = bToolKindDetailSharePath('product');
    const sharingProduct = sharingKey === `product:${Number(product?.id || 0)}`;
    return (
      <div className="flex h-full flex-1 flex-col overflow-hidden bg-background-light">
        <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => {
                setEditorView('none');
                setDetailPageItem(null);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
              aria-label="返回积分商城"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-bold text-slate-900">商品详情</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!product) return;
                  setEditingItem({ kind: 'product', item: product });
                  setEditorView('add-product');
                }}
                className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                编辑
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-10">
          {!product ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">未找到商品详情</div>
          ) : (
            <div className="space-y-4">
              {renderDetailTemplatePreview('product', product)}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">所需积分</p>
                  <p className="mt-2 text-2xl font-black text-primary">{Number(product.points || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">库存</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{Number(product.stock || 0)}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">模板来源</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {product.templateTag || templateSourceLabel(product.templateSource)}
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">详情内容</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {product.description || '暂无详情内容'}
                </p>
              </div>
              {sharePath ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleShareToolItem('product', product, sharePath)}
                    disabled={sharingProduct}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sharingProduct ? '分享中...' : `分享商品（${shareCountText(product.shares)}）`}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenShareEffect({ id: Number(product.id || 0), title: String(product.title || ''), shareType: 'mall_item' })}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
                  >
                    商城效果
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    );
  }

  if (!availableSubTabs.length) {
    return <NoPermissionPanel description="当前账号没有获客工具菜单权限。" />;
  }

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden">
      {/* Header Section */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shrink-0">
        <div className="relative flex items-center justify-center px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">获客工具</h1>
          {activeSubTab === 'mall' ? (
            <button
              type="button"
              onClick={() => setMallCreateMenuOpen((prev) => !prev)}
              aria-label={mallCreateMenuOpen ? '收起积分商城模板创建菜单' : '打开积分商城模板创建菜单'}
              className="absolute right-4 inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              新建
            </button>
          ) : null}
        </div>
        {activeSubTab === 'mall' && mallCreateMenuOpen ? (
          <div className="border-t border-slate-100 bg-white px-4 pb-3">
            <div className="ml-auto flex w-44 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
              <button
                type="button"
                onClick={() => openToolEditor('add-product')}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>新建商品模板</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => openToolEditor('add-mall-activity')}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>新建活动模板</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        ) : null}
        
        {/* Top Navigation Tabs */}
        <div className="flex px-4 border-b border-slate-100">
          {availableSubTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 py-3 text-center text-sm transition-colors ${
                activeSubTab === tab.id ? 'font-bold text-primary border-b-2 border-primary' : 'font-medium text-slate-500 hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={templateKeyword}
              onChange={(e) => setTemplateKeyword(e.target.value)}
              placeholder="搜索标题、平台模板、公司模板、个人模板"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap mr-1">状态:</span>
            {currentFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value as ContentRunningStatusFilter)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === opt.value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-4">
        {toolError ? <div className="text-xs text-rose-500">{toolError}</div> : null}
        {activeSubTab === 'content' && (
          <>
            {filteredContentItems.map((item, index) => (
              <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className="flex gap-3">
                  {hasImage(item.image) ? (
                    <div
                      className="w-24 h-24 rounded-lg bg-cover bg-center shrink-0 relative"
                      style={{ backgroundImage: `url('${item.image}')` }}
                    >
                      <span className={`absolute top-1 left-1 ${contentStatusBadgeClass(item.rawStatus || item.status)}`}>
                        {toContentStatusLabel(item.rawStatus || item.status)}
                      </span>
                      {item.type === 'video' ? (
                        <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1 rounded">{item.duration}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <GraduationCap className="w-8 h-8" />
                      <span className={`absolute top-1 left-1 ${contentStatusBadgeClass(item.rawStatus || item.status)}`}>
                        {toContentStatusLabel(item.rawStatus || item.status)}
                      </span>
                    </div>
                  )}
	                  <div className="flex-1 flex flex-col justify-between">
	                    <div>
	                      <div className="flex items-start justify-between gap-2">
	                        <h3 className="font-bold text-sm leading-tight line-clamp-2 text-slate-900">{item.title}</h3>
	                      </div>
	                      <div className="mt-2 flex items-center gap-2">
	                        <span className={templateSourceBadgeClass(item.templateSource)}>{item.templateTag || templateSourceLabel(item.templateSource)}</span>
	                      </div>
	                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
	                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {item.views}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenToolMetricParticipants({
                              id: Number(item.id || 0),
                              title: String(item.title || ''),
                              shareType: 'learning_course',
                            })
                          }
                          aria-label={`查看学习参与客户-${String(item.title || '')}`}
                          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-primary/[0.06] hover:text-primary"
                        >
                          <Users className="w-3 h-3" /> {item.participants}
                        </button>
                        <button
                          onClick={() => void handleShareToolItem('content', item, 'content_list')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <Share2 className="w-3 h-3" /> {shareCountText(item.shares)}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                        <button
                          type="button"
                          onClick={() => void handleMoveContentItem(Number(item.id || 0), 'up')}
                          disabled={index === 0 || Number(movingContentItemId || 0) === Number(item.id || 0)}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          上移
                        </button>
                        <span className="min-w-8 text-center text-xs font-bold text-primary">{formatToolOrder(item.sortOrder ?? item.order)}</span>
                        <button
                          type="button"
                          onClick={() => void handleMoveContentItem(Number(item.id || 0), 'down')}
                          disabled={index === filteredContentItems.length - 1 || Number(movingContentItemId || 0) === Number(item.id || 0)}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          下移
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDetailModal({ kind: 'content', item })}
                          className="text-primary text-xs font-semibold hover:text-primary/80"
                        >
                          {ACTION_COPY.view}
                        </button>
                        <button
                          onClick={() => onOpenShareEffect({ id: Number(item.id || 0), title: String(item.title || ''), shareType: 'learning_course' })}
                          className="text-primary text-xs font-semibold hover:text-primary/80"
                        >
                          学习效果
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem({ kind: 'content', item });
                            setEditorView('add-content');
                          }}
                          className="text-primary text-xs font-semibold hover:text-primary/80"
                        >
                          {ACTION_COPY.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteContentItem(item)}
                          disabled={Number(deletingContentItemId || 0) === Number(item.id || 0)}
                          className="inline-flex items-center gap-1 text-rose-500 text-xs font-semibold hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {Number(deletingContentItemId || 0) === Number(item.id || 0) ? '删除中' : '删除'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {activeSubTab === 'activities' && (
          <>
            {filteredActivityItems.map((item, index) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="relative h-40 w-full bg-slate-200">
                  {hasImage(item.image) ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url('${item.image}')` }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50 text-orange-400">
                      <PartyPopper className="w-10 h-10" />
                    </div>
                  )}
                  <div className={`absolute top-3 left-3 ${runningStatusBadgeClass(item.rawStatus || item.status)}`}>
                    {toRunningStatusLabel(item.rawStatus || item.status)}
                  </div>
                </div>
	                <div className="p-4">
	                  <div className="mb-3">
	                    <h3 className="text-base font-bold leading-6 text-slate-900 line-clamp-2">{item.title}</h3>
	                    <div className="mt-2 flex items-center gap-2">
	                      <span className={templateSourceBadgeClass(item.templateSource)}>{item.templateTag || templateSourceLabel(item.templateSource)}</span>
	                    </div>
	                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenToolMetricParticipants(
                            { id: Number(item.id || 0), title: String(item.title || ''), shareType: 'activity' },
                            'signup',
                          )
                        }
                        aria-label={`查看活动报名客户-${String(item.title || '')}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
                      >
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Users className="h-4 w-4" />
                          <span className="text-[11px] font-semibold">报名</span>
                        </div>
                        <p className="mt-2 text-lg font-black text-slate-900">{item.participants}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenToolMetricParticipants(
                            { id: Number(item.id || 0), title: String(item.title || ''), shareType: 'activity' },
                            'attended',
                          )
                        }
                        aria-label={`查看活动参加客户-${String(item.title || '')}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <BadgeCheck className="h-4 w-4" />
                          <span className="text-[11px] font-semibold">参加</span>
                        </div>
                        <p className="mt-2 text-lg font-black text-slate-900">{String((item as any).attendees || '0')}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleShareToolItem('activity', item, 'activity_config_list')}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04]"
                      >
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Share2 className="h-4 w-4" />
                          <span className="text-[11px] font-semibold">分享</span>
                        </div>
                        <p className="mt-2 text-lg font-black text-slate-900">{shareCountText(item.shares)}</p>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setDetailModal({ kind: 'activity', item })}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        {ACTION_COPY.view}
                      </button>
                      <button
                        onClick={() => onOpenShareEffect({ id: Number(item.id || 0), title: String(item.title || ''), shareType: 'activity' })}
                        className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <BarChart2 className="w-4 h-4" />
                        活动效果
                      </button>
                      <button
                        onClick={() => {
                          setEditingItem({ kind: 'activity', item });
                          setEditorView('add-activity-config');
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        {ACTION_COPY.edit}
                      </button>
                      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                        <button
                          type="button"
                          onClick={() => void handleMoveActivityItem(Number(item.id || 0), 'up')}
                          disabled={index === 0 || Number(movingActivityItemId || 0) === Number(item.id || 0)}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          上移
                        </button>
                        <span className="min-w-8 text-center text-xs font-bold text-primary">{formatToolOrder(item.sortOrder ?? item.order)}</span>
                        <button
                          type="button"
                          onClick={() => void handleMoveActivityItem(Number(item.id || 0), 'down')}
                          disabled={index === filteredActivityItems.length - 1 || Number(movingActivityItemId || 0) === Number(item.id || 0)}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          下移
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {activeSubTab === 'mall' && (
          <div className="space-y-6">
            {/* Product Shelf Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                  <span className="w-1 h-5 bg-primary rounded-full"></span>
                  商品货架
                </h2>
                <button
                  onClick={() => setEditorView('add-product')}
                  className="flex items-center gap-1 text-primary text-sm font-semibold hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  添加商品
                </button>
              </div>
              <div className="space-y-3">
                {filteredMallProducts.map((product, index) => (
                  <div
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openMallProductDetail(product)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      openMallProductDetail(product);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.02]"
                  >
                    {hasImage(product.image) ? (
                      <div
                        className="h-14 w-14 rounded-lg bg-slate-100 flex-shrink-0 bg-cover bg-center"
                        style={{ backgroundImage: `url('${product.image}')` }}
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Gift className="w-6 h-6" />
                      </div>
                    )}
	                    <div className="flex-1 min-w-0">
	                      <div className="flex items-center justify-between gap-2">
	                        <div className="min-w-0">
	                          <p className="text-sm font-bold truncate text-slate-900">{product.title}</p>
	                          <div className="mt-1 flex items-center gap-2">
	                            <span className={templateSourceBadgeClass(product.templateSource)}>{product.templateTag || templateSourceLabel(product.templateSource)}</span>
	                          </div>
	                        </div>
	                        <span className={`shrink-0 ${runningStatusBadgeClass(product.rawStatus || product.status)}`}>
	                          {toRunningStatusLabel(product.rawStatus || product.status)}
	                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {product.views}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onOpenToolMetricParticipants({
                              id: Number(product.id || 0),
                              title: String(product.title || ''),
                              shareType: 'mall_item',
                            });
                          }}
                          aria-label={`查看商品参与客户-${String(product.title || '')}`}
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-primary/[0.06] hover:text-primary"
                        >
                          <Users className="w-3.5 h-3.5" /> {product.participants}
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleShareToolItem('product', product, 'mall_product_list');
                          }}
                          className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          {shareCountText(product.shares)}
                        </button>
                        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleMoveMallProduct(Number(product.id || 0), 'up');
                            }}
                            disabled={index === 0 || Number(movingMallProductId || 0) === Number(product.id || 0)}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            上移
                          </button>
                          <span className="min-w-8 text-center text-xs font-bold text-primary">{product.sortOrder ?? product.order}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleMoveMallProduct(Number(product.id || 0), 'down');
                            }}
                            disabled={index === filteredMallProducts.length - 1 || Number(movingMallProductId || 0) === Number(product.id || 0)}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            下移
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openMallProductDetail(product);
                        }}
                        className="text-xs font-semibold text-primary hover:text-primary/80"
                      >
                        查看
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenShareEffect({ id: Number(product.id || 0), title: String(product.title || ''), shareType: 'mall_item' });
                        }}
                        className="text-xs font-semibold text-primary hover:text-primary/80"
                      >
                        商城效果
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingItem({ kind: 'product', item: product });
                          setEditorView('add-product');
                        }}
                        className="text-xs font-semibold text-primary hover:text-primary/80"
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Divider */}
            <div className="h-2 bg-slate-50 border-y border-slate-100 -mx-4"></div>

            {/* Activity Shelf Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                  <span className="w-1 h-5 bg-primary rounded-full"></span>
                  活动货架
                </h2>
                <button
                  onClick={() => setEditorView('add-mall-activity')}
                  className="flex items-center gap-1 text-primary text-sm font-semibold hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  添加活动
                </button>
              </div>
              <div className="space-y-3">
                {filteredMallActivities.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className={`flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm ${!activity.active ? 'opacity-60' : ''}`}>
                      <div className={`h-14 w-14 rounded-lg ${activity.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-7 h-7 ${activity.iconColor}`} />
                      </div>
	                      <div className="flex-1 min-w-0">
	                        <div className="flex items-center justify-between gap-2">
	                          <div className="min-w-0">
	                            <p className={`text-sm font-bold truncate ${!activity.active ? 'text-slate-500' : 'text-slate-900'}`}>{activity.title}</p>
	                            <div className="mt-1 flex items-center gap-2">
	                              <span className={templateSourceBadgeClass(activity.templateSource)}>{activity.templateTag || templateSourceLabel(activity.templateSource)}</span>
	                            </div>
	                          </div>
	                          <span className={`shrink-0 ${runningStatusBadgeClass(activity.rawStatus || activity.status)}`}>
	                            {toRunningStatusLabel(activity.rawStatus || activity.status)}
	                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {activity.views}</span>
                          <button
                            type="button"
                            onClick={() =>
                              onOpenToolMetricParticipants({
                                id: Number(activity.id || 0),
                                title: String(activity.title || ''),
                                shareType: 'mall_activity',
                              })
                            }
                            aria-label={`查看商城活动参与客户-${String(activity.title || '')}`}
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-primary/[0.06] hover:text-primary"
                          >
                            <Users className="w-3.5 h-3.5" /> {activity.participants}
                          </button>
                          <button
                            onClick={() => void handleShareToolItem('mall-activity', activity, 'mall_activity_list')}
                            className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            {shareCountText(activity.shares)}
                          </button>
                          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1">
                            <button
                              type="button"
                              onClick={() => void handleMoveMallActivity(Number(activity.id || 0), 'up')}
                              disabled={index === 0 || Number(movingMallActivityId || 0) === Number(activity.id || 0)}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              上移
                            </button>
                            <span className="min-w-8 text-center text-xs font-bold text-primary">{activity.sortOrder ?? activity.order}</span>
                            <button
                              type="button"
                              onClick={() => void handleMoveMallActivity(Number(activity.id || 0), 'down')}
                              disabled={index === filteredMallActivities.length - 1 || Number(movingMallActivityId || 0) === Number(activity.id || 0)}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              下移
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setDetailModal({ kind: 'mall-activity', item: activity })}
                          className="text-xs font-semibold text-primary hover:text-primary/80"
                        >
                          查看
                        </button>
                        <button
                          onClick={() => onOpenShareEffect({ id: Number(activity.id || 0), title: String(activity.title || ''), shareType: 'mall_activity' })}
                          className="text-xs font-semibold text-primary hover:text-primary/80"
                        >
                          商城效果
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem({ kind: 'mall-activity', item: activity });
                            setEditorView('add-mall-activity');
                          }}
                          className="text-xs font-semibold text-primary hover:text-primary/80"
                        >
                          编辑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty State Hint */}
              <div className="mt-6 p-6 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                <LayoutDashboard className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">可使用卡片上的上移 / 下移调整显示顺序</p>
              </div>
            </section>
          </div>
        )}
      </main>

      {detailModal && (
        <div className="absolute inset-0 z-[70] bg-black/45 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {bToolKindDetailTitle(detailModal.kind)}
              </h3>
              <button onClick={() => setDetailModal(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-slate-400">模板预览</p>
                {renderDetailTemplatePreview(detailModal.kind, detailModal.item)}
              </div>
	              <div className="grid grid-cols-2 gap-3 text-xs">
	                <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">标题</span><p className="font-semibold text-slate-800 mt-1">{detailModal.item?.title || '-'}</p></div>
	                <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">状态</span><p className="font-semibold text-slate-800 mt-1">{
	                  detailModal.kind === 'content'
	                    ? toContentStatusLabel(String(detailModal.item?.rawStatus || detailModal.item?.status || (detailModal.item?.active ? 'published' : 'draft')))
	                    : toRunningStatusLabel(String(detailModal.item?.rawStatus || detailModal.item?.status || (detailModal.item?.active ? 'active' : 'draft')))
	                }</p></div>
	                <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">模板来源</span><p className="font-semibold text-slate-800 mt-1">{detailModal.item?.templateTag || templateSourceLabel(detailModal.item?.templateSource)}</p></div>
	                {detailModal.kind === 'content' ? <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">类型</span><p className="font-semibold text-slate-800 mt-1">{detailModal.item?.type || '-'}</p></div> : null}
                {detailModal.kind === 'content' || detailModal.kind === 'activity' || detailModal.kind === 'mall-activity' ? <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">奖励积分</span><p className="font-semibold text-slate-800 mt-1">{Number(detailModal.item?.rewardPoints || 0)}</p></div> : null}
                {detailModal.kind === 'product' ? <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">所需积分</span><p className="font-semibold text-slate-800 mt-1">{Number(detailModal.item?.points || 0)}</p></div> : null}
                {detailModal.kind === 'product' ? <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">库存</span><p className="font-semibold text-slate-800 mt-1">{Number(detailModal.item?.stock || 0)}</p></div> : null}
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-400 text-xs">详情内容</span>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">
                  {detailModal.item?.description || '暂无详情内容'}
                </p>
              </div>
              {(() => {
                const sharePath = bToolKindDetailSharePath(detailModal.kind);
                if (!sharePath) return null;
                return (
                  <div className="space-y-2">
                    <button
                      onClick={() => void handleShareToolItem(detailModal.kind, detailModal.item, sharePath)}
                      disabled={sharingKey === `${detailModal.kind}:${Number(detailModal.item?.id || 0)}`}
                      className="w-full h-11 rounded-xl border border-primary/30 bg-primary/5 text-primary font-semibold hover:bg-primary/10 disabled:opacity-60"
                    >
                      {sharingKey === `${detailModal.kind}:${Number(detailModal.item?.id || 0)}`
                        ? '分享中...'
                        : `分享${bToolKindShareButtonLabel(detailModal.kind)}（${shareCountText(detailModal.item?.shares)}）`}
                    </button>
                    {detailModal.kind === 'content' ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteContentItem(detailModal.item)}
                        disabled={Number(deletingContentItemId || 0) === Number(detailModal.item?.id || 0)}
                        className="w-full h-11 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 font-semibold hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {Number(deletingContentItemId || 0) === Number(detailModal.item?.id || 0) ? '删除中...' : '删除学习资料'}
                      </button>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {shareSheet && (
        <div className="absolute inset-0 z-[72] bg-black/55 flex items-start justify-center overflow-y-auto p-0 sm:p-4">
          <div className="w-full max-w-xl rounded-b-[28px] sm:rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white/95 backdrop-blur">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Share Preview</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">分享链接已生成</h3>
              </div>
              <button
                onClick={() => setShareSheet(null)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
                aria-label="close-share-sheet"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleOpenSharePreview(shareSheet)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  打开 H5
                </button>
                <button
                  onClick={() => void handleCopyShareUrl(shareSheet)}
                  className="h-11 rounded-2xl border border-primary/30 bg-primary/5 text-primary font-semibold hover:bg-primary/10 transition-colors"
                >
                  复制链接
                </button>
                <button
                  onClick={() => void handleCopyShareText(shareSheet)}
                  className="h-11 rounded-2xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  复制文案
                </button>
                <button
                  onClick={() => void handleSystemShare(shareSheet)}
                  className="h-11 rounded-2xl bg-primary text-white font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
                >
                  系统分享
                </button>
              </div>

              <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Share URL</span>
                <p className="mt-2 break-all text-sm leading-6 text-slate-800 select-all">{shareSheet.shareUrl}</p>
                <p className="mt-2 text-xs text-slate-500">手机端如果复制受限，可长按上方链接手动复制。</p>
              </div>

              <div className="rounded-[28px] overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
                {shareSheet.previewPayload?.cover ? (
                  <div className="aspect-[4/3] relative">
                    <img
                      src={String(shareSheet.previewPayload.cover)}
                      alt={shareSheet.previewPayload?.title || shareSheet.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                    <div className="absolute left-4 top-4 inline-flex rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold tracking-[0.18em] text-slate-800">
                      {shareSheet.previewPayload?.tag || shareSheet.shareLabel}
                    </div>
                    <div className="absolute inset-x-4 bottom-4">
                      <h4 className="text-2xl font-black leading-tight">{shareSheet.previewPayload?.title || shareSheet.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-white/80">
                        {shareSheet.previewPayload?.subtitle || '客户打开后将看到 C 端 H5 分享页。'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/75">
                      {shareSheet.previewPayload?.tag || shareSheet.shareLabel}
                    </span>
                    <h4 className="mt-4 text-2xl font-black">{shareSheet.previewPayload?.title || shareSheet.title}</h4>
                    <p className="mt-3 text-sm leading-6 text-white/80">
                      {shareSheet.previewPayload?.subtitle || '客户打开后将看到 C 端 H5 分享页。'}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <span className="text-slate-400">分享类型</span>
                  <p className="mt-1 font-semibold text-slate-800">{shareSheet.shareLabel}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <span className="text-slate-400">有效期</span>
                  <p className="mt-1 font-semibold text-slate-800">{shareSheet.expiresAt ? new Date(shareSheet.expiresAt).toLocaleString('zh-CN', { hour12: false }) : '-'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">C Path</span>
                <p className="mt-2 break-all text-sm leading-6 text-slate-700">{shareSheet.targetCPath || '-'}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">使用建议</span>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    <p>1. 电脑端复制链接发给客户，客户直接打开 H5。</p>
                    <p>2. 面对面沟通时，让客户直接扫码打开分享页。</p>
                    <p>3. 客户进入 H5 后，再点 CTA 跳到 C 端对应页面。</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">QR Preview</span>
                    <QrCode className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    {shareQrDataUrl ? (
                      <img src={shareQrDataUrl} alt="share qr" className="mx-auto h-40 w-40 rounded-xl bg-white object-contain p-2" />
                    ) : (
                      <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-xl bg-white text-xs text-slate-400">
                        二维码生成中...
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDownloadShareQr(shareSheet)}
                    disabled={!shareQrDataUrl}
                    className="mt-3 h-10 w-full rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    下载二维码
                  </button>
                  <button
                    onClick={() => void handleDownloadSharePoster(shareSheet)}
                    disabled={!shareQrDataUrl || sharePosterGenerating}
                    className="mt-2 h-10 w-full rounded-xl border border-primary/30 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {sharePosterGenerating ? '海报生成中...' : '下载海报'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button or Bottom Action Bar */}
      {activeSubTab === 'mall' ? (
        <div className="absolute bottom-[4.5rem] left-0 right-0 bg-white/90 backdrop-blur-md p-4 border-t border-slate-200 flex gap-3 z-40">
          <button className="flex-1 h-12 rounded-xl border-2 border-primary text-primary font-bold hover:bg-primary/5 transition-colors">
            {ACTION_COPY.previewMall}
          </button>
          <button className="flex-[2] h-12 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95">
            {ACTION_COPY.saveConfig}
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            openToolEditor(activeSubTab === 'activities' ? 'add-activity-config' : 'add-content');
          }}
          className="fixed right-6 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 transition-transform active:scale-95"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}

function AnalyticsView({
  hasStatsPermission,
  customers,
  orders,
  dashboardMetrics,
  dashboardMetricsLoading,
  selectedShareEffect,
  onClearShareEffect,
  onOpenParticipantCustomer,
  onOpenDashboardParticipants,
}: {
  hasStatsPermission: boolean;
  customers: typeof CUSTOMERS;
  orders: BOrder[];
  dashboardMetrics: BDashboardMetricsResponse | null;
  dashboardMetricsLoading: boolean;
  selectedShareEffect: SelectedShareEffect | null;
  onClearShareEffect: () => void;
  onOpenParticipantCustomer: (customer: {
    userId: number;
    name: string;
    mobile: string;
    shareType: BEffectShareType;
    targetTitle?: string;
    occurredAt?: string;
    tagLabel?: string;
    summaryPrefix?: string;
  }) => void;
  onOpenDashboardParticipants: (metric: BDashboardCustomerListMetricKey) => void;
}) {
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'overview' | 'activity' | 'learning' | 'mall' | 'integration'>('overview');
  const [shareOverview, setShareOverview] = useState<BShareOverviewResponse | null>(null);
  const [shareOverviewLoading, setShareOverviewLoading] = useState(false);
  const [bChannelShareRecords, setBChannelShareRecords] = useState<BShareRecord[]>([]);
  const [cChannelShareRecords, setCChannelShareRecords] = useState<BShareRecord[]>([]);
  const [shareRecordDetail, setShareRecordDetail] = useState<BShareRecordDetailResponse | null>(null);
  const [shareRecordDetailCode, setShareRecordDetailCode] = useState('');
  const [shareRecordDetailLoading, setShareRecordDetailLoading] = useState(false);
  const [shareRecordDetailError, setShareRecordDetailError] = useState('');
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsData, setParticipantsData] = useState<BShareEffectParticipantsResponse | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState('');
  const [participantsMetric, setParticipantsMetric] = useState<BShareParticipantMetricKind>('signup');

  const dailyActiveSeries = dashboardMetrics?.dailyActiveSeries || [];
  const customerTotal = Number(dashboardMetrics?.customerTotal || customers.length || 0);
  const activityParticipants7d = Number(dashboardMetrics?.activityParticipants7d || 0);
  const newCustomersToday = Number(dashboardMetrics?.newCustomersToday || 0);
  const signInCustomersToday = Number(dashboardMetrics?.signInCustomersToday || 0);
  const dailyActive7dTotal = Number(dashboardMetrics?.dailyActive7dTotal || 0);
  const dailyActive7dPrevTotal = Number(dashboardMetrics?.dailyActive7dPrevTotal || 0);
  const activeEffectShareType: BEffectShareType =
    selectedShareEffect?.shareType || (activeAnalyticsTab === 'learning' ? 'learning_course' : activeAnalyticsTab === 'mall' ? 'mall_item' : 'activity');
  const selectedEffectForCurrentTab =
    selectedShareEffect?.shareType === activeEffectShareType ? selectedShareEffect : null;
  const effectCopy =
    activeAnalyticsTab === 'mall' && !selectedEffectForCurrentTab
      ? mallAggregateEffectCopy()
      : effectCopyByShareType(activeEffectShareType);
  const splitShareRecordsBySource = shouldSplitShareRecordsBySource(activeAnalyticsTab);
  const effectRecords =
    activeAnalyticsTab === 'mall' && !selectedEffectForCurrentTab
      ? (shareOverview?.list || []).filter((record) => record.shareType === 'mall_item' || record.shareType === 'mall_activity')
      : (shareOverview?.list || []);
  const shareRecordSections = splitShareRecordsBySource
    ? [
        {
          key: 'b',
          title: 'B端获客工具分享链接',
          emptyLabel: `当前范围还没有B端获客工具生成的${effectCopy.singularLabel}分享链接。`,
          records: bChannelShareRecords,
        },
        {
          key: 'c',
          title: 'C端客户转发分享链接',
          emptyLabel: `当前范围还没有客户从C端继续转发的${effectCopy.singularLabel}分享链接。`,
          records: cChannelShareRecords,
        },
      ]
    : [];
  const effectSummary = (() => {
    if (selectedEffectForCurrentTab) {
      const row = (shareOverview?.targetStats || []).find(
        (entry) =>
          String(entry.shareType || '') === String(activeEffectShareType) &&
          Number(entry.targetId || 0) === Number(selectedEffectForCurrentTab.id || 0),
      );
      return {
        totalItems: row ? 1 : 0,
        totalShares: Number(row?.totalLinks || 0),
        totalViews: Number(row?.totalViews || 0),
        totalParticipants: Number(row?.totalParticipants || 0),
        totalAttendees: Number(row?.totalAttendees || 0),
      };
    }
    if (activeAnalyticsTab === 'learning') {
      return {
        totalItems: Number(shareOverview?.learningEffect.totalCourses || 0),
        totalShares: Number(shareOverview?.learningEffect.totalShares || 0),
        totalViews: Number(shareOverview?.learningEffect.totalViews || 0),
        totalParticipants: Number(shareOverview?.learningEffect.totalParticipants || 0),
        totalAttendees: 0,
      };
    }
    if (activeAnalyticsTab === 'mall') {
      const mallRows = (shareOverview?.targetStats || []).filter(
        (row) => row.shareType === 'mall_item' || row.shareType === 'mall_activity',
      );
      return {
        totalItems: mallRows.length,
        totalShares: mallRows.reduce((sum, row) => sum + Number(row.totalLinks || 0), 0),
        totalViews: mallRows.reduce((sum, row) => sum + Number(row.totalViews || 0), 0),
        totalParticipants: mallRows.reduce((sum, row) => sum + Number(row.totalParticipants || 0), 0),
        totalAttendees: 0,
      };
    }
    return {
      totalItems: Number(shareOverview?.activityEffect.totalActivities || 0),
      totalShares: Number(shareOverview?.activityEffect.totalShares || 0),
      totalViews: Number(shareOverview?.activityEffect.totalViews || 0),
      totalParticipants: Number(shareOverview?.activityEffect.totalParticipants || 0),
      totalAttendees: Number(shareOverview?.activityEffect.totalAttendees || 0),
    };
  })();

  const loadShareOverview = async (disposedRef?: { disposed: boolean }) => {
    const isDisposed = () => Boolean(disposedRef?.disposed);
    if (!isDisposed()) setShareOverviewLoading(true);
    try {
      const overviewOptions = selectedEffectForCurrentTab
        ? {
            shareType: activeEffectShareType,
            targetId: Number(selectedEffectForCurrentTab?.id || 0) || undefined,
          }
        : activeAnalyticsTab === 'learning'
          ? { shareType: 'learning_course' as const }
          : activeAnalyticsTab === 'activity'
            ? { shareType: 'activity' as const }
            : {};
      const overview = await bApi.shareOverview(20, overviewOptions);
      if (isDisposed()) return;
      setShareOverview(overview);
      if (splitShareRecordsBySource) {
        const [bResult, cResult] = await Promise.allSettled([
          bApi.shareOverview(20, { ...overviewOptions, channel: 'b-web' }),
          bApi.shareOverview(20, { ...overviewOptions, channel: 'customer_forward' }),
        ]);
        if (isDisposed()) return;
        setBChannelShareRecords(bResult.status === 'fulfilled' ? bResult.value.list || [] : []);
        setCChannelShareRecords(cResult.status === 'fulfilled' ? cResult.value.list || [] : []);
      } else {
        setBChannelShareRecords([]);
        setCChannelShareRecords([]);
      }
    } catch {
      if (isDisposed()) return;
      setBChannelShareRecords([]);
      setCChannelShareRecords([]);
    } finally {
      if (!isDisposed()) setShareOverviewLoading(false);
    }
  };

  const openShareRecordDetail = async (record: BShareRecord) => {
    setShareRecordDetailCode(String(record.shareCode || ''));
    setShareRecordDetail(null);
    setShareRecordDetailError('');
    setShareRecordDetailLoading(true);
    try {
      const detail = await bApi.shareRecordDetail(String(record.shareCode || ''));
      setShareRecordDetail(detail);
    } catch (err: any) {
      setShareRecordDetailError(err?.message || '分享明细获取失败');
    } finally {
      setShareRecordDetailLoading(false);
    }
  };

  const openParticipants = async (metric: BShareParticipantMetricKind = 'signup') => {
    setParticipantsMetric(metric);
    setParticipantsOpen(true);
    setParticipantsLoading(true);
    setParticipantsError('');
    setParticipantsData(null);
    try {
      const detail =
        activeAnalyticsTab === 'mall' && !selectedEffectForCurrentTab
          ? await (async () => {
              const [productDetail, activityDetail] = await Promise.all([
                bApi.effectParticipants({ shareType: 'mall_item' }),
                bApi.effectParticipants({ shareType: 'mall_activity' }),
              ]);
              const merged = new Map<string, (typeof productDetail.list)[number]>();
              [...(productDetail.list || []), ...(activityDetail.list || [])].forEach((row) => {
                const key = Number(row.userId || 0) > 0 ? `user:${row.userId}` : `mobile:${row.mobile || ''}`;
                const prev = merged.get(key);
                if (!prev) {
                  merged.set(key, row);
                  return;
                }
                const prevTime = new Date(String(prev.occurredAt || 0)).getTime();
                const nextTime = new Date(String(row.occurredAt || 0)).getTime();
                if (nextTime >= prevTime) merged.set(key, row);
              });
              return {
                ok: true as const,
                scope: productDetail.scope,
                filter: null,
                total: merged.size,
                list: Array.from(merged.values()).sort(
                  (a, b) => new Date(String(b.occurredAt || 0)).getTime() - new Date(String(a.occurredAt || 0)).getTime(),
                ),
              };
            })()
          : await bApi.effectParticipants({
              shareType: activeEffectShareType,
              targetId: Number(selectedEffectForCurrentTab?.id || 0) || undefined,
              metric: activeEffectShareType === 'activity' ? metric : undefined,
            });
      setParticipantsData(detail);
    } catch (err: any) {
      const fallbackMessage =
        activeEffectShareType === 'activity' && metric === 'attended'
          ? effectCopy.attendedRefreshError || effectCopy.refreshError
          : effectCopy.refreshError;
      setParticipantsError(err?.message || fallbackMessage);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const handleCopyShareUrl = async (record: BShareRecord) => {
    const shareUrl = normalizeShareUrl(String(record.shareUrl || '').trim());
    if (!shareUrl) {
      alert('分享链接不存在');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert(NOTICE_COPY.shareLinkCopied);
        return;
      }
      alert(`${NOTICE_COPY.shareFallbackPrefix}\n${shareUrl}`);
    } catch {
      alert(NOTICE_COPY.shareFailedRetry);
    }
  };

  const renderShareRecordRow = (record: BShareRecord, showSourceLabel = false) => (
    <div key={record.shareCode} className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{record.targetTitle || record.previewPayload?.title || '未命名分享'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {showSourceLabel ? `${resolveShareChannelLabel(record.channel)} · ` : ''}
            {bToolKindShareLabel(kindByShareType(record.shareType))}
            {' · '}
            {record.createdAt ? new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            打开 {record.metrics.views} · 点击 {record.metrics.clicks} · 转化 {Math.round(Number(record.metrics.clickThroughRate || 0) * 100)}%
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => void openShareRecordDetail(record)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            查看
          </button>
          <button
            onClick={() => void handleCopyShareUrl(record)}
            className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            复制链接
          </button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    const disposedRef = { disposed: false };
    void loadShareOverview(disposedRef);
    const timer = window.setInterval(() => {
      void loadShareOverview(disposedRef);
    }, 15000);
    const onFocus = () => {
      void loadShareOverview(disposedRef);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      disposedRef.disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [activeEffectShareType, selectedEffectForCurrentTab?.id]);

  useEffect(() => {
    if (selectedShareEffect) setActiveAnalyticsTab(effectTabByShareType(selectedShareEffect.shareType));
  }, [selectedShareEffect]);

  if (!hasStatsPermission) {
    return <NoPermissionPanel description="当前账号没有业绩看板菜单权限。" />;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="w-10"></div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">数据中心</h1>
          <div className="w-10 flex justify-end">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold">
              D
            </div>
          </div>
        </div>
        <div className="flex px-4 gap-6 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveAnalyticsTab('overview')}
            className={`border-b-2 py-3 text-sm whitespace-nowrap ${activeAnalyticsTab === 'overview' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 font-medium'}`}
          >
            运营概览
          </button>
          <button
            onClick={() => setActiveAnalyticsTab('activity')}
            className={`border-b-2 py-3 text-sm whitespace-nowrap ${activeAnalyticsTab === 'activity' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 font-medium'}`}
          >
            活动效果
          </button>
          <button
            onClick={() => setActiveAnalyticsTab('learning')}
            className={`border-b-2 py-3 text-sm whitespace-nowrap ${activeAnalyticsTab === 'learning' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 font-medium'}`}
          >
            学习效果
          </button>
          <button
            onClick={() => setActiveAnalyticsTab('mall')}
            className={`border-b-2 py-3 text-sm whitespace-nowrap ${activeAnalyticsTab === 'mall' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 font-medium'}`}
          >
            商城效果
          </button>
          <button
            onClick={() => setActiveAnalyticsTab('integration')}
            className={`border-b-2 py-3 text-sm whitespace-nowrap ${activeAnalyticsTab === 'integration' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 font-medium'}`}
          >
            接入说明
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {activeAnalyticsTab === 'overview' ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">运营概览</h2>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{dashboardMetrics?.scope?.label || '作用域统计'}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onOpenDashboardParticipants('customer_total')}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <p className="text-xs text-slate-500">客户总数</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{formatCount(customerTotal)}</p>
                <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
              </button>
              <button
                type="button"
                onClick={() => onOpenDashboardParticipants('activity_participants_7d')}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <p className="text-xs text-slate-500">近7日活动参与人数</p>
                <p className="mt-2 text-2xl font-black text-primary">{formatCount(activityParticipants7d)}</p>
                <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
              </button>
              <button
                type="button"
                onClick={() => onOpenDashboardParticipants('new_customers_today')}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <p className="text-xs text-slate-500">今日新客户数</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{formatCount(newCustomersToday)}</p>
                <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
              </button>
              <button
                type="button"
                onClick={() => onOpenDashboardParticipants('signin_customers_today')}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <p className="text-xs text-slate-500">今日签到客户数</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{formatCount(signInCustomersToday)}</p>
                <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="mb-4">
                <p className="text-sm text-slate-500">最近7日日活趋势</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">{formatCount(dailyActive7dTotal)}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                    {trendLabel(dailyActive7dTotal, dailyActive7dPrevTotal, '较上个7天增长', '较上个7天回落')}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 py-4">
                <DailyActiveTrendChart series={dailyActiveSeries} heightClass="h-48" />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {dashboardMetricsLoading ? '正在刷新最近7日日活统计...' : '按客户当日真实活跃行为去重统计，包括实名、签到、活动参与、课程完成等行为。'}
              </p>
            </div>
          </section>
        ) : null}

        {activeAnalyticsTab === 'activity' || activeAnalyticsTab === 'learning' || activeAnalyticsTab === 'mall' ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  {activeAnalyticsTab === 'learning' ? 'Learning Effect' : activeAnalyticsTab === 'mall' ? 'Mall Effect' : 'Activity Effect'}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {selectedEffectForCurrentTab ? `${selectedEffectForCurrentTab.title} · ${effectCopy.tabLabel}` : effectCopy.tabLabel}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  当前统计范围：{shareOverview?.scope?.label || '加载中'}，自动每 15 秒刷新
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedEffectForCurrentTab ? (
                  <button
                    onClick={onClearShareEffect}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    查看全部
                  </button>
                ) : null}
                {shareOverviewLoading ? <span className="text-xs text-slate-400">刷新中...</span> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {selectedEffectForCurrentTab ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-400">{effectCopy.currentLabel}</p>
                  <p className="mt-2 text-base font-black text-slate-900 line-clamp-2">
                    {shareOverview?.filter?.targetTitle || selectedEffectForCurrentTab.title}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-400">{effectCopy.singularLabel}总数</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {effectSummary.totalItems || 0}
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-400">{effectCopy.shareMetricLabel}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{effectSummary.totalShares || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-400">{effectCopy.viewMetricLabel}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{effectSummary.totalViews || 0}</p>
              </div>
              <button
                onClick={() => void openParticipants('signup')}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <p className="text-xs text-slate-400">{effectCopy.participantMetricLabel}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{effectSummary.totalParticipants || 0}</p>
                <p className="mt-2 text-[11px] font-semibold text-primary">点击查看客户列表</p>
              </button>
              {activeEffectShareType === 'activity' ? (
                <button
                  onClick={() => void openParticipants('attended')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <p className="text-xs text-slate-400">{effectCopy.attendedMetricLabel || '活动参加人数'}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{effectSummary.totalAttendees || 0}</p>
                  <p className="mt-2 text-[11px] font-semibold text-emerald-600">点击查看客户列表</p>
                </button>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-900">{effectCopy.listLabel}</h3>
                <button
                  onClick={() => void loadShareOverview()}
                  className="text-xs font-semibold text-primary hover:text-primary/80"
                >
                  刷新数据
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {splitShareRecordsBySource ? (
                  shareRecordSections.some((section) => section.records.length) ? (
                    shareRecordSections.map((section, index) => (
                      <div key={section.key} className={index > 0 ? 'border-t border-slate-100' : ''}>
                        <div className="flex items-center justify-between bg-slate-50/80 px-4 py-2">
                          <p className="text-xs font-semibold text-slate-600">{section.title}</p>
                          <span className="text-[11px] text-slate-400">{section.records.length} 条</span>
                        </div>
                        {section.records.length ? (
                          section.records.map((record) => renderShareRecordRow(record))
                        ) : (
                          <div className="px-4 py-5 text-center text-sm text-slate-400">{section.emptyLabel}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                      {effectCopy.emptyLabel}
                    </div>
                  )
                ) : effectRecords.length ? (
                  effectRecords.map((record) => renderShareRecordRow(record, true))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    {effectCopy.emptyLabel}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeAnalyticsTab === 'integration' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">数据接入状态</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3 text-sm text-slate-600">
              <p>1. 当前页面只展示已接入的真实客户、订单和分享聚合数据。</p>
              <p>2. 客户活跃热力、签到深度分析、客户分群转化还没有接入正式统计接口。</p>
              <p>3. 在真实 analytics API 接入前，这里不再用演示图表和固定样本数据顶替。</p>
            </div>
          </section>
        ) : null}
      </main>

      {shareRecordDetailCode ? (
        <div className="absolute inset-0 z-[72] bg-black/55 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Share Detail</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">分享行为明细</h3>
              </div>
              <button
                onClick={() => {
                  setShareRecordDetailCode('');
                  setShareRecordDetail(null);
                  setShareRecordDetailError('');
                  setShareRecordDetailLoading(false);
                }}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
                aria-label="close-share-detail"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-5 space-y-4">
              {shareRecordDetailLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  正在加载分享行为明细...
                </div>
              ) : null}

              {!shareRecordDetailLoading && shareRecordDetailError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                  {shareRecordDetailError}
                </div>
              ) : null}

              {!shareRecordDetailLoading && shareRecordDetail ? (
                <>
                  {(() => {
                    const customerEvents = shareRecordDetail.events.filter(isCustomerTimelineEvent);
                    const identifiedCustomers = customerEvents.filter((event) => (event.actorType === 'customer' || event.actorType === 'user') && event.actorId);
                    const uniqueCustomerCount = new Set(identifiedCustomers.map((event) => `${event.actorType}:${event.actorId}`)).size;
                    const creatorEvent = shareRecordDetail.events.find((event) => event.event === 'share_link_created');

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <span className="text-slate-400">分享内容</span>
                            <p className="mt-1 font-semibold text-slate-800">{shareRecordDetail.record.targetTitle || shareRecordDetail.record.previewPayload?.title || '未命名分享'}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <span className="text-slate-400">生成时间</span>
                            <p className="mt-1 font-semibold text-slate-800">
                              {shareRecordDetail.record.createdAt
                                ? new Date(shareRecordDetail.record.createdAt).toLocaleString('zh-CN', { hour12: false })
                                : '-'}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <span className="text-slate-400">H5 打开</span>
                            <p className="mt-1 font-semibold text-slate-800">{shareRecordDetail.record.metrics.views}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <span className="text-slate-400">CTA 点击</span>
                            <p className="mt-1 font-semibold text-slate-800">{shareRecordDetail.record.metrics.clicks}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <span className="text-slate-400">客户动作数</span>
                            <p className="mt-1 font-semibold text-slate-800">{customerEvents.length}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-3">
                            <span className="text-slate-400">已识别客户</span>
                            <p className="mt-1 font-semibold text-slate-800">{uniqueCustomerCount}</p>
                          </div>
                        </div>

                        {creatorEvent ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">分享发起人</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">{creatorEvent.actorLabel}</span>
                              <span>{creatorEvent.actorMobile || '未登记电话'}</span>
                              <span>{creatorEvent.occurredAt ? new Date(creatorEvent.occurredAt).toLocaleString('zh-CN', { hour12: false }) : '-'}</span>
                            </div>
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <h4 className="text-sm font-bold text-slate-900">客户轨迹</h4>
                            <span className="text-xs text-slate-400">{customerEvents.length} 条</span>
                          </div>
                          {customerEvents.length ? (
                            <div className="divide-y divide-slate-100">
                              {customerEvents.map((event) => (
                                <div key={event.id} className="px-4 py-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">{event.actionLabel}</p>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                          {event.sourceLabel}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-slate-500">{event.actorLabel}</p>
                                      <p className="mt-1 text-xs text-slate-500">客户电话：{event.actorMobile || '未识别 / 未登录'}</p>
                                      <p className="mt-2 text-xs leading-5 text-slate-500">
                                        页面名称：{resolveCustomerEventPageName(shareRecordDetail.record, event)}
                                      </p>
                                      {resolveCustomerEventButtonName(shareRecordDetail.record, event) ? (
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          按钮名称：{resolveCustomerEventButtonName(shareRecordDetail.record, event)}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="text-xs font-semibold text-slate-700">
                                        {event.occurredAt ? new Date(event.occurredAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                                      </p>
                                      {event.actorId ? <p className="mt-1 text-[11px] text-slate-400">客户ID {event.actorId}</p> : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                              这条分享暂时还没有客户轨迹。如果客户未登录，只能记录匿名访问，无法识别姓名和电话。
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {participantsOpen ? (
        <div className="absolute inset-0 z-[72] bg-black/55 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Participants</p>
                <h3 className="mt-1 text-base font-bold text-slate-900">
                  {participantsMetric === 'attended' && activeEffectShareType === 'activity'
                    ? effectCopy.attendedListLabel || '活动参加客户'
                    : effectCopy.participantListLabel}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {participantsData?.filter?.targetTitle || selectedEffectForCurrentTab?.title || participantsData?.scope?.label || '当前统计范围'}
                </p>
              </div>
              <button
                onClick={() => {
                  setParticipantsOpen(false);
                  setParticipantsData(null);
                  setParticipantsError('');
                  setParticipantsLoading(false);
                }}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
                aria-label="close-participant-detail"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-5 space-y-4">
              {participantsLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  正在加载客户列表...
                </div>
              ) : null}

              {!participantsLoading && participantsError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                  {participantsError}
                </div>
              ) : null}

              {!participantsLoading && !participantsError ? (
                (participantsData?.list || []).length ? (
                  <div className="space-y-3">
                    {(participantsData?.list || []).map((row) => (
                      <button
                        key={row.userId}
                        type="button"
                        onClick={() => {
                          onOpenParticipantCustomer({
                            userId: Number(row.userId || 0),
                            name: String(row.name || ''),
                              mobile: String(row.mobile || ''),
                              shareType: isEffectShareType(row.shareType) ? row.shareType : activeEffectShareType,
                              targetTitle: String(row.targetTitle || ''),
                              occurredAt: String(row.occurredAt || ''),
                              tagLabel:
                                participantsMetric === 'attended' && activeEffectShareType === 'activity'
                                  ? effectCopy.attendedTag || '活动参加客户'
                                  : effectCopy.participantTag,
                              summaryPrefix:
                                participantsMetric === 'attended' && activeEffectShareType === 'activity'
                                  ? effectCopy.attendedSummaryPrefix || '参加活动：'
                                  : effectCopy.participantSummaryPrefix,
                            });
                          setParticipantsOpen(false);
                          setParticipantsData(null);
                          setParticipantsError('');
                          setParticipantsLoading(false);
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{row.name || `客户${row.userId}`}</p>
                              <p className="mt-1 text-sm text-slate-500">{row.mobile || '未留手机号'}</p>
                            </div>
                            <div className="shrink-0">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                {row.occurredAt ? new Date(row.occurredAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                              {effectCopy.singularLabel}
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-700 line-clamp-2">
                              {row.targetTitle || participantsData?.filter?.targetTitle || `未命名${effectCopy.singularLabel}`}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    当前没有
                    {participantsMetric === 'attended' && activeEffectShareType === 'activity'
                      ? effectCopy.attendedListLabel || '活动参加客户'
                      : effectCopy.participantListLabel}
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileView({
  session,
  profile,
  profileLoading,
  profileSaving,
  profileError,
  onSaveProfile,
  onLogout,
}: {
  session: BLoginSession | null;
  profile: BAdvisorProfile | null;
  profileLoading: boolean;
  profileSaving: boolean;
  profileError: string;
  onSaveProfile: (payload: { bio: string; avatarUrl?: string; wechatId?: string; wechatQrUrl?: string }) => Promise<void>;
  onLogout: () => void;
}) {
  const displayName = String(session?.name || '员工');
  const displayMobile = String(session?.mobile || '').trim();
  const displaySubTitle = displayMobile ? `手机号：${displayMobile}` : String(session?.account || '');
  const [bioDraft, setBioDraft] = useState(String(profile?.bio || ''));
  const [avatarDraft, setAvatarDraft] = useState(String(profile?.avatarUrl || ''));
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [wechatIdDraft, setWechatIdDraft] = useState(String(profile?.wechatId || ''));
  const [wechatQrDraft, setWechatQrDraft] = useState(String(profile?.wechatQrUrl || ''));
  const [wechatQrUploading, setWechatQrUploading] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBioDraft(String(profile?.bio || ''));
    setAvatarDraft(String(profile?.avatarUrl || ''));
    setWechatIdDraft(String(profile?.wechatId || ''));
    setWechatQrDraft(String(profile?.wechatQrUrl || ''));
  }, [profile?.bio, profile?.avatarUrl, profile?.wechatId, profile?.wechatQrUrl, session?.actorId]);

  const normalizedSavedBio = String(profile?.bio || '');
  const normalizedSavedAvatarUrl = String(profile?.avatarUrl || '');
  const normalizedSavedWechatId = String(profile?.wechatId || '');
  const normalizedSavedWechatQrUrl = String(profile?.wechatQrUrl || '');
  const hasPendingProfileChange =
    bioDraft !== normalizedSavedBio ||
    avatarDraft !== normalizedSavedAvatarUrl ||
    wechatIdDraft !== normalizedSavedWechatId ||
    wechatQrDraft !== normalizedSavedWechatQrUrl;
  const hasPendingAvatarChange = avatarDraft !== normalizedSavedAvatarUrl;
  const hasPendingWechatChange =
    wechatIdDraft !== normalizedSavedWechatId || wechatQrDraft !== normalizedSavedWechatQrUrl;

  const readFileAsUploadItem = (file: File) =>
    new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type || 'application/octet-stream',
          dataUrl: String(reader.result || ''),
        });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAvatarPick = async (file: File | null) => {
    if (!file || avatarUploading) return;
    try {
      setAvatarUploading(true);
      const uploadItem = await readFileAsUploadItem(file);
      const resp = await bApi.uploadMediaBase64(uploadItem);
      setAvatarDraft(String(resp.file.path || resp.file.url || '').trim());
    } catch (e: any) {
      showApiError(e, '头像上传失败');
    } finally {
      setAvatarUploading(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  const handleWechatQrPick = async (file: File | null) => {
    if (!file || wechatQrUploading) return;
    try {
      setWechatQrUploading(true);
      const uploadItem = await readFileAsUploadItem(file);
      const resp = await bApi.uploadMediaBase64(uploadItem);
      setWechatQrDraft(String(resp.file.path || resp.file.url || '').trim());
    } catch (e: any) {
      showApiError(e, '微信二维码上传失败');
    } finally {
      setWechatQrUploading(false);
      if (qrFileInputRef.current) qrFileInputRef.current.value = '';
    }
  };
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Header / Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">个人中心</h1>
        <button className="text-slate-500 hover:text-primary transition-colors">
          <Settings className="w-6 h-6" />
        </button>
      </div>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Profile Info Section */}
        <div className="px-6 py-8 flex flex-col items-center text-center">
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleAvatarPick(event.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => avatarFileInputRef.current?.click()}
            disabled={avatarUploading || profileSaving}
            className="relative group cursor-pointer disabled:cursor-not-allowed"
          >
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-primary/10 bg-primary/10 text-3xl font-black text-primary">
              {avatarDraft ? (
                <img src={avatarDraft} alt="头像预览" className="h-full w-full object-cover" />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg border-2 border-white">
              <Camera className="w-4 h-4" />
            </div>
          </button>
          <div className="mt-4 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{displayName}</h2>
              <button className="text-primary/60 hover:text-primary transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500 text-sm font-medium">{displaySubTitle}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={avatarUploading || profileSaving}
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                {avatarUploading ? '上传中...' : avatarDraft ? '重新上传头像' : '上传头像'}
              </button>
              <button
                type="button"
                disabled={profileLoading || profileSaving || avatarUploading || !hasPendingAvatarChange}
                onClick={() =>
                  void onSaveProfile({
                    bio: bioDraft,
                    avatarUrl: avatarDraft,
                    wechatId: wechatIdDraft,
                    wechatQrUrl: wechatQrDraft,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {profileSaving ? '保存中...' : '保存头像'}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              上传后会同步到 C 端专属顾问页面。
            </p>
          </div>
        </div>

        {/* Bio Section */}
        <div className="px-6 mb-8">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-slate-700">个人简介</span>
              <span className="text-xs text-slate-400">{bioDraft.length}/200</span>
            </div>
            <textarea 
              value={bioDraft}
              onChange={(event) => setBioDraft(event.target.value.slice(0, 200))}
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm text-slate-600 resize-none placeholder:text-slate-400 outline-none" 
              maxLength={200} 
              placeholder="简单介绍一下你自己吧..." 
              rows={3}
            />
            {profileError ? <p className="mt-2 text-xs text-rose-500">{profileError}</p> : null}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {profileLoading ? '正在加载简介...' : '这段简介会同步展示到 C 端客户看到的顾问详情页。'}
              </p>
              <button
                type="button"
                disabled={profileLoading || profileSaving || avatarUploading || wechatQrUploading || !hasPendingProfileChange}
                onClick={() => onSaveProfile({ bio: bioDraft, avatarUrl: avatarDraft, wechatId: wechatIdDraft, wechatQrUrl: wechatQrDraft })}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {profileSaving ? '保存中...' : '保存资料'}
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 mb-8">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-slate-700">微信号</span>
              <span className="text-xs text-slate-400">C端扫码后可搜索添加</span>
            </div>
            <input
              value={wechatIdDraft}
              onChange={(event) => setWechatIdDraft(event.target.value.trim())}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              placeholder="填写顾问微信号"
            />
            <p className="mt-2 text-xs leading-5 text-slate-400">
              客户端会展示微信号，可复制或配合二维码扫码添加。
            </p>
          </div>
        </div>

        <div className="px-6 mb-8">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-slate-700">微信二维码</span>
              <span className="text-xs text-slate-400">上传后自动存入图片库</span>
            </div>
            <input
              ref={qrFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleWechatQrPick(event.target.files?.[0] || null)}
            />
            <div className="rounded-2xl border border-dashed border-primary/20 bg-white p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {wechatQrDraft ? (
                    <img src={wechatQrDraft} alt="微信二维码预览" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    {wechatQrDraft ? '已上传微信二维码' : '上传顾问微信二维码图片'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    建议上传清晰的方形二维码图片。上传后会存入系统图片库，并自动生成可展示链接。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => qrFileInputRef.current?.click()}
                      disabled={wechatQrUploading}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {wechatQrUploading ? '上传中...' : wechatQrDraft ? '重新上传' : '上传二维码'}
                    </button>
                    {wechatQrDraft ? (
                      <button
                        type="button"
                        onClick={() => setWechatQrDraft('')}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500"
                      >
                        清空图片
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              C端点击微信联系时会弹出二维码卡片，客户可长按保存或截图后去微信扫码添加。
            </p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {profileSaving && hasPendingWechatChange ? '正在保存微信联系方式...' : '上传完成后点击保存微信，才会同步到C端。'}
              </p>
              <button
                type="button"
                disabled={profileLoading || profileSaving || avatarUploading || wechatQrUploading || !hasPendingWechatChange}
                onClick={() => void onSaveProfile({ bio: bioDraft, avatarUrl: avatarDraft, wechatId: wechatIdDraft, wechatQrUrl: wechatQrDraft })}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {profileSaving ? '保存中...' : '保存微信'}
              </button>
            </div>
          </div>
        </div>

        {/* Business Card Entry */}
        <div className="px-6 mb-8">
          <button className="w-full flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all group">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Contact2 className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-800">电子名片</p>
                <p className="text-xs text-primary/70">快速分享您的职业信息</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Settings List */}
        <div className="px-6 space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">核心设置</div>
          
          <button className="w-full flex items-center justify-between py-4 border-b border-slate-50 hover:px-2 transition-all">
            <div className="flex items-center gap-4">
              <Lock className="w-5 h-5 text-slate-400" />
              <span className="text-[15px] font-medium text-slate-700">账号安全</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          
          <button className="w-full flex items-center justify-between py-4 border-b border-slate-50 hover:px-2 transition-all">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-5 h-5 text-slate-400" />
              <span className="text-[15px] font-medium text-slate-700">隐私设置</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          
          <button className="w-full flex items-center justify-between py-4 border-b border-slate-50 hover:px-2 transition-all">
            <div className="flex items-center gap-4">
              <HelpCircle className="w-5 h-5 text-slate-400" />
              <span className="text-[15px] font-medium text-slate-700">帮助与反馈</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          
          <button className="w-full flex items-center justify-between py-4 border-b border-slate-50 hover:px-2 transition-all">
            <div className="flex items-center gap-4">
              <Info className="w-5 h-5 text-slate-400" />
              <span className="text-[15px] font-medium text-slate-700">关于我们</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        {/* Logout Button */}
        <div className="px-6 mt-10">
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyEntryView({
  onBack,
  customers,
  selectedCustomer,
  initialPolicy = null,
  onSaved,
}: {
  onBack: () => void;
  customers: typeof CUSTOMERS;
  selectedCustomer: (typeof CUSTOMERS)[number] | null;
  initialPolicy?: InsurancePolicy | null;
  onSaved?: (policy: InsurancePolicy) => void | Promise<void>;
}) {
  const formatCustomerOptionLabel = (customer: (typeof CUSTOMERS)[number]) =>
    customer.mobile ? `${customer.name} · ${customer.mobile}` : String(customer.name || '');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const editing = Boolean(initialPolicy?.id);
  const buildInitialFormData = () => ({
    customerId: selectedCustomer ? String(selectedCustomer.id) : String(initialPolicy?.customerId || ''),
    company: initialPolicy?.company || '',
    name: initialPolicy?.name || '',
    applicant: initialPolicy?.applicant || '',
    applicantRelation: initialPolicy?.applicantRelation || '',
    insured: initialPolicy?.insured || '',
    insuredRelation: initialPolicy?.insuredRelation || '',
    date: initialPolicy?.periodStart || '',
    paymentPeriod: initialPolicy?.paymentPeriod || '',
    coveragePeriod: initialPolicy?.coveragePeriod || '',
    amount: initialPolicy?.amount ? String(initialPolicy.amount) : '',
    firstPremium: initialPolicy?.annualPremium ? String(initialPolicy.annualPremium) : '',
  });
  const [formData, setFormData] = useState({
    ...buildInitialFormData(),
  });
  const [customerKeyword, setCustomerKeyword] = useState(selectedCustomer ? formatCustomerOptionLabel(selectedCustomer) : '');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [recognizedOcrText, setRecognizedOcrText] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof bApi.analyzePolicy>>['analysis'] | null>(initialPolicy?.analysis || null);
  const companyOptions = React.useMemo(() => buildPolicyCompanyOptions(formData.company), [formData.company, historyTick]);
  const nameOptions = React.useMemo(() => buildPolicyNameOptions(formData.name), [formData.name, historyTick]);
  const relationOptions = React.useMemo(
    () => buildPolicyRelationOptions(formData.applicantRelation || formData.insuredRelation),
    [formData.applicantRelation, formData.insuredRelation, historyTick],
  );
  const paymentPeriodOptions = React.useMemo(() => buildPolicyPaymentPeriodOptions(formData.paymentPeriod), [formData.paymentPeriod, historyTick]);
  const coveragePeriodOptions = React.useMemo(() => buildPolicyCoveragePeriodOptions(formData.coveragePeriod), [formData.coveragePeriod, historyTick]);
  const customerOptions = React.useMemo(() => {
    const unique = new Map<number, (typeof CUSTOMERS)[number]>();
    for (const item of customers) {
      const id = Number(item.id || 0);
      if (id > 0 && !unique.has(id)) unique.set(id, item);
    }
    if (selectedCustomer && Number(selectedCustomer.id || 0) > 0 && !unique.has(Number(selectedCustomer.id))) {
      unique.set(Number(selectedCustomer.id), selectedCustomer);
    }
    return Array.from(unique.values());
  }, [customers, selectedCustomer]);
  const customerOptionLabels = React.useMemo(() => customerOptions.map((option) => formatCustomerOptionLabel(option)), [customerOptions]);
  const resolveCustomerSelection = (input: string) => {
    const query = String(input || '').trim();
    if (!query) return null;
    const exactLabel = customerOptions.find((option) => formatCustomerOptionLabel(option) === query);
    if (exactLabel) return exactLabel;
    const exactNameMatches = customerOptions.filter((option) => String(option.name || '').trim() === query);
    if (exactNameMatches.length === 1) return exactNameMatches[0];
    const exactMobile = customerOptions.find((option) => String(option.mobile || '').trim() === query);
    if (exactMobile) return exactMobile;
    return null;
  };
  const amountError = validatePositiveNumberInput(formData.amount);
  const firstPremiumError = validatePositiveNumberInput(formData.firstPremium);
  const paymentPeriodError = formData.paymentPeriod && !isValidPolicyPaymentPeriod(formData.paymentPeriod) ? '请输入趸交或如 10年交' : '';
  const coveragePeriodError = formData.coveragePeriod && !isValidPolicyCoveragePeriod(formData.coveragePeriod) ? '请输入终身、30年或至70岁' : '';
  const customerSelectionError = customerKeyword && !Number(formData.customerId || 0) ? '请选择匹配到的已有客户' : '';
  const canSubmit = Boolean(
    Number(formData.customerId || 0) &&
      formData.company &&
      formData.name &&
      formData.applicant &&
      formData.applicantRelation &&
      formData.insured &&
      formData.insuredRelation &&
      formData.date &&
      formData.paymentPeriod &&
      formData.coveragePeriod &&
      formData.amount &&
      formData.firstPremium &&
      !customerSelectionError &&
      !amountError &&
      !firstPremiumError &&
      !paymentPeriodError &&
      !coveragePeriodError,
  );

  const clearAnalysisIfNeeded = (key: keyof typeof formData, nextValue: string) => {
    if (!analysis) return;
    if (key !== 'company' && key !== 'name' && key !== 'date') return;
    const currentValue = String(formData[key] || '');
    if (currentValue === nextValue) return;
    setAnalysis(null);
    setAnalysisError('');
  };

  const handleFieldChange = (key: keyof typeof formData, value: string) => {
    clearAnalysisIfNeeded(key, value);
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCustomerInputChange = (value: string) => {
    setCustomerKeyword(value);
    const matched = resolveCustomerSelection(value);
    handleFieldChange('customerId', matched ? String(matched.id) : '');
  };

  const handleCustomerBlur = () => {
    const matched = resolveCustomerSelection(customerKeyword);
    if (!matched) return;
    setCustomerKeyword(formatCustomerOptionLabel(matched));
    handleFieldChange('customerId', String(matched.id));
  };

  const handleScanClick = () => {
    if (scanning) return;
    fileInputRef.current?.click();
  };

  const handleScanFile = async (file: File | null) => {
    if (!file || scanning) return;
    const convert = () =>
      new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            name: file.name,
            type: file.type || 'application/octet-stream',
            dataUrl: String(reader.result || ''),
          });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    try {
      setScanning(true);
      setSelectedFileName(file.name);
      const uploadItem = await convert();
      const resp = await bApi.scanPolicy({ uploadItem });
      setRecognizedOcrText(String(resp.ocrText || ''));
      setAnalysis(null);
      setAnalysisError('');
      setFormData({
        customerId: formData.customerId,
        company: normalizePolicyCompany(String(resp.data.company || '')),
        name: String(resp.data.name || ''),
        applicant: String(resp.data.applicant || ''),
        applicantRelation: '',
        insured: String(resp.data.insured || ''),
        insuredRelation: '',
        date: String(resp.data.date || ''),
        paymentPeriod: normalizePolicyPaymentPeriod(String(resp.data.paymentPeriod || '')),
        coveragePeriod: normalizePolicyCoveragePeriod(String(resp.data.coveragePeriod || '')),
        amount: String(resp.data.amount || ''),
        firstPremium: String(resp.data.firstPremium || ''),
      });
      alert('识别完成，已自动填充保单信息');
    } catch (e: any) {
      setSelectedFileName('');
      showApiError(e, '识别失败，请手动填写');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAnalyzePolicy = async () => {
    if (analysisLoading) return;
    if (!formData.company || !formData.name) {
      alert('请先完成保单识别或填写保险公司和保险名称');
      return;
    }
    try {
      setAnalysisLoading(true);
      setAnalysisError('');
      const resp = await bApi.analyzePolicy({
        policy: {
          company: formData.company,
          name: formData.name,
          date: formData.date,
          amount: formData.amount ? Number(formData.amount) : undefined,
          firstPremium: formData.firstPremium ? Number(formData.firstPremium) : undefined,
        },
      });
      setAnalysis(resp.analysis);
    } catch (e: any) {
      setAnalysisError(resolveApiErrorMessage(e, '保单责任分析失败，请稍后重试'));
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!canSubmit) {
      alert('请先填写完整保单信息，并确认归属客户、关系、缴费/保障期间和金额格式正确');
      return;
    }
    try {
      setSaving(true);
      const normalizedCompany = normalizePolicyCompany(formData.company);
      const normalizedPaymentPeriod = normalizePolicyPaymentPeriod(formData.paymentPeriod);
      const normalizedCoveragePeriod = normalizePolicyCoveragePeriod(formData.coveragePeriod);
      const payload = {
        customerId: Number(formData.customerId),
        company: normalizedCompany,
        name: formData.name.trim(),
        applicant: formData.applicant.trim(),
        applicantRelation: formData.applicantRelation.trim(),
        insured: formData.insured.trim(),
        insuredRelation: formData.insuredRelation.trim(),
        date: formData.date,
        paymentPeriod: normalizedPaymentPeriod,
        coveragePeriod: normalizedCoveragePeriod,
        amount: Number(formData.amount),
        firstPremium: Number(formData.firstPremium),
        analysis,
      };
      const resp = editing && initialPolicy
        ? await bApi.updatePolicy(Number(initialPolicy.id), payload)
        : await bApi.createPolicy(payload);
      rememberPolicyFormValues({
        company: normalizedCompany,
        name: formData.name,
        applicantRelation: formData.applicantRelation,
        insuredRelation: formData.insuredRelation,
        paymentPeriod: normalizedPaymentPeriod,
        coveragePeriod: normalizedCoveragePeriod,
      });
      setHistoryTick((prev) => prev + 1);
      if (onSaved) {
        await onSaved(resp.policy);
      }
      alert(editing ? '保单修改成功' : '保单提交成功');
      onBack();
    } catch (e: any) {
      showApiError(e, editing ? '修改失败，请稍后重试' : '提交失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-50 absolute inset-0">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{editing ? '修改保单' : '录入保单'}</h1>
        <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors">
          <HelpOutline className="w-6 h-6 text-slate-700" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        {/* OCR Scanning Section */}
        <section className="p-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900">拍照自动识别</h2>
            <p className="text-slate-500 text-sm mt-1">系统将自动提取保单关键信息，省时省力</p>
          </div>
          <div className="relative group cursor-pointer" onClick={handleScanClick}>
            <div className="w-full aspect-[16/9] rounded-xl border-2 border-dashed border-primary/40 bg-white flex flex-col items-center justify-center gap-3 overflow-hidden transition-all hover:border-primary active:scale-[0.98]">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
                <Camera className="w-10 h-10" />
              </div>
              <span className="text-lg font-bold text-primary">{scanning ? '正在识别中...' : '点击拍照上传'}</span>
              <p className="text-sm text-slate-400">{selectedFileName ? `已选择：${selectedFileName}` : '支持纸质保单拍照或相册图片'}</p>
              
              {/* Decorative Corners */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleScanFile(e.target.files?.[0] || null)}
          />
          {recognizedOcrText ? (
            <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">查看原始 OCR 文本</summary>
              <pre className="mt-3 whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{recognizedOcrText}</pre>
            </details>
          ) : null}
        </section>

        {/* Divider */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-slate-400 text-sm font-medium">或 手动输入详情</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>
        </div>

        {/* Manual Form Section */}
        <form className="p-4 space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-base font-bold text-slate-700">归属客户</span>
                <SuggestionInput
                  value={customerKeyword}
                  onChange={handleCustomerInputChange}
                  onBlur={handleCustomerBlur}
                  options={customerOptionLabels}
                  placeholder="输入客户姓名或手机号搜索"
                  className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                  noMatchText="未匹配到现有客户，请继续输入更完整信息后选择"
                />
                {customerSelectionError ? <span className="text-sm text-rose-500">{customerSelectionError}</span> : null}
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-base font-bold text-slate-700">保险公司</span>
                <SuggestionInput
                  value={formData.company}
                  onChange={(value) => handleFieldChange('company', value)}
                  onBlur={() => handleFieldChange('company', normalizePolicyCompany(formData.company))}
                  options={companyOptions}
                  placeholder="输入保险公司，可模糊匹配"
                  className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-base font-bold text-slate-700">保险名称</span>
                <SuggestionInput
                  value={formData.name}
                  onChange={(value) => handleFieldChange('name', value)}
                  options={nameOptions}
                  className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                  placeholder="输入保单上的险种全称"
                />
              </label>
            </div>
          </div>

          {/* Person Info */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-base font-bold text-slate-700">投保人</span>
              <input
                value={formData.applicant}
                onChange={(e) => handleFieldChange('applicant', e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                placeholder="姓名"
                type="text"
              />
              <span className="text-sm font-semibold text-slate-500">投保人与录入人的关系</span>
              <SuggestionInput
                value={formData.applicantRelation}
                onChange={(value) => handleFieldChange('applicantRelation', value)}
                options={relationOptions}
                placeholder="输入关系，可直接新增"
                className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-base outline-none"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-base font-bold text-slate-700">被保险人</span>
              <input
                value={formData.insured}
                onChange={(e) => handleFieldChange('insured', e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                placeholder="姓名"
                type="text"
              />
              <span className="text-sm font-semibold text-slate-500">被保险人与录入人的关系</span>
              <SuggestionInput
                value={formData.insuredRelation}
                onChange={(value) => handleFieldChange('insuredRelation', value)}
                options={relationOptions}
                placeholder="输入关系，可直接新增"
                className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-base outline-none"
              />
            </label>
          </div>

          {/* Temporal Info */}
          <div className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-base font-bold text-slate-700">投保时间</span>
              <div className="relative">
                <input
                  value={formData.date}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                  type="date"
                />
              </div>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-base font-bold text-slate-700">缴费期间</span>
                <SuggestionInput
                  value={formData.paymentPeriod}
                  onChange={(value) => handleFieldChange('paymentPeriod', value)}
                  onBlur={() => handleFieldChange('paymentPeriod', normalizePolicyPaymentPeriod(formData.paymentPeriod))}
                  options={paymentPeriodOptions}
                  placeholder="如 10年交 或 趸交"
                  className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                />
                {paymentPeriodError ? <span className="text-sm text-rose-500">{paymentPeriodError}</span> : null}
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-base font-bold text-slate-700">保障期间</span>
                <SuggestionInput
                  value={formData.coveragePeriod}
                  onChange={(value) => handleFieldChange('coveragePeriod', value)}
                  onBlur={() => handleFieldChange('coveragePeriod', normalizePolicyCoveragePeriod(formData.coveragePeriod))}
                  options={coveragePeriodOptions}
                  placeholder="如 终身、30年、至70岁"
                  className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg outline-none"
                />
                {coveragePeriodError ? <span className="text-sm text-rose-500">{coveragePeriodError}</span> : null}
              </label>
            </div>
          </div>

          {/* Financial Info */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-base font-bold text-slate-700">保额 (元)</span>
              <input
                value={formData.amount}
                onChange={(e) => handleFieldChange('amount', sanitizePositiveNumberInput(e.target.value))}
                className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg font-semibold outline-none"
                placeholder="0.00"
                type="text"
                inputMode="decimal"
              />
              {amountError ? <span className="text-sm text-rose-500">{amountError}</span> : null}
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-base font-bold text-slate-700">首期保费 (元)</span>
              <input
                value={formData.firstPremium}
                onChange={(e) => handleFieldChange('firstPremium', sanitizePositiveNumberInput(e.target.value))}
                className="w-full rounded-xl border-slate-200 bg-white focus:border-primary focus:ring-primary px-4 h-14 text-lg font-semibold outline-none"
                placeholder="0.00"
                type="text"
                inputMode="decimal"
              />
              {firstPremiumError ? <span className="text-sm text-rose-500">{firstPremiumError}</span> : null}
            </label>
          </div>

          <section className="rounded-2xl border border-blue-100 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">保单责任分析</h3>
                  <p className="text-sm text-slate-500 mt-1">只输出产品概述、核心特点、责任表格、免责条款和选购建议。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleAnalyzePolicy()}
                disabled={analysisLoading}
                className="shrink-0 px-4 h-10 rounded-xl bg-blue-500 text-white text-sm font-bold disabled:opacity-60"
              >
                {analysisLoading ? '分析中...' : analysis ? '重新分析' : '开始分析'}
              </button>
            </div>

            {analysisError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{analysisError}</div>
            ) : null}

            {analysis ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-slate-900">产品概述</h4>
                    <span className="text-[11px] text-slate-400">{analysis.cached ? '缓存结果' : '实时分析'}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-6 mt-2">{analysis.productOverview}</p>
                </div>

                <div className="rounded-xl border border-slate-100 px-4 py-3">
                  <h4 className="text-sm font-bold text-slate-900">核心特点</h4>
                  <p className="text-sm text-slate-700 mt-2 leading-6">{analysis.coreFeature}</p>
                </div>

                {analysis.coverageTable.length ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">核心保障一览</h4>
                    <div className="overflow-hidden rounded-xl border border-blue-100 bg-white">
                      <table className="w-full table-fixed text-left">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-3 py-2 text-[11px] font-bold text-slate-600">保障类型</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-slate-600">保障情形</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-slate-600">赔付金额</th>
                            <th className="px-3 py-2 text-[11px] font-bold text-slate-600">说明</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analysis.coverageTable.map((item, idx) => (
                            <tr key={`${item.coverageType}-${idx}`} className="align-top">
                              <td className="px-3 py-3 text-xs font-semibold text-slate-900">{item.coverageType}</td>
                              <td className="px-3 py-3 text-xs text-slate-700 leading-5">{item.scenario}</td>
                              <td className="px-3 py-3 text-xs text-slate-700 leading-5">{item.payout}</td>
                              <td className="px-3 py-3 text-xs text-slate-600 leading-5">{item.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {analysis.exclusions.length ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900">保前必看免责条款</h4>
                    <div className="space-y-2">
                      {analysis.exclusions.map((item, idx) => (
                        <div key={`${item}-${idx}`} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <h4 className="text-sm font-bold text-slate-900">选购建议</h4>
                  <p className="text-sm text-blue-700 mt-2 leading-6 whitespace-pre-line">{analysis.purchaseAdvice}</p>
                </div>

                <p className="text-xs text-slate-400 leading-5">{analysis.disclaimer}</p>
              </div>
            ) : null}
          </section>
        </form>
      </main>

      {/* Fixed Bottom Action Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <div className="p-4 max-w-md mx-auto">
          <p className="mb-3 text-center text-xs text-slate-500">填写完成后请点击下方按钮保存保单</p>
          <div className="flex gap-3">
            <button
              onClick={onBack}
              type="button"
              className="h-14 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition-transform active:scale-95"
            >
              取消
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={saving || !canSubmit}
              className="h-14 flex-[1.4] bg-primary hover:bg-primary/90 text-white font-bold text-base rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
            >
              <CheckCircle2 className="w-6 h-6" />
              {saving ? '保存中...' : '保存保单'}
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3 px-4 italic">提交即代表您同意《保单托管服务协议》及《隐私条款》</p>
        </div>
      </div>
    </div>
  );
}

function ScanVerificationView({
  onBack,
  orders,
  customers,
  onWriteoff,
  writeoffSubmittingId = 0,
}: {
  onBack: () => void;
  orders: BOrder[];
  customers: typeof CUSTOMERS;
  onWriteoff: (order: BOrder, overrideToken?: string) => Promise<void>;
  writeoffSubmittingId?: number;
}) {
  const [keyword, setKeyword] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [filter, setFilter] = useState<'all' | 'activity' | 'product'>('all');

  const customerMap = useMemo(() => new Map(customers.map((item) => [Number(item.id), item])), [customers]);
  const pendingOrders = useMemo(() => orders.filter((item) => canWriteoffOrder(item)), [orders]);
  const summary = useMemo(
    () => ({
      total: pendingOrders.length,
      activity: pendingOrders.filter((item) => String(item.orderType || '') === 'activity').length,
      product: pendingOrders.filter((item) => String(item.orderType || 'product') !== 'activity').length,
    }),
    [pendingOrders],
  );

  const filteredOrders = useMemo(() => {
    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    return pendingOrders.filter((order) => {
      const isActivity = String(order.orderType || '') === 'activity';
      if (filter === 'activity' && !isActivity) return false;
      if (filter === 'product' && isActivity) return false;
      if (!normalizedKeyword) return true;
      const customer = customerMap.get(Number(order.customerId || 0));
      return [
        order.productName,
        order.orderNo,
        order.writeoffToken,
        customer?.name,
        customer?.mobile,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
    });
  }, [customerMap, filter, keyword, pendingOrders]);

  const submitManualWriteoff = async () => {
    const normalizedCode = String(manualCode || '').trim();
    if (!normalizedCode) {
      alert('请输入核销码');
      return;
    }
    const target = pendingOrders.find((order) => String(order.writeoffToken || '').trim() === normalizedCode);
    if (!target) {
      alert('未找到对应待核销记录');
      return;
    }
    await onWriteoff(target, normalizedCode);
    setManualCode('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-50 absolute inset-0">
      <header className="flex items-center p-4 border-b border-slate-200 sticky top-0 bg-white/90 backdrop-blur-md z-10 shrink-0">
        <button onClick={onBack} className="flex w-10 h-10 items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10 text-slate-900">核销中心</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        <section className="rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-primary p-5 text-white shadow-xl shadow-primary/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Writeoff Center</p>
              <h2 className="mt-2 text-2xl font-black">待核销 {summary.total} 笔</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">支持活动参与核销和积分商品兑换核销，输入核销码或直接从列表处理。</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
              <QrCode className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur">
              <p className="text-[11px] text-white/65">全部</p>
              <p className="mt-1 text-xl font-black">{summary.total}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur">
              <p className="text-[11px] text-white/65">活动</p>
              <p className="mt-1 text-xl font-black">{summary.activity}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur">
              <p className="text-[11px] text-white/65">商品</p>
              <p className="mt-1 text-xl font-black">{summary.product}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <Keyboard className="h-5 w-5 text-slate-400" />
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={ACTION_COPY.manualInputWriteoffCode}
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => void submitManualWriteoff()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              核销
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索客户、活动、商品或核销码"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="mt-4 flex gap-2">
            {[
              ['all', '全部'],
              ['activity', '活动'],
              ['product', '商品'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as 'all' | 'activity' | 'product')}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  filter === key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          {filteredOrders.map((order) => {
            const customer = customerMap.get(Number(order.customerId || 0));
            const isActivity = String(order.orderType || '') === 'activity';
            const busy = writeoffSubmittingId === Number(order.id || 0);
            return (
              <div key={order.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex gap-3">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isActivity ? 'bg-blue-50 text-primary' : 'bg-orange-50 text-orange-500'}`}>
                    {isActivity ? <CalendarCheck className="h-7 w-7" /> : <Gift className="h-7 w-7" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-slate-900">{order.productName || '未命名订单'}</p>
                        <p className="mt-1 text-xs text-slate-500">{customer?.name || `客户#${order.customerId}`}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${isActivity ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {isActivity ? '活动' : '商品'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <p className="truncate">订单号：{order.orderNo || `ORD-${order.id}`}</p>
                      <p className="truncate text-right">{toLocalTime(order.createdAt)}</p>
                      <p className="col-span-2 truncate">核销码：{String(order.writeoffToken || '--')}</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onWriteoff(order)}
                  disabled={busy}
                  className="mt-4 h-11 w-full rounded-2xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? '核销中...' : `立即核销${isActivity ? '活动' : '商品'}`}
                </button>
              </div>
            );
          })}

          {filteredOrders.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
              当前没有匹配的待核销记录
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function LoginView({ onLogin }: { onLogin: (payload: { account: string; password: string }) => Promise<void> }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light z-50 absolute inset-0">
      <div className="flex items-center p-4 pb-2 justify-between">
        <div className="w-10">
          <ArrowLeft className="w-6 h-6 text-slate-900 cursor-pointer" />
        </div>
        <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center">保险经纪人办公中心</h2>
        <div className="w-10"></div>
      </div>
      
      <div className="flex flex-col px-6 pt-12 pb-8">
        <h1 className="text-slate-900 tracking-tight text-3xl font-bold leading-tight">欢迎登录</h1>
        <p className="text-slate-500 mt-2 text-sm">专业、高效的经纪人移动展业平台</p>
      </div>
      
      <div className="flex flex-col gap-6 px-6 py-4 max-w-md mx-auto w-full">
        <div className="flex flex-col w-full">
          <p className="text-slate-800 text-sm font-semibold leading-normal pb-2">员工账号</p>
          <div className="relative flex items-center">
            <Smartphone className="absolute left-4 text-slate-400 w-5 h-5" />
            <input 
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="flex w-full rounded-xl text-slate-900 border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 pl-12 pr-4 text-base font-normal placeholder:text-slate-400 outline-none" 
              placeholder="请输入员工账号(邮箱/手机号)" 
              type="text"
            />
          </div>
        </div>
        
        <div className="flex flex-col w-full">
          <p className="text-slate-800 text-sm font-semibold leading-normal pb-2">密码</p>
          <div className="flex w-full items-stretch gap-2">
            <div className="relative flex-1">
              <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex w-full rounded-xl text-slate-900 border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 pl-12 pr-4 text-base font-normal placeholder:text-slate-400 outline-none" 
                placeholder="请输入密码" 
                type="password"
              />
            </div>
          </div>
        </div>
        {error ? <p className="text-xs text-rose-500 -mt-3">{error}</p> : null}
        
        <div className="flex flex-col pt-4">
          <button 
            onClick={async () => {
              if (submitting) return;
              try {
                setError('');
                setSubmitting(true);
                await onLogin({ account: account.trim(), password: password.trim() });
              } catch (err: any) {
                setError(err?.message || ERROR_COPY.loginFailed);
              } finally {
                setSubmitting(false);
              }
            }}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl h-14 px-5 bg-primary text-white text-lg font-bold shadow-lg shadow-primary/30 active:scale-[0.98] transition-all"
          >
            {submitting ? '登录中...' : '登 录'}
          </button>
        </div>
        
        <div className="flex items-center justify-between text-sm mt-2">
          <button className="text-slate-500 hover:text-primary transition-colors">员工账号登录</button>
          <button className="text-slate-500 hover:text-primary transition-colors">{NOTICE_COPY.createEmployeeInPFirst}</button>
        </div>
      </div>
      
      <div className="mt-auto flex flex-col items-center px-8 py-8 w-full">
        <label className="flex items-start gap-2 cursor-pointer">
          <input 
            defaultChecked 
            className="mt-1 rounded border-slate-300 text-primary focus:ring-primary" 
            type="checkbox"
          />
          <span className="text-xs text-slate-500 leading-relaxed text-center">
            我已阅读并同意
            <button className="text-primary font-medium">《用户服务协议》</button>
            、
            <button className="text-primary font-medium">《隐私政策》</button>
            以及
            <button className="text-primary font-medium">《保险代理合同》</button>
          </span>
        </label>
        <div className="mt-4 text-[10px] text-slate-400">
          Powered by Insurance WorkCenter v3.4.0
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, isActive, onClick }: { icon: any, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20' : ''}`} />
      <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

const B_NAV_ITEMS = [
  { id: 'home', label: '工作台', icon: Briefcase },
  { id: 'customers', label: '客户库', icon: Users },
  { id: 'tools', label: '获客工具', icon: Wrench },
  { id: 'analytics', label: '决策', icon: LineChart },
  { id: 'profile', label: '我的', icon: User },
] as const;

function NoPermissionPanel({
  title = '当前账号未配置页面权限',
  description = '请联系平台管理员调整菜单权限后重新登录。',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<BLoginSession | null>(() => bApi.getSession());
  const [advisorProfile, setAdvisorProfile] = useState<BAdvisorProfile | null>(null);
  const [advisorProfileLoading, setAdvisorProfileLoading] = useState(false);
  const [advisorProfileSaving, setAdvisorProfileSaving] = useState(false);
  const [advisorProfileError, setAdvisorProfileError] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [selectedShareEffect, setSelectedShareEffect] = useState<SelectedShareEffect | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<(typeof CUSTOMERS)[number] | null>(null);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [showPolicyEntry, setShowPolicyEntry] = useState(false);
  const [showScanVerification, setShowScanVerification] = useState(false);
  const [showCustomerOrders, setShowCustomerOrders] = useState(false);
  const [homeRecentOrderDetail, setHomeRecentOrderDetail] = useState<BOrder | null>(null);
  const [homeRecentActivityOrder, setHomeRecentActivityOrder] = useState<BOrder | null>(null);
  const [homeRecentActivityDetail, setHomeRecentActivityDetail] = useState<BHomeActivityDetailItem | null>(null);
  const [homeRecentActivitySignups, setHomeRecentActivitySignups] = useState<BShareEffectParticipantRow[]>([]);
  const [homeRecentActivityLoading, setHomeRecentActivityLoading] = useState(false);
  const [homeRecentActivityError, setHomeRecentActivityError] = useState('');
  const [customers, setCustomers] = useState<typeof CUSTOMERS>([]);
  const [orders, setOrders] = useState<BOrder[]>([]);
  const [writeoffSubmittingId, setWriteoffSubmittingId] = useState(0);
  const [dashboardCustomerActivityFeed, setDashboardCustomerActivityFeed] = useState<BDashboardCustomerActivityFeedRow[]>([]);
  const [dashboardCustomerActivityFeedLoading, setDashboardCustomerActivityFeedLoading] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState<BDashboardMetricsResponse | null>(null);
  const [dashboardMetricsLoading, setDashboardMetricsLoading] = useState(false);
  const [dashboardCustomerActivityFeedOpen, setDashboardCustomerActivityFeedOpen] = useState(false);
  const [dashboardCustomerActivityFeedData, setDashboardCustomerActivityFeedData] = useState<BDashboardCustomerActivityFeedResponse | null>(null);
  const [dashboardCustomerActivityFeedModalLoading, setDashboardCustomerActivityFeedModalLoading] = useState(false);
  const [dashboardCustomerActivityFeedError, setDashboardCustomerActivityFeedError] = useState('');
  const [dashboardParticipantsOpen, setDashboardParticipantsOpen] = useState(false);
  const [dashboardParticipantsData, setDashboardParticipantsData] = useState<BDashboardCustomerListResponse | null>(null);
  const [dashboardParticipantsLoading, setDashboardParticipantsLoading] = useState(false);
  const [dashboardParticipantsError, setDashboardParticipantsError] = useState('');
  const [toolParticipantsOpen, setToolParticipantsOpen] = useState(false);
  const [toolParticipantsData, setToolParticipantsData] = useState<BShareEffectParticipantsResponse | null>(null);
  const [toolParticipantsLoading, setToolParticipantsLoading] = useState(false);
  const [toolParticipantsError, setToolParticipantsError] = useState('');
  const [toolParticipantsMetric, setToolParticipantsMetric] = useState<BShareParticipantMetricKind>('signup');
  const [toolParticipantsTitle, setToolParticipantsTitle] = useState('');
  const [toolParticipantsShareType, setToolParticipantsShareType] = useState<BEffectShareType>('activity');
  const [liveError, setLiveError] = useState('');
  const [pagePermissions, setPagePermissions] = useState<BPagePermissionResponse | null>(null);
  const [pagePermissionLoading, setPagePermissionLoading] = useState(false);
  const [pagePermissionError, setPagePermissionError] = useState('');
  const permissionAccess = buildBPermissionAccess(pagePermissions);
  const permissionsResolved = !session || Boolean(pagePermissions) || Boolean(pagePermissionError);
  const visibleNavIds = permissionsResolved ? getVisibleBNavIds(permissionAccess) : B_NAV_ORDER;
  const visibleNavItems = B_NAV_ITEMS.filter((item) => visibleNavIds.includes(item.id));
  const handleLogout = () => {
    bApi.clearSession();
    setSession(null);
    setAdvisorProfile(null);
    setAdvisorProfileLoading(false);
    setAdvisorProfileSaving(false);
    setAdvisorProfileError('');
    setActiveTab('home');
    setSelectedCustomer(null);
    setSelectedShareEffect(null);
    setShowTagEditor(false);
    setShowPolicyEntry(false);
    setShowScanVerification(false);
    setShowCustomerOrders(false);
    setHomeRecentOrderDetail(null);
    setHomeRecentActivityOrder(null);
    setHomeRecentActivityDetail(null);
    setHomeRecentActivitySignups([]);
    setHomeRecentActivityLoading(false);
    setHomeRecentActivityError('');
    setWriteoffSubmittingId(0);
    setDashboardCustomerActivityFeed([]);
    setDashboardCustomerActivityFeedLoading(false);
    setDashboardCustomerActivityFeedOpen(false);
    setDashboardCustomerActivityFeedData(null);
    setDashboardCustomerActivityFeedModalLoading(false);
    setDashboardCustomerActivityFeedError('');
    setDashboardParticipantsOpen(false);
    setDashboardParticipantsData(null);
    setToolParticipantsOpen(false);
    setToolParticipantsData(null);
    setLiveError('');
  };
  const openParticipantCustomer = (row: {
    userId: number;
    name: string;
    mobile: string;
    shareType: BEffectShareType;
    targetTitle?: string;
    occurredAt?: string;
    tagLabel?: string;
    summaryPrefix?: string;
  }) => {
    const customerId = Number(row.userId || 0);
    if (customerId <= 0) return;
    const effectCopy = effectCopyByShareType(row.shareType);
    const participantTag = String(row.tagLabel || effectCopy.participantTag || '客户');
    const participantSummaryPrefix = String(row.summaryPrefix || effectCopy.participantSummaryPrefix || '来源：');
    const customerShell = {
      id: customerId,
      name: String(row.name || `客户#${customerId}`),
      mobile: String(row.mobile || ''),
      avatar: '',
      intent: 0,
      tags: [{ text: participantTag, color: 'text-primary bg-primary/10' }],
      activity: row.targetTitle ? `${participantSummaryPrefix}${row.targetTitle}` : `来自${effectCopy.tabLabel}`,
    } as (typeof CUSTOMERS)[number];

    setCustomers((prev) => {
      const next = [...prev];
      const index = next.findIndex((item) => Number(item.id) === customerId);
      if (index >= 0) {
        next[index] = { ...next[index], ...customerShell };
      } else {
        next.unshift(customerShell);
      }
      return next;
    });
    setActiveTab('customers');
    setSelectedCustomer(customerShell);
  };
  const track = (event: string, properties: Record<string, unknown> = {}) => {
    trackEvent({ event, properties }).catch(() => undefined);
  };

  const handleSaveAdvisorProfile = async (payload: { bio: string; avatarUrl?: string; wechatId?: string; wechatQrUrl?: string }) => {
    try {
      setAdvisorProfileSaving(true);
      setAdvisorProfileError('');
      const res = await bApi.updateMyAdvisorProfile(payload);
      setAdvisorProfile(res.advisor || null);
      track('b_profile_bio_saved', {
        length: String(payload.bio || '').length,
        hasAvatarUrl: payload.avatarUrl ? 'true' : 'false',
        hasWechatId: payload.wechatId ? 'true' : 'false',
        hasWechatQrUrl: payload.wechatQrUrl ? 'true' : 'false',
      });
    } catch (err: any) {
      setAdvisorProfileError(String(err?.message || '个人简介保存失败'));
    } finally {
      setAdvisorProfileSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!session) {
      setAdvisorProfile(null);
      setAdvisorProfileLoading(false);
      setAdvisorProfileSaving(false);
      setAdvisorProfileError('');
      return () => {
        mounted = false;
      };
    }

    setAdvisorProfileLoading(true);
    setAdvisorProfileError('');
    bApi
      .myAdvisorProfile()
      .then((res) => {
        if (!mounted) return;
        setAdvisorProfile(res.advisor || null);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setAdvisorProfile(null);
        setAdvisorProfileError(String(err?.message || '个人简介加载失败'));
      })
      .finally(() => {
        if (mounted) setAdvisorProfileLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [session?.actorId, session?.tenantId]);

  const loadHomeRecentActivityDetail = async (order: BOrder) => {
    const shell: BHomeActivityDetailItem = {
      id: Number(order.productId || 0),
      title: String(order.productName || '活动详情'),
      image: '',
      status: '已完成',
      rawStatus: 'completed',
      description: '',
      rewardPoints: Number(order.pointsAmount || 0),
      participants: '0',
      attendees: '0',
      shares: '0',
      orderNo: String(order.orderNo || ''),
      updatedAt: String(order.updatedAt || order.createdAt || ''),
    };

    setHomeRecentActivityOrder(order);
    setHomeRecentActivityDetail(shell);
    setHomeRecentActivitySignups([]);
    setHomeRecentActivityError('');
    setHomeRecentActivityLoading(true);

    try {
      const activityRes = await bApi.activityConfigs();
      const matched = resolveActivityConfigForOrder(activityRes.list || [], order);
      if (!matched) {
        throw new Error('未找到对应活动详情');
      }

      const [shareOverviewRes, signupRes] = await Promise.all([
        bApi.shareOverview(20).catch(() => null),
        bApi.activityParticipants({ targetId: Number(matched.id || 0), metric: 'signup' }),
      ]);

      const targetStat = (shareOverviewRes?.targetStats || []).find(
        (row) => row.shareType === 'activity' && Number(row.targetId || 0) === Number(matched.id || 0),
      );

      setHomeRecentActivityDetail(
        toHomeActivityDetailItem(matched, {
          shares: Number(targetStat?.totalLinks || 0),
          participants: Number(targetStat?.totalParticipants || 0),
          attendees: Number(targetStat?.totalAttendees || 0),
          orderNo: String(order.orderNo || ''),
        }),
      );
      setHomeRecentActivitySignups(signupRes.list || []);
    } catch (err: any) {
      setHomeRecentActivityError(err?.message || '活动详情加载失败');
    } finally {
      setHomeRecentActivityLoading(false);
    }
  };

  const loadCustomerLibraryData = async (
    disposedRef?: { disposed: boolean },
    options?: { includeMetrics?: boolean }
  ) => {
    const isDisposed = () => Boolean(disposedRef?.disposed);
    const includeMetrics = options?.includeMetrics !== false;
    if (!isDisposed() && includeMetrics) setDashboardCustomerActivityFeedLoading(true);
    try {
      const tasks: [Promise<{ list: BCustomer[] }>, Promise<{ list: BOrder[] }>, Promise<BDashboardMetricsResponse | null>, Promise<{ list: BDashboardCustomerActivityFeedRow[] } | null>] = [
        bApi.customers(),
        bApi.orders(),
        includeMetrics ? bApi.dashboardMetrics(7) : Promise.resolve(null),
        includeMetrics ? bApi.dashboardCustomerActivityFeed(30) : Promise.resolve(null),
      ];
      const [customerRes, orderRes, dashboardRes, customerActivityFeedRes] = await Promise.all(tasks);
      if (isDisposed()) return;
      const mapped = customerRes.list.map((row: BCustomer) => ({
        id: row.id,
        name: row.name,
        mobile: row.mobile,
        avatar: '',
        intent: 0,
        tags: [{ text: `团队${row.teamId}`, color: 'text-primary bg-primary/10' }],
        activity: buildCustomerActivitySummary(Number(row.id || 0), orderRes.list || []),
      }));
      setCustomers(mapped as typeof CUSTOMERS);
      setOrders(orderRes.list || []);
      if (dashboardRes) setDashboardMetrics(dashboardRes);
      if (customerActivityFeedRes) setDashboardCustomerActivityFeed(customerActivityFeedRes.list || []);
      setLiveError('');
    } catch (err: any) {
      if (isDisposed()) return;
      setLiveError(err?.message || ERROR_COPY.realtimeLoadFailed);
    } finally {
      if (!isDisposed() && includeMetrics) setDashboardCustomerActivityFeedLoading(false);
    }
  };

  const loadDashboardMetrics = async (disposedRef?: { disposed: boolean }) => {
    const isDisposed = () => Boolean(disposedRef?.disposed);
    if (!isDisposed()) setDashboardMetricsLoading(true);
    try {
      const res = await bApi.dashboardMetrics(7);
      if (isDisposed()) return;
      setDashboardMetrics(res);
    } catch {
      if (isDisposed()) return;
    } finally {
      if (!isDisposed()) setDashboardMetricsLoading(false);
    }
  };

  const openDashboardParticipants = async (metric: BDashboardCustomerListMetricKey = 'activity_participants_7d') => {
    setDashboardParticipantsOpen(true);
    setDashboardParticipantsLoading(true);
    setDashboardParticipantsError('');
    setDashboardParticipantsData(null);
    try {
      const res = await bApi.dashboardCustomerList(metric, 7);
      setDashboardParticipantsData(res);
    } catch (err: any) {
      setDashboardParticipantsError(err?.message || '客户列表获取失败');
    } finally {
      setDashboardParticipantsLoading(false);
    }
  };

  const openDashboardCustomerActivityFeed = async () => {
    setDashboardCustomerActivityFeedOpen(true);
    setDashboardCustomerActivityFeedModalLoading(true);
    setDashboardCustomerActivityFeedError('');
    setDashboardCustomerActivityFeedData((prev) =>
      prev && prev.list.length
        ? prev
        : {
            ok: true,
            scope: dashboardMetrics?.scope || { scopeType: 'team', label: '当前统计范围', tenantId: null, teamId: null },
            total: dashboardCustomerActivityFeed.length,
            rangeLabel: '今日',
            list: getDashboardCustomerActivityFullRows(dashboardCustomerActivityFeed),
          },
    );
    try {
      const res = await bApi.dashboardCustomerActivityFeed('all');
      setDashboardCustomerActivityFeedData({
        ...res,
        list: getDashboardCustomerActivityFullRows(res.list || []),
      });
    } catch (err: any) {
      setDashboardCustomerActivityFeedError(err?.message || '今日用户动态获取失败');
    } finally {
      setDashboardCustomerActivityFeedModalLoading(false);
    }
  };

  const openToolMetricParticipants = async (
    item: { id: number; title: string; shareType: BEffectShareType },
    metric: BShareParticipantMetricKind = 'signup',
  ) => {
    const targetId = Number(item.id || 0);
    setToolParticipantsMetric(metric);
    setToolParticipantsTitle(String(item.title || '').trim());
    setToolParticipantsShareType(item.shareType);
    setToolParticipantsOpen(true);
    setToolParticipantsLoading(true);
    setToolParticipantsError('');
    setToolParticipantsData(null);
    try {
      const res =
        item.shareType === 'activity'
          ? await bApi.activityParticipants({
              targetId: targetId > 0 ? targetId : undefined,
              metric,
            })
          : await bApi.effectParticipants({
              shareType: item.shareType,
              targetId: targetId > 0 ? targetId : undefined,
            });
      setToolParticipantsData(res);
    } catch (err: any) {
      const copy = effectCopyByShareType(item.shareType);
      const fallback =
        item.shareType === 'activity' && metric === 'attended'
          ? copy.attendedRefreshError || copy.refreshError
          : copy.refreshError;
      setToolParticipantsError(err?.message || fallback);
    } finally {
      setToolParticipantsLoading(false);
    }
  };

  const handleWriteoffOrder = async (order: BOrder, overrideToken?: string) => {
    const orderId = Number(order.id || 0);
    if (orderId <= 0) return;
    try {
      setWriteoffSubmittingId(orderId);
      await bApi.writeoff({
        id: orderId,
        token: String(overrideToken || order.writeoffToken || ''),
        orderType: String(order.orderType || ''),
        sourceRecordId: Number(order.sourceRecordId || 0),
      });
      await loadCustomerLibraryData(undefined, { includeMetrics: false });
      alert(`${String(order.orderType || '') === 'activity' ? '活动' : '积分商品'}核销成功`);
    } catch (err: any) {
      showApiError(err, '核销失败，请稍后重试');
    } finally {
      setWriteoffSubmittingId(0);
    }
  };

  useEffect(() => {
    if (!session) return;
    return onAuthInvalid(() => {
      handleLogout();
      setLiveError('登录已失效，请重新登录');
    });
  }, [session]);

  useEffect(() => {
    if (!session) {
      setPagePermissions(null);
      setPagePermissionLoading(false);
      setPagePermissionError('');
      return;
    }
    let disposed = false;
    (async () => {
      try {
        setPagePermissionLoading(true);
        setPagePermissionError('');
        const res = await bApi.pagePermissions();
        if (disposed) return;
        setPagePermissions(res);
      } catch (err: any) {
        if (disposed) return;
        setPagePermissions({
          tenantId: Number(session.tenantId || 0),
          roleKey: String(session.role || ''),
          allowedViews: [],
          modules: [],
          grants: [],
          dataPermission: { supported: false, status: 'load_failed' },
        });
        setPagePermissionError(err?.message || ERROR_COPY.permissionConfigLoadFailed);
      } finally {
        if (!disposed) setPagePermissionLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [session?.actorId, session?.role, session?.tenantId, session?.token]);

  useEffect(() => {
    if (!session) return;
    let disposed = false;
    const disposedRef = { disposed: false };
    (async () => {
      await loadCustomerLibraryData(disposedRef, { includeMetrics: true });
      if (disposed) return;
    })();
    const timer = window.setInterval(() => {
      void loadCustomerLibraryData(disposedRef, { includeMetrics: true });
    }, 15000);
    const onFocus = () => {
      void loadCustomerLibraryData(disposedRef, { includeMetrics: true });
    };
    window.addEventListener('focus', onFocus);
    return () => {
      disposed = true;
      disposedRef.disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    track('b_page_view', { tab: activeTab });
  }, [activeTab, session]);

  useEffect(() => {
    if (!session || !permissionsResolved) return;
    if (showTagEditor && !permissionAccess.tags) {
      setShowTagEditor(false);
    }
  }, [permissionAccess.tags, permissionsResolved, session, showTagEditor]);

  if (!session) {
    return (
      <div className="max-w-md mx-auto bg-background-light min-h-screen relative shadow-2xl overflow-hidden flex flex-col">
        <LoginView
          onLogin={async ({ account, password }) => {
            const result = await bApi.login({ account, password });
            bApi.setSession(result.session);
            setSession(result.session);
            track('b_login_success', { account: result.session.account, role: result.session.role });
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-background-light min-h-screen relative shadow-2xl overflow-x-hidden flex flex-col">
      <div className="px-3 pt-2">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 flex items-center justify-between">
          <span>实时数据: 客户 {customers.length} · 订单 {orders.length}</span>
          <span
            className={
              pagePermissionError
                ? 'text-amber-600'
                : liveError
                  ? 'text-rose-500'
                  : pagePermissionLoading
                    ? 'text-slate-500'
                    : 'text-emerald-600'
            }
          >
            {pagePermissionError ? '权限异常' : liveError ? '连接异常' : pagePermissionLoading ? '权限同步中' : '已连接 API'}
          </span>
        </div>
      </div>
      {pagePermissionError ? (
        <div className="px-3 pt-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">{pagePermissionError}</div>
        </div>
      ) : null}
      {selectedCustomer ? (
        <CustomerProfileView onBack={() => setSelectedCustomer(null)} customer={selectedCustomer} />
      ) : showTagEditor ? (
        <TagEditorView onBack={() => setShowTagEditor(false)} />
      ) : showPolicyEntry ? (
        <PolicyEntryView onBack={() => setShowPolicyEntry(false)} customers={customers} selectedCustomer={selectedCustomer} />
      ) : showScanVerification ? (
        <ScanVerificationView
          onBack={() => setShowScanVerification(false)}
          orders={orders}
          customers={customers}
          onWriteoff={handleWriteoffOrder}
          writeoffSubmittingId={writeoffSubmittingId}
        />
      ) : homeRecentOrderDetail ? (
        <CustomerOrdersView
          orders={orders}
          customers={customers}
          initialSelectedOrder={homeRecentOrderDetail}
          onBack={() => setHomeRecentOrderDetail(null)}
          onWriteoff={handleWriteoffOrder}
          writeoffSubmittingId={writeoffSubmittingId}
        />
      ) : showCustomerOrders ? (
        <CustomerOrdersView
          orders={orders}
          customers={customers}
          onBack={() => setShowCustomerOrders(false)}
          onWriteoff={handleWriteoffOrder}
          writeoffSubmittingId={writeoffSubmittingId}
        />
      ) : homeRecentActivityDetail ? (
        <HomeRecentActivityDetailView
          activity={homeRecentActivityDetail}
          signups={homeRecentActivitySignups}
          loading={homeRecentActivityLoading}
          error={homeRecentActivityError}
          onBack={() => {
            setHomeRecentActivityOrder(null);
            setHomeRecentActivityDetail(null);
            setHomeRecentActivitySignups([]);
            setHomeRecentActivityLoading(false);
            setHomeRecentActivityError('');
          }}
          onRetry={() => {
            if (!homeRecentActivityOrder) return;
            void loadHomeRecentActivityDetail(homeRecentActivityOrder);
          }}
          onOpenParticipantCustomer={(row) => {
            setHomeRecentActivityOrder(null);
            setHomeRecentActivityDetail(null);
            setHomeRecentActivitySignups([]);
            setHomeRecentActivityLoading(false);
            setHomeRecentActivityError('');
            openParticipantCustomer(row);
          }}
        />
      ) : dashboardCustomerActivityFeedOpen ? (
        <DashboardCustomerActivityFeedView
          data={dashboardCustomerActivityFeedData}
          loading={dashboardCustomerActivityFeedModalLoading}
          error={dashboardCustomerActivityFeedError}
          dashboardMetrics={dashboardMetrics}
          fallbackRows={dashboardCustomerActivityFeed}
          customers={customers}
          onBack={() => {
            setDashboardCustomerActivityFeedOpen(false);
            setDashboardCustomerActivityFeedError('');
            setDashboardCustomerActivityFeedModalLoading(false);
          }}
          onOpenCustomer={(customer) => {
            setDashboardCustomerActivityFeedOpen(false);
            setDashboardCustomerActivityFeedError('');
            setDashboardCustomerActivityFeedModalLoading(false);
            setSelectedCustomer(customer);
          }}
        />
      ) : (
        <>
          <div className="pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
            {activeTab === 'home' && (
              <HomeView
                onOpenToolsTab={() => {
                  setSelectedShareEffect(null);
                  setActiveTab('tools');
                }}
                onOpenAnalyticsTab={() => {
                  setSelectedShareEffect(null);
                  setActiveTab('analytics');
                }}
                onOpenPolicyEntry={() => setShowPolicyEntry(true)}
                onOpenScanVerification={() => setShowScanVerification(true)}
                onOpenCustomerOrders={() => setShowCustomerOrders(true)}
                onOpenAllCustomerActivities={() => {
                  void openDashboardCustomerActivityFeed();
                }}
                onOpenDashboardCustomerList={(metric) => void openDashboardParticipants(metric)}
                onOpenRecentCustomerActivity={(row) => {
                  const customerId = Number(row.userId || 0);
                  if (customerId <= 0) return;
                  const matched = customers.find((item) => Number(item.id || 0) === customerId);
                  setSelectedCustomer(toDashboardActivityCustomerShell(row, matched));
                }}
                onOpenRecentCustomerOrder={(order) => {
                  setHomeRecentOrderDetail(order);
                }}
                customers={customers}
                orders={orders}
                customerActivityFeed={dashboardCustomerActivityFeed}
                customerActivityFeedLoading={dashboardCustomerActivityFeedLoading}
                dashboardMetrics={dashboardMetrics}
                dashboardMetricsLoading={dashboardMetricsLoading}
              />
            )}
            {activeTab === 'customers' && (
              <CustomersView
                canOpenTags={permissionAccess.tags}
                customers={customers}
                onOpenDetail={(customer) => setSelectedCustomer(customer)}
                onOpenCreate={() => setShowPolicyEntry(true)}
                onOpenTags={() => setShowTagEditor(true)}
              />
            )}
            {activeTab === 'tools' && (
              <ToolsView
                access={permissionAccess}
                onOpenShareEffect={(effect) => {
                  setSelectedShareEffect(effect);
                  setActiveTab('analytics');
                }}
                onOpenToolMetricParticipants={(item, metric) => {
                  void openToolMetricParticipants(item, metric);
                }}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsView
                hasStatsPermission={permissionAccess.analytics}
                customers={customers}
                orders={orders}
                dashboardMetrics={dashboardMetrics}
                dashboardMetricsLoading={dashboardMetricsLoading}
                selectedShareEffect={selectedShareEffect}
                onClearShareEffect={() => {
                  setSelectedShareEffect(null);
                }}
                onOpenParticipantCustomer={openParticipantCustomer}
                onOpenDashboardParticipants={() => void openDashboardParticipants('activity_participants_7d')}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileView
                session={session}
                profile={advisorProfile}
                profileLoading={advisorProfileLoading}
                profileSaving={advisorProfileSaving}
                profileError={advisorProfileError}
                onSaveProfile={handleSaveAdvisorProfile}
                onLogout={handleLogout}
              />
            )}
            {activeTab !== 'home' && activeTab !== 'customers' && activeTab !== 'tools' && activeTab !== 'analytics' && activeTab !== 'profile' && (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <p>页面开发中...</p>
              </div>
            )}
          </div>
          
          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {visibleNavItems.map((item) => (
              <div key={item.id}>
                <NavItem
                  icon={item.icon}
                  label={item.label}
                  isActive={activeTab === item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'analytics') {
                      setSelectedShareEffect(null);
                    }
                  }}
                />
              </div>
            ))}
          </nav>
          {dashboardParticipantsOpen ? (
            <div className="absolute inset-0 z-[72] bg-black/55 flex items-end sm:items-center justify-center p-4">
              <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Activity Participants</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900">{dashboardParticipantsData?.title || '客户列表'}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {(dashboardParticipantsData?.scope?.label || dashboardMetrics?.scope?.label || '当前统计范围') +
                        (dashboardParticipantsData?.rangeLabel ? ` · ${dashboardParticipantsData.rangeLabel}` : '')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDashboardParticipantsOpen(false);
                      setDashboardParticipantsData(null);
                      setDashboardParticipantsError('');
                      setDashboardParticipantsLoading(false);
                    }}
                    className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
                    aria-label="close-dashboard-participants"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto p-5 space-y-4">
                  {dashboardParticipantsLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      正在加载客户列表...
                    </div>
                  ) : null}

                  {!dashboardParticipantsLoading && dashboardParticipantsError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                      {dashboardParticipantsError}
                    </div>
                  ) : null}

                  {!dashboardParticipantsLoading && !dashboardParticipantsError ? (
                    (dashboardParticipantsData?.list || []).length ? (
                      <div className="space-y-3">
                        {(dashboardParticipantsData?.list || []).map((row) => (
                          <button
                            key={`${row.userId || 0}:${row.mobile || ''}:${row.occurredAt || ''}`}
                            type="button"
                            onClick={() => {
                              openParticipantCustomer({
                                userId: Number(row.userId || 0),
                                name: String(row.name || ''),
                                mobile: String(row.mobile || ''),
                                shareType: 'activity',
                                targetTitle: String(row.subtitle || ''),
                                occurredAt: String(row.occurredAt || ''),
                              });
                              setDashboardParticipantsOpen(false);
                              setDashboardParticipantsData(null);
                              setDashboardParticipantsError('');
                              setDashboardParticipantsLoading(false);
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{row.name || `客户${row.userId || ''}`}</p>
                                <p className="mt-1 text-sm text-slate-500">{row.mobile || '未留手机号'}</p>
                                <p className="mt-1 text-xs text-slate-400">{row.subtitle || '客户明细'}</p>
                              </div>
                              <p className="shrink-0 text-xs text-slate-400">
                                {row.occurredAt ? new Date(row.occurredAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                        当前没有近7日活动参与客户
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {toolParticipantsOpen ? (
            <div className="absolute inset-0 z-[72] bg-black/55 flex items-end sm:items-center justify-center p-4">
              <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    {(() => {
                      const toolCopy = effectCopyByShareType(toolParticipantsShareType);
                      const isAttended = toolParticipantsShareType === 'activity' && toolParticipantsMetric === 'attended';
                      const listLabel = isAttended
                        ? toolCopy.attendedListLabel || '活动参加客户'
                        : toolCopy.participantListLabel;
                      return (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                            {toolParticipantsShareType === 'activity'
                              ? isAttended
                                ? 'Activity Attendees'
                                : 'Activity Signups'
                              : toolParticipantsShareType === 'learning_course'
                                ? 'Learning Participants'
                                : toolParticipantsShareType === 'mall_activity'
                                  ? 'Mall Activity Participants'
                                  : 'Mall Participants'}
                          </p>
                          <h3 className="mt-1 text-base font-bold text-slate-900">{listLabel}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {(toolParticipantsTitle || toolParticipantsData?.filter?.targetTitle || '当前项目') +
                              ' · ' +
                              (toolParticipantsData?.scope?.label || '当前统计范围')}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => {
                      setToolParticipantsOpen(false);
                      setToolParticipantsData(null);
                      setToolParticipantsError('');
                      setToolParticipantsLoading(false);
                    }}
                    className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
                    aria-label="close-tool-participants"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto p-5 space-y-4">
                  {toolParticipantsLoading ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      正在加载客户列表...
                    </div>
                  ) : null}

                  {!toolParticipantsLoading && toolParticipantsError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">
                      {toolParticipantsError}
                    </div>
                  ) : null}

                  {!toolParticipantsLoading && !toolParticipantsError ? (
                    (toolParticipantsData?.list || []).length ? (
                      <div className="space-y-3">
                        {(toolParticipantsData?.list || []).map((row) => (
                          <button
                            key={`${row.userId || 0}:${row.mobile || ''}:${row.occurredAt || ''}`}
                            type="button"
                            onClick={() => {
                              const toolCopy = effectCopyByShareType(toolParticipantsShareType);
                              const isAttended = toolParticipantsShareType === 'activity' && toolParticipantsMetric === 'attended';
                              openParticipantCustomer({
                                userId: Number(row.userId || 0),
                                name: String(row.name || ''),
                                mobile: String(row.mobile || ''),
                                shareType: toolParticipantsShareType,
                                targetTitle: String(row.targetTitle || toolParticipantsTitle || ''),
                                occurredAt: String(row.occurredAt || ''),
                                tagLabel: isAttended
                                  ? toolCopy.attendedTag || '活动参加客户'
                                  : toolCopy.participantTag,
                                summaryPrefix: isAttended
                                  ? toolCopy.attendedSummaryPrefix || '参加活动：'
                                  : toolCopy.participantSummaryPrefix,
                              });
                              setToolParticipantsOpen(false);
                              setToolParticipantsData(null);
                              setToolParticipantsError('');
                              setToolParticipantsLoading(false);
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">{row.name || `客户${row.userId || ''}`}</p>
                                  <p className="mt-1 text-sm text-slate-500">{row.mobile || '未留手机号'}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                  {row.occurredAt ? new Date(row.occurredAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                                </span>
                              </div>
                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">活动名称</p>
                                <p className="mt-1 text-sm font-medium text-slate-700 line-clamp-2">
                                  {row.targetTitle || toolParticipantsTitle || '未命名活动'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                        {(() => {
                          const toolCopy = effectCopyByShareType(toolParticipantsShareType);
                          return `当前没有${
                            toolParticipantsShareType === 'activity' && toolParticipantsMetric === 'attended'
                              ? toolCopy.attendedListLabel || '活动参加客户'
                              : toolCopy.participantListLabel
                          }`;
                        })()}
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
