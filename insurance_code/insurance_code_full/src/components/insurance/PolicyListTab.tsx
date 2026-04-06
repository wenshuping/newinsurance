import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, type InsurancePolicy } from '../../lib/api';

interface Props {
  onSelectPolicy: (policy: InsurancePolicy) => void;
  refreshKey?: number;
}

export default function PolicyListTab({ onSelectPolicy, refreshKey = 0 }: Props) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .insurancePolicies()
      .then((resp) => {
        if (!mounted) return;
        setPolicies(resp.policies || []);
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
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="rounded-[24px] border border-[#E4ECF8] bg-white px-5 py-6 text-sm text-[#6C87A5] shadow-[0_18px_34px_-30px_rgba(15,23,42,0.14)]">
          保单加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {!policies.length && (
        <div className="rounded-[24px] border border-dashed border-[#D6E4F5] bg-white px-5 py-10 text-center shadow-[0_18px_34px_-30px_rgba(15,23,42,0.12)]">
          <p className="text-base font-semibold text-[#0F172A]">还没有录入保单</p>
          <p className="mt-2 text-sm leading-6 text-[#6C87A5]">录入后会在这里统一查看你的保单结构和保障明细。</p>
        </div>
      )}
      {policies.map((policy, index) => (
        <div
          key={policy.id}
          onClick={() => onSelectPolicy(policy)}
          className="group block w-full cursor-pointer rounded-[24px] border border-[#D9E6F4] bg-white px-4 py-4 text-left shadow-[0_18px_34px_-30px_rgba(15,23,42,0.16)] transition hover:border-[#BCD1EE] hover:shadow-[0_20px_36px_-30px_rgba(17,82,212,0.22)] active:scale-[0.995]"
        >
          <div className="space-y-3.5">
            <div className="rounded-[20px] border border-[#E3ECF8] bg-[linear-gradient(180deg,rgba(17,82,212,0.045)_0%,rgba(248,251,255,0.96)_100%)] px-4 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#CFE0F4] bg-white text-[#1152D4] shadow-[0_10px_22px_-20px_rgba(17,82,212,0.45)]">
                  <FileText className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#68829F] ring-1 ring-[#DFE8F4]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="rounded-full bg-[#EBFBF1] px-2.5 py-1 text-[11px] font-semibold text-[#16A34A] ring-1 ring-[#CFF3DA]">{policy.status}</span>
                  </div>
                  <p
                    className="mt-2 text-[17px] font-semibold leading-[1.45] text-[#0F172A]"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {policy.name}
                  </p>
                  <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#5E7A98] ring-1 ring-[#DCE7F4]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1152D4]/45" />
                    <span className="truncate">{policy.company}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex min-h-[88px] flex-col justify-between rounded-[18px] border border-[#E4ECF8] bg-[#F8FBFF] px-4 py-3.5">
                <p className="text-[12px] font-medium leading-none text-[#8EA3BB]">被保人</p>
                <p className="mt-3 text-[18px] font-semibold leading-7 text-[#0F172A]">{policy.insured || '-'}</p>
              </div>
              <div className="flex min-h-[88px] flex-col justify-between rounded-[18px] border border-[#E4ECF8] bg-[#F8FBFF] px-4 py-3.5">
                <p className="text-[12px] font-medium leading-none text-[#8EA3BB]">年度保费</p>
                <p className="mt-3 text-[18px] font-semibold leading-7 text-[#0F172A]">{formatCurrency(Number(policy.annualPremium || 0))}</p>
              </div>
              <div className="flex min-h-[88px] flex-col justify-between rounded-[18px] border border-[#E4ECF8] bg-[#F8FBFF] px-4 py-3.5">
                <p className="text-[12px] font-medium leading-none text-[#8EA3BB]">保障额度</p>
                <p className="mt-3 text-[18px] font-semibold leading-7 text-[#0F172A]">{formatCoverageAmount(Number(policy.amount || 0))}</p>
              </div>
              <div className="flex min-h-[88px] flex-col justify-between rounded-[18px] border border-[#E4ECF8] bg-[#F8FBFF] px-4 py-3.5">
                <p className="text-[12px] font-medium leading-none text-[#8EA3BB]">保单生效日</p>
                <p className="mt-3 text-[18px] font-semibold leading-7 text-[#0F172A]">{policy.periodStart || '-'}</p>
              </div>
            </div>

          </div>
        </div>
      ))}
    </div>
  );
}

function formatCoverageAmount(value: number) {
  const amount = Number(value || 0);
  if (!amount) return '-';
  return `${(amount / 10000).toFixed(2)}万`;
}

function formatCurrency(value: number) {
  const amount = Number(value || 0);
  if (!amount) return '¥0';
  return `¥${amount.toLocaleString('zh-CN')}`;
}
