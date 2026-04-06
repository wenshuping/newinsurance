import React, { useCallback, useState } from 'react';
import { Shield, Search, Bell, Plus, Sparkles } from 'lucide-react';
import OverviewTab from '../components/insurance/OverviewTab';
import PolicyListTab from '../components/insurance/PolicyListTab';
import UploadPolicy from '../components/insurance/UploadPolicy';
import PolicyDetail from '../components/insurance/PolicyDetail';
import FamilyPolicyReportSheet from '../components/insurance/FamilyPolicyReportSheet';
import { api, type InsurancePolicy } from '../lib/api';

export default function InsuranceManagement() {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [showFamilyReport, setShowFamilyReport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPolicies = useCallback(async () => {
    const resp = await api.insurancePolicies();
    return resp.policies || [];
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-500" size={24} />
          <h1 className="text-xl font-bold tracking-tight">保障管理</h1>
        </div>
        <div className="flex gap-3">
          <button className="p-2 hover:bg-blue-50 rounded-full transition-colors">
            <Search size={20} />
          </button>
          <button className="p-2 hover:bg-blue-50 rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowFamilyReport(true)}
            className="w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-400 p-5 text-left text-white shadow-[0_18px_40px_-18px_rgba(14,165,233,0.75)] transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Family Insight</p>
                <h2 className="mt-2 text-2xl font-black leading-tight">保单分析</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
                  一键把已录入保单整理成家庭保障体检报告，直接看保障结构、缺口和下一步建议。
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <Sparkles size={28} />
              </div>
            </div>
            <div className="mt-5 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-black text-sky-600">
              立即查看
            </div>
          </button>
        </div>
        <OverviewTab refreshKey={refreshKey} />
        <section className="px-4 pb-4">
          <PolicyListTab onSelectPolicy={setSelectedPolicy} refreshKey={refreshKey} />
        </section>
      </main>

      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-transform z-30"
      >
        <Plus size={32} />
      </button>

      {showUpload && (
        <UploadPolicy
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setRefreshKey((v) => v + 1);
          }}
        />
      )}
      {selectedPolicy && (
        <PolicyDetail
          policy={selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
          loadFamilyPolicies={loadPolicies}
          familyReportCustomerName="我的家庭"
        />
      )}
      {showFamilyReport ? (
        <FamilyPolicyReportSheet
          onClose={() => setShowFamilyReport(false)}
          loadPolicies={loadPolicies}
          customerName="我的家庭"
          scopeLabel="保障管理内已录入保单"
        />
      ) : null}
    </div>
  );
}
