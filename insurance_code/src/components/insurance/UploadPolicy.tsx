import React, { useState } from 'react';
import { ChevronLeft, Camera, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { NOTICE_COPY } from '../../lib/noticeCopy';
import { ACTION_COPY } from '../../lib/uiCopy';

interface Props {
  onClose: () => void;
}

export default function UploadPolicy({ onClose }: Props) {
  const [formData, setFormData] = useState({
    company: '',
    name: '',
    applicant: '',
    insured: '',
    date: '',
    paymentPeriod: ACTION_COPY.cUploadPayPeriod20Years,
    coveragePeriod: ACTION_COPY.cUploadCoverageLifelong,
    amount: '',
    firstPremium: ''
  });

  const handleScan = () => {
    // Simulate OCR
    alert(NOTICE_COPY.cCameraScanStarting);
    setTimeout(() => {
      setFormData({
        company: ACTION_COPY.cUploadCompanyOptionPingan,
        name: ACTION_COPY.cUploadDemoPolicyName,
        applicant: ACTION_COPY.cUploadDemoApplicantName,
        insured: ACTION_COPY.cUploadDemoInsuredName,
        date: '2024-02-20',
        paymentPeriod: ACTION_COPY.cUploadPayPeriod20Years,
        coveragePeriod: ACTION_COPY.cUploadCoverageLifelong,
        amount: '500000',
        firstPremium: '12000'
      });
    }, 1500);
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
        <h1 className="text-lg font-bold">{ACTION_COPY.cUploadPolicyTitle}</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* OCR Section */}
        <section className="p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold">{ACTION_COPY.cUploadOcrTitle}</h2>
            <p className="text-slate-500 text-xs mt-1">{ACTION_COPY.cUploadOcrHint}</p>
          </div>
          <div 
            onClick={handleScan}
            className="w-full aspect-[2/1] rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
              <Camera size={28} />
            </div>
            <span className="text-base font-bold text-blue-600">{ACTION_COPY.cUploadClickPhoto}</span>
            <p className="text-xs text-blue-400">{ACTION_COPY.cUploadPhotoHint}</p>
            
            {/* Corners */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl"></div>
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr"></div>
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl"></div>
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br"></div>
          </div>
        </section>

        <div className="flex items-center gap-4 px-4 py-2">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-slate-400 text-xs font-medium">{ACTION_COPY.cUploadOrManual}</span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        {/* Form */}
        <form className="p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadCompanyLabel}</label>
              <select 
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">{ACTION_COPY.cUploadCompanyPlaceholder}</option>
                <option>{ACTION_COPY.cUploadCompanyOptionPingan}</option>
                <option>{ACTION_COPY.cUploadCompanyOptionGuoshou}</option>
                <option>{ACTION_COPY.cUploadCompanyOptionPacific}</option>
                <option>{ACTION_COPY.cUploadCompanyOptionAia}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadPolicyNameLabel}</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder={ACTION_COPY.cUploadPolicyNamePlaceholder}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadApplicantLabel}</label>
              <input 
                type="text" 
                value={formData.applicant}
                onChange={e => setFormData({...formData, applicant: e.target.value})}
                placeholder={ACTION_COPY.cUploadNamePlaceholder}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadInsuredLabel}</label>
              <input 
                type="text" 
                value={formData.insured}
                onChange={e => setFormData({...formData, insured: e.target.value})}
                placeholder={ACTION_COPY.cUploadNamePlaceholder}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadDateLabel}</label>
            <input 
              type="date" 
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
              className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadPayPeriodLabel}</label>
              <select 
                value={formData.paymentPeriod}
                onChange={e => setFormData({...formData, paymentPeriod: e.target.value})}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option>{ACTION_COPY.cUploadPayPeriodSingle}</option>
                <option>{ACTION_COPY.cUploadPayPeriod5Years}</option>
                <option>{ACTION_COPY.cUploadPayPeriod10Years}</option>
                <option>{ACTION_COPY.cUploadPayPeriod20Years}</option>
                <option>{ACTION_COPY.cUploadPayPeriod30Years}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadCoveragePeriodLabel}</label>
              <select 
                value={formData.coveragePeriod}
                onChange={e => setFormData({...formData, coveragePeriod: e.target.value})}
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option>{ACTION_COPY.cUploadCoverageLifelong}</option>
                <option>{ACTION_COPY.cUploadCoverage20Years}</option>
                <option>{ACTION_COPY.cUploadCoverage30Years}</option>
                <option>{ACTION_COPY.cUploadCoverageTo70}</option>
                <option>{ACTION_COPY.cUploadCoverageTo80}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadAmountLabel}</label>
              <input 
                type="number" 
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm font-semibold focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{ACTION_COPY.cUploadFirstPremiumLabel}</label>
              <input 
                type="number" 
                value={formData.firstPremium}
                onChange={e => setFormData({...formData, firstPremium: e.target.value})}
                placeholder="0.00"
                className="w-full rounded-xl border-slate-200 bg-white px-4 py-3 text-sm font-semibold focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => {
            alert(NOTICE_COPY.cPolicySubmitSuccess);
            onClose();
          }}
          className="w-full bg-blue-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={20} />
          {ACTION_COPY.cUploadSubmit}
        </button>
      </div>
    </motion.div>
  );
}
