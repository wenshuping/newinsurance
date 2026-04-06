import React, { useEffect, useState } from 'react';
import { ChevronLeft, MoreHorizontal, FileText, ShieldAlert, Gavel, Headset, Zap, Shield, HeartPulse, Stethoscope, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { bApi, type InsurancePolicy, type InsurancePolicyAnalysis } from '../../lib/api';
import FamilyPolicyReportSheet from './FamilyPolicyReportSheet';

interface Props {
  customerId: number;
  policy: InsurancePolicy;
  onClose: () => void;
  loadFamilyPolicies: () => Promise<InsurancePolicy[]>;
  familyReportCustomerName?: string;
}

const iconByType: Record<string, any> = {
  stethoscope: Stethoscope,
  'heart-pulse': HeartPulse,
  shield: Shield,
};

export default function PolicyDetail({ customerId, policy, onClose, loadFamilyPolicies, familyReportCustomerName }: Props) {
  const [detail, setDetail] = useState<InsurancePolicy>(policy);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysis, setAnalysis] = useState<InsurancePolicyAnalysis | null>(policy.analysis || null);
  const [showFamilyReport, setShowFamilyReport] = useState(false);

  useEffect(() => {
    setDetail(policy);
    setAnalysis(policy.analysis || null);
    setAnalysisError('');
  }, [policy]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadFamilyPolicies()
      .then((policies) => {
        if (!mounted) return;
        const latest = (policies || []).find((item) => Number(item.id) === Number(policy.id));
        if (!latest) return;
        setDetail(latest);
        setAnalysis(latest.analysis || null);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadFamilyPolicies, policy.id]);

  const handleAnalyzePolicy = async () => {
    if (analysisLoading || analysis) return;
    try {
      setAnalysisLoading(true);
      setAnalysisError('');
      const resp = await bApi.analyzeCustomerPolicy(customerId, detail.id);
      if (resp.policy) {
        setDetail(resp.policy);
        setAnalysis(resp.policy.analysis || resp.analysis);
      } else {
        setAnalysis(resp.analysis);
      }
    } catch (err: any) {
      setAnalysisError(err?.message || '保单责任分析失败，请稍后重试');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const Icon = iconByType[detail.icon] || Shield;
  const color = detail.icon === 'stethoscope' ? 'text-blue-500' : detail.icon === 'heart-pulse' ? 'text-red-500' : 'text-orange-500';
  const bg = detail.icon === 'stethoscope' ? 'bg-blue-50' : detail.icon === 'heart-pulse' ? 'bg-red-50' : 'bg-orange-50';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[85] bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">保单详情</h1>
        <button className="p-2 -mr-2 text-slate-700 active:bg-slate-100 rounded-full">
          <MoreHorizontal size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {loading && <div className="text-sm text-slate-500">保单详情加载中...</div>}

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-xl ${bg} flex items-center justify-center ${color}`}>
              <Icon size={32} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-bold rounded">{detail.status}</span>
                <span className="text-slate-400 text-xs">#{detail.policyNo}</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">{detail.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{detail.company}</p>
            </div>
          </div>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <ShieldAlert className="text-blue-500" size={20} />
            <h3 className="text-base font-bold">保险责任内容</h3>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900 text-sm">责任解读</p>
                <p className="text-slate-500 text-xs mt-1">优先展示这张保单已经整理出的责任内容，方便业务员直接查看和讲解。</p>
              </div>
              {analysis ? (
                <div className="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
                  <p className="text-[11px] font-bold text-emerald-700">已归档责任内容</p>
                  {analysis.generatedAt ? (
                    <p className="mt-1 text-[11px] text-emerald-600">
                      {String(analysis.generatedAt).slice(0, 10)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAnalyzePolicy()}
                  disabled={analysisLoading}
                  className="shrink-0 px-4 h-9 rounded-xl bg-blue-500 text-white text-xs font-bold disabled:opacity-60"
                >
                  {analysisLoading ? '整理中...' : '补齐责任内容'}
                </button>
              )}
            </div>

            {analysisError ? <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{analysisError}</div> : null}

            {analysis ? (
              <>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="font-bold text-sm text-slate-900">产品概述</p>
                  <p className="text-sm text-slate-700 mt-2 leading-6">{analysis.productOverview}</p>
                </div>

                <div className="rounded-xl border border-slate-100 px-4 py-3">
                  <p className="font-bold text-sm text-slate-900">核心特点</p>
                  <p className="text-sm text-slate-700 mt-2 leading-6">{analysis.coreFeature}</p>
                </div>
              </>
            ) : null}

            {(detail.responsibilities || []).length ? (
              <div className="space-y-3">
                {(detail.responsibilities || []).map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-900">{item.name}</p>
                      <p className="text-slate-500 text-xs mt-1 leading-5">{item.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-base text-slate-900">{(item.limit / 10000).toFixed(2)}万</p>
                      <p className="text-[10px] text-slate-400 uppercase">Limit</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : analysisLoading ? (
              <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-5 text-sm text-blue-600">
                正在整理这张保单的责任内容...
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                当前还没有可展示的责任内容，可以点击右上角补齐责任内容并归档。
              </div>
            )}

            {analysis?.coverageTable?.length ? (
              <div className="space-y-2">
                <p className="font-bold text-sm text-slate-900">责任表格</p>
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

            {analysis?.exclusions?.length ? (
              <div className="space-y-2">
                <p className="font-bold text-sm text-slate-900">免责提醒</p>
                {analysis.exclusions.map((item, idx) => (
                  <div key={`${item}-${idx}`} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-700">
                    {item}
                  </div>
                ))}
              </div>
            ) : null}

            {analysis?.purchaseAdvice ? (
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <p className="font-bold text-sm text-slate-900">讲解建议</p>
                <p className="text-sm text-blue-700 mt-2 leading-6 whitespace-pre-line">{analysis.purchaseAdvice}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Sparkles className="text-sky-500" size={20} />
            <h3 className="text-base font-bold">家庭保障体检报告</h3>
          </div>
          <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-400 p-5 text-white shadow-[0_18px_40px_-18px_rgba(14,165,233,0.75)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Advisor Insight</p>
                <h3 className="mt-2 text-xl font-black leading-tight">保单分析</h3>
                <p className="mt-2 text-sm leading-6 text-white/85">
                  直接查看这位客户名下保单形成的家庭保障体检报告，方便后续做顾问式跟进。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFamilyReport(true)}
                className="shrink-0 rounded-2xl bg-white px-4 py-3 text-sm font-black text-sky-600 shadow-lg shadow-sky-900/10"
              >
                查看报告
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <FileText className="text-blue-500" size={20} />
            <h3 className="text-base font-bold">投保信息</h3>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <p className="text-slate-400 text-xs mb-1">投保人</p>
                <p className="font-bold">{detail.applicant}</p>
                {detail.applicantRelation ? <p className="text-xs text-slate-500 mt-1">与录入人关系：{detail.applicantRelation}</p> : null}
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">被保险人</p>
                <p className="font-bold">{detail.insured}</p>
                {detail.insuredRelation ? <p className="text-xs text-slate-500 mt-1">与录入人关系：{detail.insuredRelation}</p> : null}
              </div>
              <div className="col-span-2 border-t border-slate-50 pt-4">
                <p className="text-slate-400 text-xs mb-1">保险期间</p>
                <p className="font-bold">
                  {detail.periodStart} 至 {detail.periodEnd}
                </p>
              </div>
              <div className="border-t border-slate-50 pt-4">
                <p className="text-slate-400 text-xs mb-1">年度保费</p>
                <p className="font-extrabold text-blue-500">¥{Number(detail.annualPremium || 0).toLocaleString('zh-CN')}</p>
              </div>
              <div className="border-t border-slate-50 pt-4">
                <p className="text-slate-400 text-xs mb-1">保障额度</p>
                <p className="font-extrabold text-slate-900">{(detail.amount / 10000).toFixed(2)}万</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gavel className="text-blue-500" size={24} />
              <div>
                <p className="font-bold text-slate-900 text-sm">免责条款与投保告知</p>
                <p className="text-slate-500 text-xs mt-0.5">请务必阅读，了解不予赔付的情形</p>
              </div>
            </div>
            <ChevronLeft className="text-slate-400 rotate-180" size={20} />
          </div>
        </section>

      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex gap-3">
        <button className="flex-1 h-12 rounded-xl border-2 border-blue-500 text-blue-500 font-bold text-sm flex items-center justify-center gap-2 active:bg-blue-50 transition-colors">
          <Headset size={18} />
          联系客户
        </button>
        <button className="flex-[1.5] h-12 rounded-xl bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95 transition-transform">
          <Zap size={18} />
          跟进建议
        </button>
      </div>

      {showFamilyReport ? (
        <FamilyPolicyReportSheet
          customerId={customerId}
          onClose={() => setShowFamilyReport(false)}
          loadPolicies={loadFamilyPolicies}
          customerName={familyReportCustomerName}
          scopeLabel="客户库内已录入保单"
        />
      ) : null}
    </motion.div>
  );
}
