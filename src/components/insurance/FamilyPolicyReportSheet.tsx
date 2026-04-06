import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  FileText,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { bApi, type FamilyPolicyReportResponse, type InsurancePolicy } from '../../lib/api';
import {
  buildFamilyPolicyReportPayload,
  buildFamilyStructure,
  buildInsuranceNeedAxes,
  buildPolicyContentRows,
  buildProtectionDistribution,
  formatCoverageAmount,
  formatCurrency,
  summarizePoliciesByApplicant,
  summarizePolicyMembers,
  type ApplicantSummary,
  type FamilyMemberSummary,
  type FamilyStructureNode,
  type InsuranceNeedAxis,
  type PolicyContentRow,
  type ProtectionDistributionItem,
} from '../../lib/policyReport';
import { getApiErrorMessage } from '../../lib/ui-error';

interface Props {
  customerId: number;
  onClose: () => void;
  loadPolicies: () => Promise<InsurancePolicy[]>;
  customerName?: string;
  scopeLabel?: string;
}

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

type ReportSection = {
  title: string;
  blocks: MarkdownBlock[];
};

type PositionedNode = FamilyStructureNode & {
  x: number;
  y: number;
};

const REPORT_MODE_LABELS: Record<string, string> = {
  auto: '自动识别',
  basic: '基础信息',
  partial: '部分信息',
  detailed: '详细责任',
};

const SERIF_STYLE = {
  fontFamily: '"Noto Serif SC","Songti SC","STSong","Source Han Serif SC",serif',
};

const ROLE_STYLES: Record<
  string,
  {
    fill: string;
    stroke: string;
    text: string;
    badge: string;
  }
> = {
  本人: { fill: '#0369A1', stroke: '#0369A1', text: '#FFFFFF', badge: '#E0F2FE' },
  配偶: { fill: '#FFFFFF', stroke: '#0EA5E9', text: '#075985', badge: '#E0F2FE' },
  子女: { fill: '#F0F9FF', stroke: '#38BDF8', text: '#075985', badge: '#E0F2FE' },
  老人: { fill: '#F8FBFF', stroke: '#7DD3FC', text: '#0C4A6E', badge: '#F0F9FF' },
  家庭成员: { fill: '#FFFFFF', stroke: '#93C5FD', text: '#1E3A8A', badge: '#EFF6FF' },
};

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = String(markdown || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const blocks: MarkdownBlock[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading', level: 1, text: line.slice(2).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, text: line.slice(3).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, text: line.slice(4).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith('#### ')) {
      blocks.push({ type: 'heading', level: 4, text: line.slice(5).trim() });
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^#{1,4}\s+/.test(next) || /^[-*]\s+/.test(next) || /^\d+\.\s+/.test(next)) break;
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function buildReportDocument(markdown: string) {
  const blocks = parseMarkdown(markdown);
  const preamble: MarkdownBlock[] = [];
  const sections: ReportSection[] = [];
  let title = '家庭保障体检报告';
  let titleLocked = false;
  let currentSection: ReportSection | null = null;

  for (const block of blocks) {
    if (block.type === 'heading' && (block.level === 1 || block.level === 2) && !titleLocked) {
      title = block.text || title;
      titleLocked = true;
      continue;
    }

    if (block.type === 'heading' && block.level === 3) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: block.text, blocks: [] };
      continue;
    }

    if (currentSection) currentSection.blocks.push(block);
    else preamble.push(block);
  }

  if (currentSection) sections.push(currentSection);
  if (!sections.length && preamble.length) {
    sections.push({ title: '报告内容', blocks: preamble.splice(0, preamble.length) });
  }

  return { title, preamble, sections };
}

function renderInlineText(text: string) {
  return String(text || '')
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-[#0C4A6E]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="rounded-md bg-[#EFF6FF] px-1.5 py-0.5 text-[0.92em] font-semibold text-[#075985]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
}

function SummaryMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0369A1]">{label}</p>
      <p className="mt-3 text-[28px] font-black tracking-tight text-[#0C4A6E]">{value}</p>
      <p className="mt-3 text-sm leading-7 text-[#335270]">{note}</p>
    </div>
  );
}

function ChapterShell({
  index,
  eyebrow,
  englishTitle,
  title,
  note,
  children,
}: {
  index: string;
  eyebrow: string;
  englishTitle: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[34px] border border-[#BFDBFE] bg-white shadow-[0_28px_60px_-48px_rgba(3,105,161,0.45)]">
      <div className="border-b border-[#DBEAFE] px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-[#93C5FD]" />
          <span className="rounded-full border border-[#BFDBFE] bg-[#F0F9FF] px-3 py-1 text-[11px] font-bold tracking-[0.24em] text-[#0369A1]">
            {index}
          </span>
          <span className="h-px w-12 bg-[#93C5FD]" />
        </div>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0369A1]">{eyebrow}</p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#7DA6C9]">{englishTitle}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h3 className="text-[32px] font-black leading-tight text-[#0C4A6E]" style={SERIF_STYLE}>
            {title}
          </h3>
          {note ? <p className="max-w-xl text-sm leading-7 text-[#53718F]">{note}</p> : null}
        </div>
      </div>
      <div className="px-6 py-6 md:px-8">{children}</div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#BFDBFE] bg-[#F0F9FF] px-3 py-1 text-[11px] font-semibold text-[#075985]">
      {children}
    </span>
  );
}

