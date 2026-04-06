import React, { useState } from 'react';
import { ChevronLeft, Camera, CheckCircle2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../lib/api';
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
} from '../../lib/policyFormOptions';
import { showApiError } from '../../lib/ui-error';
import SuggestionInput from './SuggestionInput';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UploadPolicy({ onClose, onSuccess }: Props) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    applicant: '',
    applicantRelation: '',
    insured: '',
    insuredRelation: '',
    date: '',
    paymentPeriod: '',
    coveragePeriod: '',
    amount: '',
    firstPremium: '',
  });
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [recognizedOcrText, setRecognizedOcrText] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof api.analyzeInsurancePolicy>>['analysis'] | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const companyOptions = React.useMemo(() => buildPolicyCompanyOptions(formData.company), [formData.company, historyTick]);
  const nameOptions = React.useMemo(() => buildPolicyNameOptions(formData.name), [formData.name, historyTick]);
  const relationOptions = React.useMemo(
    () => buildPolicyRelationOptions(formData.applicantRelation || formData.insuredRelation),
    [formData.applicantRelation, formData.insuredRelation, historyTick],
  );
  const paymentPeriodOptions = React.useMemo(() => buildPolicyPaymentPeriodOptions(formData.paymentPeriod), [formData.paymentPeriod, historyTick]);
  const coveragePeriodOptions = React.useMemo(() => buildPolicyCoveragePeriodOptions(formData.coveragePeriod), [formData.coveragePeriod, historyTick]);
  const amountError = validatePositiveNumberInput(formData.amount);
  const firstPremiumError = validatePositiveNumberInput(formData.firstPremium);
  const paymentPeriodError = formData.paymentPeriod && !isValidPolicyPaymentPeriod(formData.paymentPeriod) ? '请输入趸交或如 10年交' : '';
  const coveragePeriodError = formData.coveragePeriod && !isValidPolicyCoveragePeriod(formData.coveragePeriod) ? '请输入终身、30年或至70岁' : '';
  const canSubmit = Boolean(
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
      const resp = await api.scanPolicy({ uploadItem });
      setRecognizedOcrText(String(resp.ocrText || ''));
      setAnalysis(null);
      setAnalysisError('');
      setFormData({
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
      const resp = await api.analyzeInsurancePolicy({
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
      setAnalysisError(e?.message || '保单责任分析失败，请稍后重试');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!canSubmit) {
      alert('请先填写完整保单信息，并选择投保人与被保险人与录入人的关系');
      return;
    }
    setLoading(true);
    try {
      const normalizedCompany = normalizePolicyCompany(formData.company);
      const normalizedPaymentPeriod = normalizePolicyPaymentPeriod(formData.paymentPeriod);
      const normalizedCoveragePeriod = normalizePolicyCoveragePeriod(formData.coveragePeriod);
      await api.createPolicy({
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
      });
      rememberPolicyFormValues({
        company: normalizedCompany,
        name: formData.name,
        applicantRelation: formData.applicantRelation,
        insuredRelation: formData.insuredRelation,
        paymentPeriod: normalizedPaymentPeriod,
        coveragePeriod: normalizedCoveragePeriod,
      });
      setHistoryTick((prev) => prev + 1);
      alert('保单提交成功！');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      showApiError(e, '提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">上传保单</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto pb-36">
        <section className="p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">拍照自动识别</h2>
            <p className="text-slate-500 text-xs mt-1">系统将自动提取保单关键信息，省时省力</p>
          </div>
          <div
            onClick={handleScanClick}
            className="w-full aspect-[2/1] rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
              <Camera size={28} />
            </div>
            <span className="text-base font-bold text-blue-600">{scanning ? '正在识别中...' : '点击拍照上传'}</span>
            <p className="text-xs text-blue-400">
              {selectedFileName ? `已选择：${selectedFileName}` : '支持纸质保单拍照或相册图片'}
            </p>

            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl"></div>
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr"></div>
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl"></div>
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br"></div>
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

        <div className="flex items-center gap-4 px-4 py-2">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-slate-400 text-xs font-medium">或 手动输入详情</span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <form className="p-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保险公司</label>
              <SuggestionInput
                value={formData.company}
                onChange={(value) => handleFieldChange('company', value)}
                onBlur={() => handleFieldChange('company', normalizePolicyCompany(formData.company))}
                options={companyOptions}
                placeholder="输入保险公司，可模糊匹配"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保险名称</label>
              <SuggestionInput
                value={formData.name}
                onChange={(value) => handleFieldChange('name', value)}
                options={nameOptions}
                placeholder="输入保单上的险种全称"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">投保人</label>
              <input
                type="text"
                value={formData.applicant}
                onChange={(e) => handleFieldChange('applicant', e.target.value)}
                placeholder="姓名"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <label className="mt-3 block text-xs font-bold text-slate-500 mb-1.5">投保人与录入人的关系</label>
              <SuggestionInput
                value={formData.applicantRelation}
                onChange={(value) => handleFieldChange('applicantRelation', value)}
                options={relationOptions}
                placeholder="输入关系，可直接新增"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">被保险人</label>
              <input
                type="text"
                value={formData.insured}
                onChange={(e) => handleFieldChange('insured', e.target.value)}
                placeholder="姓名"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <label className="mt-3 block text-xs font-bold text-slate-500 mb-1.5">被保险人与录入人的关系</label>
              <SuggestionInput
                value={formData.insuredRelation}
                onChange={(value) => handleFieldChange('insuredRelation', value)}
                options={relationOptions}
                placeholder="输入关系，可直接新增"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">投保时间</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleFieldChange('date', e.target.value)}
              className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">缴费期间</label>
              <SuggestionInput
                value={formData.paymentPeriod}
                onChange={(value) => handleFieldChange('paymentPeriod', value)}
                onBlur={() => handleFieldChange('paymentPeriod', normalizePolicyPaymentPeriod(formData.paymentPeriod))}
                options={paymentPeriodOptions}
                placeholder="如 10年交 或 趸交"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {paymentPeriodError ? <p className="mt-1.5 text-xs text-rose-500">{paymentPeriodError}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保障期间</label>
              <SuggestionInput
                value={formData.coveragePeriod}
                onChange={(value) => handleFieldChange('coveragePeriod', value)}
                onBlur={() => handleFieldChange('coveragePeriod', normalizePolicyCoveragePeriod(formData.coveragePeriod))}
                options={coveragePeriodOptions}
                placeholder="如 终身、30年、至70岁"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {coveragePeriodError ? <p className="mt-1.5 text-xs text-rose-500">{coveragePeriodError}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">保额 (元)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.amount}
                onChange={(e) => handleFieldChange('amount', sanitizePositiveNumberInput(e.target.value))}
                placeholder="0.00"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm font-semibold focus:border-blue-500 focus:ring-blue-500"
              />
              {amountError ? <p className="mt-1.5 text-xs text-rose-500">{amountError}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">首期保费 (元)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.firstPremium}
                onChange={(e) => handleFieldChange('firstPremium', sanitizePositiveNumberInput(e.target.value))}
                placeholder="0.00"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm font-semibold focus:border-blue-500 focus:ring-blue-500"
              />
              {firstPremiumError ? <p className="mt-1.5 text-xs text-rose-500">{firstPremiumError}</p> : null}
            </div>
          </div>

          <section className="rounded-2xl border border-blue-100 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">保单责任分析</h3>
                  <p className="text-xs text-slate-500 mt-1">只输出产品概述、核心特点、责任表格、免责条款和选购建议。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleAnalyzePolicy()}
                disabled={analysisLoading}
                className="shrink-0 px-4 h-9 rounded-xl bg-blue-500 text-white text-xs font-bold disabled:opacity-60"
              >
                {analysisLoading ? '分析中...' : analysis ? '重新分析' : '开始分析'}
              </button>
            </div>

            {analysisError ? <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{analysisError}</div> : null}

            {analysis ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-sm text-slate-900">产品概述</p>
                    <span className="text-[10px] text-slate-400">{analysis.cached ? '缓存结果' : '实时分析'}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-2 leading-6">{analysis.productOverview}</p>
                </div>

                <div className="rounded-xl border border-slate-100 px-4 py-3">
                  <p className="font-bold text-sm text-slate-900">核心特点</p>
                  <p className="text-sm text-slate-700 mt-2 leading-6">{analysis.coreFeature}</p>
                </div>

                {analysis.coverageTable.length ? (
                  <div className="space-y-2">
                    <p className="font-bold text-sm text-slate-900">核心保障一览</p>
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
                    <p className="font-bold text-sm text-slate-900">保前必看免责条款</p>
                    {analysis.exclusions.map((item, idx) => (
                      <div key={`${item}-${idx}`} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-700">
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="font-bold text-sm text-slate-900">选购建议</p>
                  <p className="text-sm text-blue-700 mt-2 leading-6 whitespace-pre-line">{analysis.purchaseAdvice}</p>
                </div>

                <p className="text-[11px] text-slate-400 leading-5">{analysis.disclaimer}</p>
              </div>
            ) : null}
          </section>
        </form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-slate-100 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <p className="mb-3 text-center text-xs text-slate-500">填写完成后请点击下方按钮保存保单</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            type="button"
            className="h-12 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 active:scale-[0.98] transition-transform"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="h-12 flex-[1.4] bg-blue-500 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <CheckCircle2 size={20} />
            {loading ? '保存中...' : '保存保单'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
