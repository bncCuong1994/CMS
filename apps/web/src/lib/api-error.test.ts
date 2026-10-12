import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './api-error';

function makeAxiosError(overrides: {
  code?: string;
  response?: { status: number; data: unknown };
}): Error & { isAxiosError: boolean; code?: string; response?: unknown } {
  const err = new Error('axios error') as Error & { isAxiosError: boolean; code?: string; response?: unknown };
  err.isAxiosError = true;
  if (overrides.code !== undefined) err.code = overrides.code;
  if (overrides.response !== undefined) err.response = overrides.response;
  return err;
}

describe('toApiError', () => {
  it('trả lại ApiError gốc nếu đã là ApiError', () => {
    const original = new ApiError(404, 'NOT_FOUND', 'Không tìm thấy');
    expect(toApiError(original)).toBe(original);
  });

  it('TIMEOUT khi axios code = ECONNABORTED', () => {
    const err = toApiError(makeAxiosError({ code: 'ECONNABORTED' }));
    expect(err.status).toBe(0);
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toBe('Máy chủ phản hồi quá lâu, thử lại sau');
  });

  it('NETWORK_ERROR khi không có response', () => {
    const err = toApiError(makeAxiosError({}));
    expect(err.status).toBe(0);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.message).toBe('Không kết nối được máy chủ');
  });

  it('400 → VALIDATION_ERROR với message mặc định khi body trống', () => {
    const err = toApiError(makeAxiosError({ response: { status: 400, data: {} } }));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Dữ liệu không hợp lệ');
  });

  it('401 → UNAUTHORIZED', () => {
    const err = toApiError(makeAxiosError({ response: { status: 401, data: {} } }));
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  });

  it('403 → FORBIDDEN', () => {
    const err = toApiError(makeAxiosError({ response: { status: 403, data: {} } }));
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Bạn không có quyền thực hiện việc này');
  });

  it('404 → NOT_FOUND', () => {
    const err = toApiError(makeAxiosError({ response: { status: 404, data: {} } }));
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('409 → CONFLICT', () => {
    const err = toApiError(makeAxiosError({ response: { status: 409, data: {} } }));
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Dữ liệu đã tồn tại');
  });

  it('429 → TOO_MANY_REQUESTS', () => {
    const err = toApiError(makeAxiosError({ response: { status: 429, data: {} } }));
    expect(err.status).toBe(429);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });

  it('500 → SERVER_ERROR', () => {
    const err = toApiError(makeAxiosError({ response: { status: 500, data: {} } }));
    expect(err.status).toBe(500);
    expect(err.code).toBe('SERVER_ERROR');
    expect(err.message).toBe('Máy chủ gặp lỗi, thử lại sau');
  });

  it('AC4: giữ nguyên message string từ backend (không thay bằng mặc định)', () => {
    const err = toApiError(makeAxiosError({ response: { status: 409, data: { message: 'Email đã được sử dụng' } } }));
    expect(err.message).toBe('Email đã được sử dụng');
    expect(err.details).toBeUndefined();
  });

  it('AC5: message mảng → join và lưu details', () => {
    const err = toApiError(makeAxiosError({
      response: { status: 400, data: { message: ['email không hợp lệ', 'password quá ngắn'] } },
    }));
    expect(err.message).toBe('email không hợp lệ, password quá ngắn');
    expect(err.details).toEqual(['email không hợp lệ', 'password quá ngắn']);
  });

  it('body rỗng/null vẫn trả ApiError', () => {
    const err = toApiError(makeAxiosError({ response: { status: 422, data: null } }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('Error thường → UNKNOWN', () => {
    const err = toApiError(new Error('Lỗi bất ngờ'));
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Lỗi bất ngờ');
  });

  it('giá trị không phải Error → UNKNOWN', () => {
    const err = toApiError('chuỗi lạ');
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNKNOWN');
  });

  it('403 với message backend → dùng message backend', () => {
    const err = toApiError(makeAxiosError({ response: { status: 403, data: { message: 'Thiếu phòng ban' } } }));
    expect(err.message).toBe('Thiếu phòng ban');
    expect(err.code).toBe('FORBIDDEN');
  });
});
