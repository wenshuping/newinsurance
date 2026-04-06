import {
  callPRebuildStats,
  callPRefundOrder,
  callPRunReconciliation,
} from '../repositories/p-ops-write.repository.mjs';

export const executePRefundOrder = async (command) => callPRefundOrder({ command });

export const executePRebuildStats = async (command) => callPRebuildStats({ command });

export const executePRunReconciliation = async (command) => callPRunReconciliation({ command });
