import { callOrderWriteoff } from '../repositories/b-order-writeoff.repository.mjs';

export const executeBOrderWriteoff = async (command) => callOrderWriteoff({ command });
