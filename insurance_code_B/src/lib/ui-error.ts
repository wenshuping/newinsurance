import { resolveApiErrorMessage } from '@contracts/error-ui';

type ErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

export function getApiErrorMessage(error: ErrorLike, fallback: string) {
  return resolveApiErrorMessage(
    {
      code: error?.code,
      message: error?.message,
      status: error?.status,
    },
    fallback
  );
}

export function showApiError(error: ErrorLike, fallback: string) {
  alert(getApiErrorMessage(error, fallback));
}