function layoutFamilyNodes(nodes: FamilyStructureNode[]) {
  const width = 960;
  const leftLabelSpace = 84;
  const rightPadding = 54;
  const rowBaseY = [92, 244, 396, 548];
  const grouped = new Map<number, FamilyStructureNode[]>();
  for (const node of nodes) {
    const row = Math.max(0, Math.min(3, node.generation));
    const current = grouped.get(row) || [];
    current.push(node);
    grouped.set(row, current);
  }

  const positionedNodes: PositionedNode[] = [];
  const maxRow = Math.max(0, ...nodes.map((node) => Math.min(3, node.generation)));
  for (let row = 0; row <= maxRow; row += 1) {
    const rowNodes = (grouped.get(row) || []).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    if (!rowNodes.length) continue;
    const usableWidth = width - leftLabelSpace - rightPadding;
    const step = usableWidth / (rowNodes.length + 1);
    rowNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        x: leftLabelSpace + step * (index + 1),
        y: rowBaseY[row],
      });
    });
  }

  return {
    width,
    height: rowBaseY[maxRow] + 116,
    positionedNodes,
  };
}

function FamilyStructureDiagram({ nodes }: { nodes: FamilyStructureNode[] }) {
  const { width, height, positionedNodes } = useMemo(() => layoutFamilyNodes(nodes), [nodes]);
  const nodeMap = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);
  const grouped = useMemo(() => {
    return positionedNodes.reduce<Record<number, PositionedNode[]>>((acc, node) => {
      const key = Math.max(0, Math.min(3, node.generation));
      acc[key] = acc[key] || [];
      acc[key].push(node);
      return acc;
    }, {});
  }, [positionedNodes]);
  const links = useMemo(() => {
    const generatedLinks: Array<{ source: string; target: string }> = [];
    const applicantNodes = positionedNodes.filter((node) => node.isApplicant);
    const childNodes = positionedNodes.filter((node) => node.generation > 0);
    for (const applicant of applicantNodes) {
      for (const candidate of childNodes) {
        if (candidate.id === applicant.id) continue;
        if (candidate.generation <= applicant.generation) continue;
        if (!candidate.isInsured) continue;
        generatedLinks.push({ source: applicant.id, target: candidate.id });
      }
    }
    return generatedLinks;
  }, [positionedNodes]);

  if (!nodes.length) {
    return <p className="text-sm leading-7 text-[#53718F]">当前没有足够的家庭关系数据来生成结构图。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[28px] border border-[#DBEAFE] bg-[#F8FBFF] p-4 md:p-6">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]">
        {[0, 1, 2].map((row) => (
          <text key={row} x={18} y={96 + row * 152} fill="#7DA6C9" fontSize="12" letterSpacing="2">
            {row === 0 ? '长辈层' : row === 1 ? '核心层' : '子女层'}
          </text>
        ))}

        {links.map((link, index) => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);
          if (!source || !target) return null;
          const middleY = (source.y + target.y) / 2;
          const path = `M ${source.x} ${source.y + 38} V ${middleY} H ${target.x} V ${target.y - 38}`;
          return <path key={`${link.source}-${link.target}-${index}`} d={path} fill="none" stroke="#93C5FD" strokeWidth="2" />;
        })}

        {positionedNodes.map((node) => {
          const style = ROLE_STYLES[node.role] || ROLE_STYLES.家庭成员;
          const initials = node.name.slice(0, 2);
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle r="38" fill={style.fill} stroke={style.stroke} strokeWidth="2.5" />
              <text y="6" textAnchor="middle" fontSize="16" fontWeight="700" fill={style.text}>
                {initials}
              </text>

              {node.isApplicant ? (
                <>
                  <rect x="-30" y="50" width="24" height="18" rx="9" fill={style.badge} stroke="#93C5FD" />
                  <text x="-18" y="63" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369A1">
                    投
                  </text>
                </>
              ) : null}
              {node.isInsured ? (
                <>
                  <rect x={node.isApplicant ? 4 : -12} y="50" width="24" height="18" rx="9" fill="#FFFFFF" stroke="#93C5FD" />
                  <text x={node.isApplicant ? 16 : 0} y="63" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369A1">
                    被
                  </text>
                </>
              ) : null}

              <text y="92" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0C4A6E">
                {node.name}
              </text>
              <text y="112" textAnchor="middle" fontSize="12" fill="#53718F">
                {node.role}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex flex-wrap gap-2">
        <Tag>结构图按投保人 / 被保险人关系生成</Tag>
        <Tag>同一成员的多张保单已合并</Tag>
        <Tag>圆点下方“投 / 被”表示角色</Tag>
      </div>

      {Object.keys(grouped).length ? (
        <p className="mt-3 text-xs leading-6 text-[#53718F]">
          说明：长辈层、核心层、子女层按关系推断生成，用于帮助理解家庭内的保单传递关系，不代替户籍或法定亲属证明。
        </p>
      ) : null}
    </div>
  );
}

function MemberOverviewTable({ members }: { members: FamilyMemberSummary[] }) {
  if (!members.length) {
    return <p className="text-sm leading-7 text-[#53718F]">当前没有可展示的成员保障数据。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[28px] border border-[#DBEAFE]">
      <table className="min-w-full divide-y divide-[#DBEAFE] text-left">
        <thead className="bg-[#0369A1] text-white">
          <tr>
            <th className="px-4 py-3 text-sm font-bold">家庭成员</th>
            <th className="px-4 py-3 text-sm font-bold">角色</th>
            <th className="px-4 py-3 text-sm font-bold">保障类型</th>
            <th className="px-4 py-3 text-sm font-bold">保单数</th>
            <th className="px-4 py-3 text-sm font-bold">年度保费</th>
            <th className="px-4 py-3 text-sm font-bold">合计保额</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFF6FF] bg-white">
          {members.map((member) => (
            <tr key={`${member.name}-${member.role}`} className="align-top">
              <td className="px-4 py-4 text-sm font-bold text-[#0C4A6E]">{member.name}</td>
              <td className="px-4 py-4 text-sm text-[#335270]">{member.role}</td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {member.protectionTypes.map((type) => (
                    <span
                      key={`${member.name}-${type}`}
                      className="rounded-full border border-[#BFDBFE] bg-[#F0F9FF] px-3 py-1 text-[11px] font-semibold text-[#075985]"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4 text-sm text-[#335270]">{member.policyCount}</td>
              <td className="px-4 py-4 text-sm font-semibold text-[#0C4A6E]">{formatCurrency(member.annualPremium)}</td>
              <td className="px-4 py-4 text-sm font-semibold text-[#0C4A6E]">{formatCoverageAmount(member.coverage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicantSummaryTable({ applicants }: { applicants: ApplicantSummary[] }) {
  if (!applicants.length) {
    return <p className="text-sm leading-7 text-[#53718F]">当前没有可展示的投保人维度数据。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[28px] border border-[#DBEAFE]">
      <table className="min-w-full divide-y divide-[#DBEAFE] text-left">
        <thead className="bg-[#0369A1] text-white">
          <tr>
            <th className="px-4 py-3 text-sm font-bold">投保人</th>
            <th className="px-4 py-3 text-sm font-bold">关系</th>
            <th className="px-4 py-3 text-sm font-bold">覆盖成员</th>
            <th className="px-4 py-3 text-sm font-bold">保障类型</th>
            <th className="px-4 py-3 text-sm font-bold">保单数</th>
            <th className="px-4 py-3 text-sm font-bold">年度保费</th>
            <th className="px-4 py-3 text-sm font-bold">合计保额</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFF6FF] bg-white">
          {applicants.map((applicant) => (
            <tr key={`${applicant.name}-${applicant.role}`} className="align-top">
              <td className="px-4 py-4 text-sm font-bold text-[#0C4A6E]">{applicant.name}</td>
              <td className="px-4 py-4 text-sm text-[#335270]">{applicant.role}</td>
              <td className="px-4 py-4 text-sm leading-7 text-[#335270]">{applicant.insuredMembers.join('、') || '-'}</td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {applicant.protectionTypes.map((type) => (
                    <span
                      key={`${applicant.name}-${type}`}
                      className="rounded-full border border-[#BFDBFE] bg-[#F0F9FF] px-3 py-1 text-[11px] font-semibold text-[#075985]"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4 text-sm text-[#335270]">{applicant.policyCount}</td>
              <td className="px-4 py-4 text-sm font-semibold text-[#0C4A6E]">{formatCurrency(applicant.annualPremium)}</td>
              <td className="px-4 py-4 text-sm font-semibold text-[#0C4A6E]">{formatCoverageAmount(applicant.coverage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProtectionBarChart({ items }: { items: ProtectionDistributionItem[] }) {
  if (!items.length) {
    return <p className="text-sm leading-7 text-[#53718F]">当前没有可用于生成保障分布图的数据。</p>;
  }

  const maxCoverage = Math.max(...items.map((item) => item.coverage), 1);

  return (
    <div className="space-y-4 rounded-[28px] border border-[#DBEAFE] bg-[#F8FBFF] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0369A1]">柱状图</p>
          <h4 className="mt-2 text-xl font-black text-[#0C4A6E]" style={SERIF_STYLE}>
            家庭保障分布
          </h4>
        </div>
        <Tag>按保障类型汇总保额</Tag>
      </div>
      <div className="space-y-4">
        {items.map((item) => {
          const width = `${Math.max((item.coverage / maxCoverage) * 100, 8)}%`;
          return (
            <div key={item.type} className="grid gap-2 md:grid-cols-[92px_minmax(0,1fr)_120px] md:items-center">
              <p className="text-sm font-bold text-[#0C4A6E]">{item.type}</p>
              <div>
                <div className="h-3 overflow-hidden rounded-full bg-[#DBEAFE]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#0369A1_0%,#38BDF8_100%)]" style={{ width }} />
                </div>
                <p className="mt-2 text-xs leading-6 text-[#53718F]">
                  {item.policyCount} 张保单 · 年保费 {formatCurrency(item.annualPremium)}
                </p>
              </div>
              <p className="text-sm font-semibold text-[#0C4A6E] md:text-right">{formatCoverageAmount(item.coverage)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsuranceNeedRadarChart({ axes }: { axes: InsuranceNeedAxis[] }) {
  if (!axes.length) {
    return <p className="text-sm leading-7 text-[#53718F]">当前没有可用于生成保险需求分析图的数据。</p>;
  }

  const width = 420;
  const height = 360;
  const centerX = width / 2;
  const centerY = 170;
  const radius = 118;
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

  return (
    <div className="rounded-[28px] border border-[#DBEAFE] bg-[#F8FBFF] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0369A1]">网状图</p>
          <h4 className="mt-2 text-xl font-black text-[#0C4A6E]" style={SERIF_STYLE}>
            保险需求分析
          </h4>
        </div>
        <Tag>按五类保障需求估算当前覆盖程度</Tag>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto min-w-[320px]">
          {levels.map((ratio) => (
            <polygon
              key={ratio}
              points={gridPolygon(ratio)}
              fill={ratio === 1 ? '#F8FBFF' : 'none'}
              stroke="#DBEAFE"
              strokeWidth="2"
            />
          ))}

          {axes.map((axis, index) => {
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
                  fill="#0C4A6E"
                  fontSize="14"
                  fontWeight="700"
                >
                  {axis.label}
                </text>
              </g>
            );
          })}

          <polygon points={polygonPoints} fill="rgba(37,99,235,0.18)" stroke="#2563EB" strokeWidth="4" />

          {points.map((point) => (
            <g key={point.key}>
              <circle cx={point.x} cy={point.y} r="5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="3" />
              <circle cx={point.x} cy={point.y} r="2" fill="#2563EB" />
              <text x={point.x} y={point.y - 10} textAnchor="middle" fill="#2563EB" fontSize="10" fontWeight="700">
                {point.score}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[22px] border border-[#DBEAFE] bg-white px-4 py-4">
          <p className="text-sm font-black text-[#2563EB]">当前较完整</p>
          <p className="mt-3 text-[34px] font-black leading-none text-[#0C4A6E]" style={SERIF_STYLE}>
            {strongest?.label || '-'}
          </p>
          <p className="mt-2 text-sm leading-7 text-[#53718F]">
            {strongest?.score || 0} 分 · {strongest?.policyCount || 0} 张保单 · {formatCoverageAmount(strongest?.coverage || 0)}
          </p>
        </div>
        <div className="rounded-[22px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-4">
          <p className="text-sm font-black text-[#16A34A]">优先确认</p>
          <p className="mt-3 text-[34px] font-black leading-none text-[#0C4A6E]" style={SERIF_STYLE}>
            {weakest?.label || '-'}
          </p>
          <p className="mt-2 text-sm leading-7 text-[#166534]">{weakest?.guidance || '结合客户目标确认这一层需求是否需要优先补位。'}</p>
        </div>
      </div>
    </div>
  );
}

function PolicyContentTable({ rows }: { rows: PolicyContentRow[] }) {
  if (!rows.length) {
    return <p className="text-sm leading-7 text-[#53718F]">当前没有可展示的保单内容。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[28px] border border-[#DBEAFE]">
      <table className="min-w-[1180px] divide-y divide-[#DBEAFE] text-left">
        <thead className="bg-[#0369A1] text-white">
          <tr>
            <th className="px-4 py-3 text-sm font-bold">序号</th>
            <th className="px-4 py-3 text-sm font-bold">保单</th>
            <th className="px-4 py-3 text-sm font-bold">保险公司</th>
            <th className="px-4 py-3 text-sm font-bold">险种类型</th>
            <th className="px-4 py-3 text-sm font-bold">投保人</th>
            <th className="px-4 py-3 text-sm font-bold">被保险人</th>
            <th className="px-4 py-3 text-sm font-bold">状态</th>
            <th className="px-4 py-3 text-sm font-bold">保障期间</th>
            <th className="px-4 py-3 text-sm font-bold">年度保费</th>
            <th className="px-4 py-3 text-sm font-bold">保障额度</th>
            <th className="px-4 py-3 text-sm font-bold">保险责任</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFF6FF] bg-white">
          {rows.map((row, index) => (
            <tr key={row.id || index} className="align-top">
              <td className="px-4 py-4 text-sm font-semibold text-[#0C4A6E]">{index + 1}</td>
              <td className="px-4 py-4">
                <p className="text-sm font-bold text-[#0C4A6E]">{row.name}</p>
                <p className="mt-1 text-xs text-[#53718F]">{row.policyNo}</p>
              </td>
              <td className="px-4 py-4 text-sm text-[#335270]">{row.company}</td>
              <td className="px-4 py-4 text-sm text-[#335270]">{row.type}</td>
              <td className="px-4 py-4 text-sm leading-7 text-[#335270]">
                {row.applicant}
                <br />
                <span className="text-xs text-[#7DA6C9]">{row.applicantRelation}</span>
              </td>
              <td className="px-4 py-4 text-sm leading-7 text-[#335270]">
                {row.insured}
                <br />
                <span className="text-xs text-[#7DA6C9]">{row.insuredRelation}</span>
              </td>
              <td className="px-4 py-4 text-sm text-[#335270]">{row.status}</td>
              <td className="px-4 py-4 text-sm leading-7 text-[#335270]">{row.period}</td>
              <td className="px-4 py-4 text-sm font-semibold text-[#0C4A6E]">{formatCurrency(row.annualPremium)}</td>
              <td className="px-4 py-4 text-sm font-semibold text-[#0C4A6E]">{formatCoverageAmount(row.amount)}</td>
              <td className="px-4 py-4 text-sm leading-7 text-[#335270]">{row.responsibilities}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownBlocks({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const headingClass =
            block.level === 4
              ? 'text-sm font-extrabold uppercase tracking-[0.18em] text-[#0369A1]'
              : 'text-[22px] font-black leading-tight text-[#0C4A6E]';
          return (
            <h4 key={index} className={headingClass} style={block.level === 4 ? undefined : SERIF_STYLE}>
              {block.text}
            </h4>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={index} className="space-y-3">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-3 text-[15px] leading-8 text-[#294765]">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0369A1]" />
                  <span>{renderInlineText(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={index} className="space-y-3">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-3 text-[15px] leading-8 text-[#294765]">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#93C5FD] bg-[#EFF6FF] text-xs font-black text-[#0369A1]">
                    {itemIndex + 1}
                  </span>
                  <span>{renderInlineText(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index} className="text-[15px] leading-8 text-[#294765]">
            {renderInlineText(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function MarkdownView({ markdown }: { markdown: string }) {
  const document = useMemo(() => buildReportDocument(markdown), [markdown]);

  return (
    <div className="space-y-5">
      <article className="overflow-hidden rounded-[32px] border border-[#BFDBFE] bg-white shadow-[0_24px_54px_-42px_rgba(3,105,161,0.35)]">
        <div className="border-b border-[#DBEAFE] bg-[#F8FBFF] px-6 py-5 md:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#0369A1]">报告正文</p>
          <h2 className="mt-3 text-[30px] font-black leading-tight text-[#0C4A6E]" style={SERIF_STYLE}>
            {document.title}
          </h2>
        </div>
        {document.preamble.length ? <div className="px-6 py-6 md:px-8"><MarkdownBlocks blocks={document.preamble} /></div> : null}
      </article>

      {document.sections.map((section, index) => (
        <article
          key={`${section.title}-${index}`}
          className="overflow-hidden rounded-[32px] border border-[#BFDBFE] bg-white shadow-[0_24px_54px_-42px_rgba(3,105,161,0.35)]"
        >
          <div className="grid md:grid-cols-[170px_minmax(0,1fr)]">
            <aside className="border-b border-[#DBEAFE] bg-[#F8FBFF] px-5 py-6 md:border-b-0 md:border-r md:px-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#0369A1]">Section {String(index + 1).padStart(2, '0')}</p>
              <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#0369A1] shadow-sm">
                {index === 0 ? <ShieldCheck size={20} /> : index === 1 ? <BadgeCheck size={20} /> : index === 2 ? <Sparkles size={20} /> : <FileText size={20} />}
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#7DA6C9]">正文分章</p>
            </aside>
            <div className="px-6 py-6 md:px-8">
              <h3 className="text-[26px] font-black leading-tight text-[#0C4A6E]" style={SERIF_STYLE}>
                {section.title}
              </h3>
              <div className="mt-5">
                <MarkdownBlocks blocks={section.blocks} />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function FamilyPolicyReportSheet({ customerId, onClose, loadPolicies, customerName, scopeLabel }: Props) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState<FamilyPolicyReportResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const loadedPolicies = (await loadPolicies()) || [];
        if (!mounted) return;
        setPolicies(loadedPolicies);
        if (!loadedPolicies.length) {
          setReport(null);
          return;
        }
        const payload = buildFamilyPolicyReportPayload(loadedPolicies, {
          customerName,
          reportName: '家庭保障体检报告',
          scopeLabel,
        });
        let response: FamilyPolicyReportResponse;
        try {
          response = await bApi.resolveCustomerFamilyPolicyReport(customerId, payload);
        } catch (resolveErr: any) {
          if (String(resolveErr?.code || '') !== 'FAMILY_POLICY_REPORT_NOT_FOUND') {
            throw resolveErr;
          }
          response = await bApi.generateCustomerFamilyPolicyReport(customerId, payload);
        }
        if (!mounted) return;
        setReport(response);
      } catch (err: any) {
        if (!mounted) return;
        setError(getApiErrorMessage(err, '家庭保障报告暂时无法整理，请稍后重试'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [customerId, customerName, loadPolicies, scopeLabel]);

  const members = useMemo(() => summarizePolicyMembers(policies), [policies]);
  const applicants = useMemo(() => summarizePoliciesByApplicant(policies), [policies]);
  const protectionDistribution = useMemo(() => buildProtectionDistribution(policies), [policies]);
  const insuranceNeedAxes = useMemo(() => buildInsuranceNeedAxes(policies), [policies]);
  const familyStructure = useMemo(() => buildFamilyStructure(policies), [policies]);
  const policyContentRows = useMemo(() => buildPolicyContentRows(policies), [policies]);

  const totalPremium = policies.reduce((sum, policy) => sum + Number(policy.annualPremium || 0), 0);
  const totalCoverage = policies.reduce((sum, policy) => sum + Number(policy.amount || 0), 0);
  const reportModeLabel = REPORT_MODE_LABELS[report?.meta.policyDetailLevel || 'auto'] || '自动识别';
  const generatedAtLabel = report?.meta.generatedAt ? new Date(report.meta.generatedAt).toLocaleString('zh-CN') : '待归档';
  const archiveLabel = loading ? '载入中' : report?.reused ? '已归档复用' : report?.stored ? '本次已归档' : '报告整理中';

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="fixed inset-0 z-[90] flex flex-col bg-[linear-gradient(180deg,#EAF4FB_0%,#F4F9FD_34%,#F8FBFE_100%)]"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-5%] top-8 h-72 w-72 rounded-full bg-white/55 blur-3xl" />
        <div className="absolute right-[-10%] top-1/3 h-80 w-80 rounded-full bg-[#DBEAFE]/60 blur-3xl" />
        <div className="absolute bottom-[-12%] left-1/4 h-96 w-96 rounded-full bg-[#E0F2FE]/40 blur-3xl" />
      </div>

      <header className="sticky top-0 z-10 border-b border-white/60 bg-[#F8FBFE]/86 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <button onClick={onClose} className="rounded-full border border-[#BFDBFE] bg-white p-2 text-[#0369A1] shadow-sm transition active:scale-[0.98]">
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#0369A1]">Family Insurance Guarantee</p>
            <h1 className="mt-1 text-lg font-black tracking-tight text-[#0C4A6E]" style={SERIF_STYLE}>
              保单分析报告
            </h1>
          </div>
          <div className="rounded-full border border-[#BFDBFE] bg-white px-3 py-1 text-[11px] font-bold text-[#0369A1]">
            {archiveLabel}
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-5 pb-24">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[38px] border border-[#BFDBFE] bg-white shadow-[0_36px_80px_-54px_rgba(3,105,161,0.52)]">
            <div className="border-b border-[#DBEAFE] px-6 py-6 md:px-8 md:py-8">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-[#93C5FD]" />
                <span className="rounded-full border border-[#BFDBFE] bg-[#F0F9FF] px-3 py-1 text-[11px] font-bold tracking-[0.24em] text-[#0369A1]">
                  SUMMARY OF FAMILY INSURANCE GUARANTEE
                </span>
                <span className="h-px w-16 bg-[#93C5FD]" />
              </div>

              <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#0369A1]">客户家庭保单结构总览</p>
                  <h2 className="mt-4 text-[36px] font-black leading-[1.12] text-[#0C4A6E] md:text-[46px]" style={SERIF_STYLE}>
                    从家庭结构、投保人关系和保单内容三条线，把客户这组保障讲清楚。
                  </h2>
                  <p className="mt-4 max-w-2xl text-[15px] leading-8 text-[#335270]">
                    这份报告先把客户当前已录入的全部保单按家庭成员和投保人关系整理成结构图，再按保障类型、保障需求和保单内容做归档展示，最后给出书面结论。
                  </p>
                </div>

                <div className="min-w-[240px] rounded-[28px] border border-[#DBEAFE] bg-[#F8FBFF] px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0369A1]">归档信息</p>
                  <p className="mt-3 text-sm font-bold text-[#0C4A6E]">{generatedAtLabel}</p>
                  <p className="mt-1 text-xs text-[#53718F]">{report?.reportId ? `报告编号 #${report.reportId}` : '等待归档'}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-[#DBEAFE] bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#7DA6C9]">范围</p>
                      <p className="mt-1 font-semibold text-[#0C4A6E]">{scopeLabel || '客户当前已录入保单'}</p>
                    </div>
                    <div className="rounded-2xl border border-[#DBEAFE] bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#7DA6C9]">完整度</p>
                      <p className="mt-1 font-semibold text-[#0C4A6E]">{reportModeLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 px-6 py-6 md:grid-cols-4 md:px-8">
              <SummaryMetric label="家庭成员" value={String(members.length)} note="按被保险人和关系归并后的成员数量" />
              <SummaryMetric label="投保人" value={String(applicants.length)} note="按投保人维度统计当前名下保单分布" />
              <SummaryMetric label="年度保费" value={formatCurrency(totalPremium)} note="用于了解当前投入分布，不把高低直接等同于好坏" />
              <SummaryMetric label="合计保额" value={formatCoverageAmount(totalCoverage)} note="用于观察客户家庭保障厚度和集中度" />
            </div>
          </section>

          <ChapterShell
            index="01"
            eyebrow="家庭结构"
            englishTitle="Family Relationship Structure"
            title="按投保人与被保险人关系生成家庭结构图"
            note="这部分不是户籍图，而是保单关系图。会把同一成员的多张保单合并，再呈现家庭里的投保和被保关系。"
          >
            <div className="space-y-5">
              <FamilyStructureDiagram nodes={familyStructure.nodes} />
              <MemberOverviewTable members={members} />
            </div>
          </ChapterShell>

          <ChapterShell
            index="02"
            eyebrow="投保人维度"
            englishTitle="Applicant Dimension Analysis"
            title="根据投保人维度拆解当前保单结构"
            note="先看谁在投保、为谁投保、集中在哪些保障类型，方便业务员理解这组保单是怎么配置出来的。"
          >
            <ApplicantSummaryTable applicants={applicants} />
          </ChapterShell>

          <ChapterShell
            index="03"
            eyebrow="规则图表"
            englishTitle="Rule-Based Visual Summary"
            title="按规则生成保障分布图和保险需求网状图"
            note="柱状图用来看现有保障主要压在哪些类型，网状图用来看健康、人寿、养老、财富、意外五类需求当前覆盖到什么程度。它是结构提示，不是制造焦虑。"
          >
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <ProtectionBarChart items={protectionDistribution} />
              <InsuranceNeedRadarChart axes={insuranceNeedAxes} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                <div className="flex items-center gap-2 text-[#0369A1]">
                  <Users size={18} />
                  <p className="text-sm font-black text-[#0C4A6E]">关系图规则</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-[#335270]">按投保人和被保险人关系生成节点，重复成员合并成同一圆点，避免一人多点。</p>
              </div>
              <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                <div className="flex items-center gap-2 text-[#0369A1]">
                  <Sparkles size={18} />
                  <p className="text-sm font-black text-[#0C4A6E]">需求分析规则</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-[#335270]">按健康、人寿、养老、财富、意外五类需求，把已录入保单的保额、投入和配置数量折算成结构分，用来提醒优先确认哪一层。</p>
              </div>
              <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                <div className="flex items-center gap-2 text-[#0369A1]">
                  <ShieldCheck size={18} />
                  <p className="text-sm font-black text-[#0C4A6E]">保障分布规则</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-[#335270]">按医疗、重疾、意外、身故/长期责任等保障桶汇总，避免逐张保单看不出总体结构。</p>
              </div>
            </div>
          </ChapterShell>

          <ChapterShell
            index="04"
            eyebrow="保单内容"
            englishTitle="Insurance Policy Detail List"
            title="保单内容明细表"
            note="这里保留逐张保单的关键信息，方便回看产品、投保关系、保障期间、年保费和责任标签。"
          >
            <PolicyContentTable rows={policyContentRows} />
          </ChapterShell>

          <section className="rounded-[34px] border border-[#BFDBFE] bg-white shadow-[0_28px_60px_-48px_rgba(3,105,161,0.45)]">
            <div className="grid gap-0 md:grid-cols-[240px_minmax(0,1fr)]">
              <aside className="border-b border-[#DBEAFE] bg-[#F8FBFF] px-6 py-6 md:border-b-0 md:border-r">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#0369A1]">归档依据</p>
                <h3 className="mt-4 text-[28px] font-black leading-tight text-[#0C4A6E]" style={SERIF_STYLE}>
                  报告口径说明
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#53718F]">这部分说明当前报告是如何被整理出来的，避免把“买过保单”直接误解成“客户家庭保障完整”。</p>
              </aside>
              <div className="space-y-5 px-6 py-6 md:px-8">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                    <div className="flex items-center gap-2 text-[#0369A1]">
                      <FileText size={18} />
                      <p className="text-sm font-black text-[#0C4A6E]">全量归档</p>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[#335270]">
                      当前纳入 <span className="font-bold text-[#0C4A6E]">{policies.length}</span> 张保单，覆盖{' '}
                      <span className="font-bold text-[#0C4A6E]">{members.length}</span> 位成员、<span className="font-bold text-[#0C4A6E]">{applicants.length}</span> 位投保人。
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                    <div className="flex items-center gap-2 text-[#0369A1]">
                      <BadgeCheck size={18} />
                      <p className="text-sm font-black text-[#0C4A6E]">规则判断</p>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[#335270]">按家庭结构、投保人维度、保障桶、保额、保费和重复配置做判断，不把存在保单直接写成结论。</p>
                  </div>
                  <div className="rounded-[24px] border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                    <div className="flex items-center gap-2 text-[#0369A1]">
                      <LockKeyhole size={18} />
                      <p className="text-sm font-black text-[#0C4A6E]">隐私脱敏</p>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[#335270]">整理正文前会先完成隐私脱敏，不会把姓名、身份证号和手机号送去写报告。</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm leading-7 text-[#335270]">
                  当前资料完整度为 <span className="font-bold text-[#0C4A6E]">{reportModeLabel}</span>。
                  信息不足的地方，正文会明确区分“已确认”“初步判断”“待确认”，方便后续继续跟进。
                </div>
              </div>
            </div>
          </section>

          {loading ? (
            <section className="rounded-[34px] border border-[#BFDBFE] bg-white p-6 shadow-[0_28px_60px_-48px_rgba(3,105,161,0.45)]">
              <div className="flex items-center gap-3 text-[#335270]">
                <LoaderCircle className="animate-spin text-[#0369A1]" size={20} />
                <div>
                  <p className="text-sm font-black text-[#0C4A6E]">正在载入报告内容</p>
                  <p className="mt-1 text-xs leading-6 text-[#53718F]">如已有归档报告将直接读取，未归档时才会整理一次并保存。</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="h-4 w-40 animate-pulse rounded-full bg-[#DBEAFE]" />
                <div className="h-3 w-full animate-pulse rounded-full bg-[#EFF6FF]" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-[#EFF6FF]" />
                <div className="h-32 animate-pulse rounded-[24px] bg-[#F8FBFF]" />
              </div>
            </section>
          ) : null}

          {!loading && error ? (
            <section className="rounded-[34px] border border-[#FBCFE8] bg-[#FFF7FB] p-6 shadow-[0_28px_60px_-48px_rgba(190,24,93,0.2)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#BE185D]">报告异常</p>
              <h3 className="mt-3 text-[26px] font-black text-[#831843]" style={SERIF_STYLE}>
                当前这份书面报告还没有整理出来
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#9D174D]">{error}</p>
              <p className="mt-2 text-sm leading-7 text-[#9D174D]">已录入的家庭结构、投保关系和保单清单仍然保留在本页，稍后可再次发起整理。</p>
            </section>
          ) : null}

          {!loading && !error && !policies.length ? (
            <section className="rounded-[34px] border border-[#BFDBFE] bg-white p-6 shadow-[0_28px_60px_-48px_rgba(3,105,161,0.45)]">
              <h3 className="text-[26px] font-black text-[#0C4A6E]" style={SERIF_STYLE}>
                当前还没有可归档的保单
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#53718F]">先录入客户保单，再回来查看家庭保障分析报告。</p>
            </section>
          ) : null}

          {!loading && !error && report ? (
            <section className="space-y-5">
              <div className="rounded-[34px] border border-[#BFDBFE] bg-white px-6 py-5 shadow-[0_28px_60px_-48px_rgba(3,105,161,0.45)] md:px-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#0369A1]">报告状态</p>
                    <h3 className="mt-3 text-[28px] font-black text-[#0C4A6E]" style={SERIF_STYLE}>
                      已归档的客户家庭书面结论
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Tag>{report.reused ? '本次读取归档内容' : '本次已更新归档'}</Tag>
                    <Tag>资料完整度：{reportModeLabel}</Tag>
                  </div>
                </div>
              </div>

              <MarkdownView markdown={report.reportMarkdown} />
            </section>
          ) : null}
        </div>
      </main>
    </motion.div>
  );
}
