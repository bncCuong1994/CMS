export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: string[];

  constructor(status: number, code: ApiErrorCode, message: string, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const DEFAULT_MESSAGES: Record<number | string, string> = {
  400: 'Dữ liệu không hợp lệ',
  401: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  403: 'Bạn không có quyền thực hiện việc này',
  404: 'Không tìm thấy dữ liệu',
  409: 'Dữ liệu đã tồn tại',
  422: 'Dữ liệu không hợp lệ',
  429: 'Bạn thao tác quá nhanh, thử lại sau',
};

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'TOO_MANY_REQUESTS';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

function defaultMessageFromStatus(status: number): string {
  return DEFAULT_MESSAGES[status] ?? (status >= 500 ? 'Máy chủ gặp lỗi, thử lại sau' : 'Có lỗi xảy ra, thử lại sau');
}

/**
 * Chuyển bất kỳ lỗi nào (AxiosError, Error, giá trị lạ) thành ApiError.
 * Lỗi lọt ra khỏi lib/api.ts luôn là ApiError, không bao giờ là AxiosError thô.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  // AxiosError có shape { isAxiosError, code, response, config }
  if (isAxiosError(error)) {
    // Timeout: axios đặt code = 'ECONNABORTED'
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
      return new ApiError(0, 'TIMEOUT', 'Máy chủ phản hồi quá lâu, thử lại sau');
    }

    // Không có response = lỗi mạng
    if (!error.response) {
      return new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ');
    }

    const { status, data } = error.response as { status: number; data: unknown };
    return buildFromStatusAndBody(status, data);
  }

  if (error instanceof Error) {
    return new ApiError(0, 'UNKNOWN', error.message || 'Có lỗi xảy ra, thử lại sau');
  }

  return new ApiError(0, 'UNKNOWN', 'Có lỗi xảy ra, thử lại sau');
}

function buildFromStatusAndBody(status: number, body: unknown): ApiError {
  const code = codeFromStatus(status);
  const raw = (body as Record<string, unknown> | null | undefined)?.message;

  if (Array.isArray(raw) && raw.length > 0) {
    const details = raw.map(String);
    return new ApiError(status, code, details.join(', '), details);
  }

  if (typeof raw === 'string' && raw.trim()) {
    return new ApiError(status, code, raw);
  }

  return new ApiError(status, code, defaultMessageFromStatus(status));
}

interface AxiosErrorShape {
  isAxiosError: boolean;
  code?: string;
  response?: unknown;
}

function isAxiosError(err: unknown): err is AxiosErrorShape & Error {
  return err instanceof Error && (err as unknown as AxiosErrorShape).isAxiosError === true;
}
