import { runInStateTransaction } from '../common/state.mjs';
import { touchUser } from '../repositories/user-write.repository.mjs';

export const executeTouchMe = async (command) =>
  runInStateTransaction(async () => {
    touchUser({ user: command.user, userAgent: command.userAgent });
    command.persistState();
    return { ok: true };
  });
