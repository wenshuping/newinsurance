import React from 'react';
import { type PCustomer, type PEmployee } from '../lib/api';

type Props = {
  customers: PCustomer[];
  employees: PEmployee[];
  assigningCustomerId: number | null;
  selectedAgentByCustomerId: Record<number, string>;
  onSelectAgent: (customerId: number, agentId: string) => void;
  onAssign: (customerId: number) => Promise<void>;
};

function roleLabel(value?: string) {
  const role = String(value || '').toLowerCase();
  if (role === 'manager') return '管理员';
  if (role === 'support' || role === 'team_lead') return '组长';
  if (role === 'agent' || role === 'salesperson') return '业务员';
  return '员工';
}

export function buildAssignableTenantOptions(employees: PEmployee[]) {
  const seen = new Set<string>();
  return employees.reduce<Array<{ tenantId: string; tenantName: string }>>((acc, row) => {
    const tenantId = String(row?.tenantId || '').trim();
    if (!tenantId || seen.has(tenantId)) return acc;
    seen.add(tenantId);
    acc.push({
      tenantId,
      tenantName: String(row?.tenantName || `租户${tenantId}`),
    });
    return acc;
  }, []);
}

export function filterAssignableEmployeesByTenant(employees: PEmployee[], tenantId: string) {
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedTenantId) return [];
  return employees.filter((row) => String(row?.tenantId || '') === normalizedTenantId);
}

export function PublicCustomerPoolPage({
  customers,
  employees,
  assigningCustomerId,
  selectedAgentByCustomerId,
  onSelectAgent,
  onAssign,
}: Props) {
  const [pickerCustomerId, setPickerCustomerId] = React.useState<number | null>(null);
  const [selectedTenantByCustomerId, setSelectedTenantByCustomerId] = React.useState<Record<number, string>>({});
  const directPoolCustomers = customers.filter(
    (row) => String(row.poolStatus || '') === 'unassigned' && String(row.acquisitionSource || '') === 'direct',
  );
  const assignableEmployees = employees.filter((row) => ['manager', 'support', 'team_lead', 'agent', 'salesperson'].includes(String(row.role || '').toLowerCase()));
  const employeeById = new Map(assignableEmployees.map((row) => [String(row.id), row]));
  const tenantOptions = buildAssignableTenantOptions(assignableEmployees);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-10 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">公共客户池</h2>
            <p className="text-gray-500 text-sm mt-1">只展示自然注册且暂未分配给业务员的客户，可在此直接分配归属。</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-500">公共池客户</p>
            <p className="mt-2 text-3xl font-black text-gray-900">{directPoolCustomers.length}</p>
            <p className="mt-2 text-xs text-gray-400">来源：自然注册 / 直接注册</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-500">可分配员工</p>
            <p className="mt-2 text-3xl font-black text-gray-900">{assignableEmployees.length}</p>
            <p className="mt-2 text-xs text-gray-400">业务员、组长、管理员均可承接</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-medium text-gray-500">已分配客户</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {customers.filter((row) => String(row.poolStatus || '') === 'assigned').length}
            </p>
            <p className="mt-2 text-xs text-gray-400">当前可见范围内已有归属的客户</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">待分配客户列表</h3>
              <p className="text-sm text-gray-500 mt-1">客户直接从 C 端实名进入，但没有通过分享链路绑定业务员时，会进入这里，平台运营可跨租户分配。</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              共 {directPoolCustomers.length} 位
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1080px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">客户</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">手机号</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">所属租户</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">来源</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">当前状态</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">分配给</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {directPoolCustomers.map((row) => {
                  const selectedAgent = String(selectedAgentByCustomerId[Number(row.id)] || '');
                  const isAssigning = Number(assigningCustomerId || 0) === Number(row.id);
                  const isPickerOpen = Number(pickerCustomerId || 0) === Number(row.id);
                  const selectedEmployee = employeeById.get(selectedAgent) || null;
                  const selectedTenantId =
                    String(selectedTenantByCustomerId[Number(row.id)] || '').trim() ||
                    String(selectedEmployee?.tenantId || row.tenantId || '').trim();
                  const selectedTenantOption = tenantOptions.find((option) => option.tenantId === selectedTenantId) || null;
                  const filteredEmployees = filterAssignableEmployeesByTenant(assignableEmployees, selectedTenantId);
                  const selectedEmployeeLabel = selectedEmployee
                    ? `${selectedEmployee.name} · ${selectedEmployee.tenantName || `租户${selectedEmployee.tenantId || '-'}`} · ${roleLabel(selectedEmployee.role)} · ${selectedEmployee.teamName || `团队${selectedEmployee.teamId || '-'}`}`
                    : '';
                  const pickerSummary = selectedEmployeeLabel || (selectedTenantOption ? `${selectedTenantOption.tenantName} · 请选择员工` : '先选租户，再选员工');
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{row.name || `客户${row.id}`}</div>
                        <div className="mt-1 text-xs text-gray-400">客户ID {row.id}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{row.mobile || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          {row.tenantName || `租户 ${row.tenantId || '-'}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          自然注册
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          待分配
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isPickerOpen ? (
                          <div className="min-w-[280px] space-y-2">
                            <select
                              value={selectedTenantId}
                              onChange={(event) => {
                                const nextTenantId = String(event.target.value || '').trim();
                                setSelectedTenantByCustomerId((prev) => ({
                                  ...prev,
                                  [Number(row.id)]: nextTenantId,
                                }));
                                if (selectedEmployee && String(selectedEmployee.tenantId || '') !== nextTenantId) {
                                  onSelectAgent(Number(row.id), '');
                                }
                              }}
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                            >
                              <option value="">请选择租户</option>
                              {tenantOptions.map((tenant) => (
                                <option key={tenant.tenantId} value={tenant.tenantId}>
                                  {tenant.tenantName}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedAgent}
                                disabled={!selectedTenantId}
                                onChange={(event) => {
                                  const nextAgentId = event.target.value;
                                  onSelectAgent(Number(row.id), nextAgentId);
                                  if (nextAgentId) setPickerCustomerId(null);
                                }}
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-gray-100"
                              >
                                <option value="">{selectedTenantId ? '请选择员工' : '请先选择租户'}</option>
                                {filteredEmployees.map((employee) => (
                                  <option key={employee.id} value={String(employee.id)}>
                                    {employee.name} · {roleLabel(employee.role)} · {employee.teamName || `团队${employee.teamId || '-'}`}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setPickerCustomerId(null)}
                                className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                              >
                                收起
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isAssigning}
                            onClick={() => setPickerCustomerId(Number(row.id))}
                            className="w-full min-w-[220px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 outline-none transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                          >
                            <span className={selectedEmployeeLabel ? 'font-medium text-gray-900' : 'text-gray-500'}>
                              {pickerSummary}
                            </span>
                            <span className="ml-2 text-xs text-gray-400">{selectedEmployeeLabel ? '重新选择' : '展开选择'}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          disabled={!selectedAgent || isAssigning}
                          onClick={() => onAssign(Number(row.id))}
                          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
                        >
                          {isAssigning ? '分配中...' : '确认分配'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {directPoolCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                      当前没有待分配的自然注册客户
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
