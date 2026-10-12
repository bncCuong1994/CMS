/**
 * Bổ sung ca còn thiếu trong api-error.test.ts (16 test của dev).
 * Soát bảng mapping trong US-WEB-01: 429, nhánh còn lại (UNKNOWN),
 * và các ca biên quan trọng.
 */
import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './api-error';

function makeAxiosError(overrides: {
  code?: string;
  response?: { status: number; data: unknown };
}): Error & { isAxiosError: boolean; code?: string; response?: unknown } {
  const err = new Error('axios error') as Error & {
    isAxiosError: boolean;
    code?: string;
    response?: unknown;
  };
  err.isAxiosError = true;
  if (overrides.code !== undefined) err.code = overrides.code;
  if (overrides.response !== undefined) err.response = overrides.response;
  return err;
}

describe('toApiError — ca biên bảng mapping còn thiếu', () => {
  // ── 422 chưa có trong test gốc (chỉ có 400) ──────────────────────────
  it('422 → VALIDATION_ERROR với message mặc định', () => {
    const err = toApiError(makeAxiosError({ response: { status: 422, data: {} } }));
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Dữ liệu không hợp lệ');
  });

  // ── 429 đã có nhưng chỉ assert code, chưa assert message ─────────────
  it('429 → TOO_MANY_REQUESTS với message mặc định', () => {
    const err = toApiError(makeAxiosError({ response: { status: 429, data: {} } }));
    expect(err.status).toBe(429);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
    expect(err.message).toBe('Bạn thao tác quá nhanh, thử lại sau');
  });

  // ── nhánh >= 500 với code khác 500 (vd 503) ──────────────────────────
  it('503 → SERVER_ERROR với message mặc định', () => {
    const err = toApiError(makeAxiosError({ response: { status: 503, data: {} } }));
    expect(err.status).toBe(503);
    expect(err.code).toBe('SERVER_ERROR');
    expect(err.message).toBe('Máy chủ gặp lỗi, thử lại sau');
  });

  // ── nhánh "còn lại" UNKNOWN: status 4xx không thuộc bảng (vd 418) ────
  it('418 → UNKNOWN với message mặc định "Có lỗi xảy ra, thử lại sau"', () => {
    const err = toApiError(makeAxiosError({ response: { status: 418, data: {} } }));
    expect(err.status).toBe(418);
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Có lỗi xảy ra, thử lại sau');
  });

  // ── body rỗng {} (đã có test gốc cho 400 nhưng chưa có cho 500) ──────
  it('500 body rỗng {} → SERVER_ERROR message mặc định', () => {
    const err = toApiError(makeAxiosError({ response: { status: 500, data: {} } }));
    expect(err.status).toBe(500);
    expect(err.code).toBe('SERVER_ERROR');
    expect(err.message).toBe('Máy chủ gặp lỗi, thử lại sau');
    expect(err.details).toBeUndefined();
  });

  // ── body null ─────────────────────────────────────────────────────────
  it('body null (nginx HTML trả sai content-type, axios parse thành null) → dùng message mặc định', () => {
    const err = toApiError(makeAxiosError({ response: { status: 503, data: null } }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('SERVER_ERROR');
    expect(err.message).toBe('Máy chủ gặp lỗi, thử lại sau');
  });

  // ── body là string HTML (nginx/proxy 502 không parse được JSON) ───────
  it('body là string HTML → dùng message mặc định, không crash', () => {
    const err = toApiError(
      makeAxiosError({ response: { status: 502, data: '<html>Bad Gateway</html>' } }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBe('SERVER_ERROR');
    expect(err.message).toBe('Máy chủ gặp lỗi, thử lại sau');
  });

  // ── message là mảng RỖNG → không dùng details, dùng message mặc định ─
  it('message là mảng rỗng [] → dùng message mặc định (không join chuỗi rỗng)', () => {
    const err = toApiError(
      makeAxiosError({ response: { status: 400, data: { message: [] } } }),
    );
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Dữ liệu không hợp lệ');
    expect(err.details).toBeUndefined();
  });

  // ── throw null (giá trị lạ không phải Error) ─────────────────────────
  it('throw null → ApiError UNKNOWN', () => {
    const err = toApiError(null);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Có lỗi xảy ra, thử lại sau');
  });

  // ── throw 0 (falsy non-null) ──────────────────────────────────────────
  it('throw 0 → ApiError UNKNOWN', () => {
    const err = toApiError(0);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNKNOWN');
  });

  // ── throw số → UNKNOWN ────────────────────────────────────────────────
  it('throw số → ApiError UNKNOWN', () => {
    const err = toApiError(42);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNKNOWN');
  });

  // ── 404 assert đủ ba trường (test gốc chỉ assert status + code) ──────
  it('404 → NOT_FOUND message mặc định', () => {
    const err = toApiError(makeAxiosError({ response: { status: 404, data: {} } }));
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Không tìm thấy dữ liệu');
  });

  // ── ERR_CANCELED (axios cancel) → TIMEOUT, cùng nhánh ECONNABORTED ───
  it('ERR_CANCELED → TIMEOUT (axios cancel token)', () => {
    const err = toApiError(makeAxiosError({ code: 'ERR_CANCELED' }));
    expect(err.status).toBe(0);
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toBe('Máy chủ phản hồi quá lâu, thử lại sau');
  });

  // ── message là số (kiểu lạ từ backend) → không crash, dùng mặc định ──
  it('message là số (kiểu không mong đợi từ backend) → dùng message mặc định', () => {
    const err = toApiError(
      makeAxiosError({ response: { status: 400, data: { message: 12345 } } }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
    // Số không phải string và không phải array → rơi vào nhánh mặc định
    expect(err.message).toBe('Dữ liệu không hợp lệ');
  });

  // ── Error thường không có message → UNKNOWN với fallback ─────────────
  it('Error không có message → UNKNOWN với fallback "Có lỗi xảy ra, thử lại sau"', () => {
    const err = toApiError(new Error(''));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Có lỗi xảy ra, thử lại sau');
  });
});
