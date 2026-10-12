/**
 * Bổ sung test cho http.ts — các lỗ chưa được bịt bởi http.test.ts (12 test của dev):
 *
 * - AC9 (toast dedup): dùng <Toaster /> thật của sonner, không mock sonner,
 *   kích hoạt nhiều request 401 song song, assert DOM chỉ có MỘT thông báo.
 * - AC14 (retry): mutation không retry; query lỗi 0/500 retry 1 lần;
 *   query lỗi 403/409 không retry.
 * - AC11/12/13 (query-client toast): dùng queryClient thật từ lib/query-client.ts.
 * - Ma trận 401 vs 403: 403 không xoá phiên, không gọi refresh, không retry.
 * - AC1: không còn fetch( trực tiếp trong src/ (chống hồi quy).
 */

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MutationObserver, QueryObserver } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/features/auth/auth-store';
import { ApiError } from './api-error';
import { http } from './http';
import { queryClient } from './query-client';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeResponse<T>(
  config: InternalAxiosRequestConfig,
  status: number,
  data: T,
): AxiosResponse<T> {
  return { status, data, headers: {}, config, statusText: String(status) };
}

function makeAdapter(
  handler: (config: InternalAxiosRequestConfig) => AxiosResponse | Promise<AxiosResponse>,
): AxiosAdapter {
  return async (config) => handler(config as InternalAxiosRequestConfig);
}

function makeAxiosErr(
  cfg: InternalAxiosRequestConfig,
  status: number,
  data: unknown = {},
): Error {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    config: cfg,
    response: makeResponse(cfg, status, data),
  });
}

const originalAdapter = http.defaults.adapter;

beforeEach(() => {
  useAuthStore.setState({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: null,
  });
  queryClient.clear();
});

afterEach(() => {
  http.defaults.adapter = originalAdapter;
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  queryClient.clear();
});

// ─── AC9: sonner dedup thật trong DOM ──────────────────────────────────────
describe('AC9 — sonner dedup trong DOM (Toaster that, khong mock sonner)', () => {
  it('nhieu request 401 song song + refresh that bai → chi MOT toast trong DOM', async () => {
    // Arrange: moi request deu 401 (ke ca /auth/refresh) → refresh that bai
    http.defaults.adapter = makeAdapter(async (cfg) => {
      throw makeAxiosErr(cfg, 401, {});
    });

    // Act: render Toaster that de kiem DOM
    render(<Toaster />);

    // Kich hoat 3 request song song, tat ca se that bai
    // Boc trong act de React xu ly du state update cua Toaster
    await act(async () => {
      await Promise.allSettled([
        http.get('/data/a'),
        http.get('/data/b'),
        http.get('/data/c'),
      ]);
    });

    // Assert: cho toast xuat hien, roi kiem chi co dung 1 trong DOM
    await waitFor(() => {
      const toasts = document.querySelectorAll('[data-sonner-toast]');
      expect(toasts.length).toBe(1);
    });

    // Noi dung dung
    const toasts = document.querySelectorAll('[data-sonner-toast]');
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toContain('hết hạn');

    // Phien da bi xoa
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

// ─── AC14: retry cho query va mutation ──────────────────────────────────────
describe('AC14 — retry dung cho', () => {
  it('mutation loi 500 → mutationFn duoc goi dung 1 lan (mutations: { retry: 0 })', async () => {
    // Arrange
    let callCount = 0;
    const mutationFn = vi.fn(async () => {
      callCount++;
      throw new ApiError(500, 'SERVER_ERROR', 'May chu gap loi, thu lai sau');
    });

    // Dung queryClient that (co mutations: { retry: 0 })
    const observer = new MutationObserver(queryClient, { mutationFn });

    // Act
    await act(async () => {
      await observer.mutate(undefined).catch(() => {});
    });

    // Assert: retry: 0 → dung 1 lan
    expect(callCount).toBe(1);
  });

  it('query loi status 0 → queryFn duoc goi 2 lan (1 + 1 retry)', async () => {
    // Arrange
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      throw new ApiError(0, 'NETWORK_ERROR', 'Khong ket noi duoc may chu');
    });

    // Dung queryClient that — defaultOptions.queries.retry = shouldRetry
    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['retry-net-err-test'],
        queryFn,
        retryDelay: 0,
      });
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'error') {
            unsub();
            resolve();
          }
        });
      });
    });

    // 1 lan goi dau + 1 lan retry = 2
    expect(callCount).toBe(2);
  });

  it('query loi 403 → queryFn duoc goi dung 1 lan (khong retry 4xx)', async () => {
    // Arrange
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      throw new ApiError(403, 'FORBIDDEN', 'Ban khong co quyen thuc hien viec nay');
    });

    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['no-retry-403-test'],
        queryFn,
        retryDelay: 0,
      });
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'error') {
            unsub();
            resolve();
          }
        });
      });
    });

    expect(callCount).toBe(1);
  });

  it('query loi 409 → queryFn duoc goi dung 1 lan (khong retry 4xx)', async () => {
    // Arrange
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount++;
      throw new ApiError(409, 'CONFLICT', 'Du lieu da ton tai');
    });

    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['no-retry-409-test'],
        queryFn,
        retryDelay: 0,
      });
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'error') {
            unsub();
            resolve();
          }
        });
      });
    });

    expect(callCount).toBe(1);
  });
});

// ─── AC11/12/13: query-client toast tap trung ────────────────────────────────
describe('AC11/12/13 — toast tap trung qua queryClient that (Toaster that)', () => {
  it('AC11: mutation loi khong co meta.skipErrorToast → toast xuat hien trong DOM', async () => {
    // Arrange
    render(<Toaster />);
    const mutationFn = async () => {
      throw new ApiError(500, 'SERVER_ERROR', 'Loi-server-ac11-no-skip');
    };
    const observer = new MutationObserver(queryClient, { mutationFn });

    // Act: boc act de Toaster xu ly state update dong bo voi React
    await act(async () => {
      await observer.mutate(undefined).catch(() => {});
    });

    // Assert
    await waitFor(() => {
      expect(screen.queryAllByText('Loi-server-ac11-no-skip').length).toBeGreaterThan(0);
    });
  });

  it('AC12: mutation khai meta.skipErrorToast → 0 toast', async () => {
    // Arrange
    render(<Toaster />);
    const mutationFn = async () => {
      throw new ApiError(409, 'CONFLICT', 'Loi-conflict-ac12-skip');
    };
    const observer = new MutationObserver(queryClient, {
      mutationFn,
      meta: { skipErrorToast: true },
    });

    // Act
    await act(async () => {
      await observer.mutate(undefined).catch(() => {});
    });

    // Assert: sau act, neu khong toast thi khong bao gio xuat hien
    expect(screen.queryAllByText('Loi-conflict-ac12-skip').length).toBe(0);
  });

  it('AC13: query loi lan dau (chua co data) → 0 toast', async () => {
    // Arrange
    render(<Toaster />);
    const queryFn = async () => {
      throw new ApiError(500, 'SERVER_ERROR', 'Loi-query-ac13-no-data');
    };

    // Act: cho error trong act
    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['ac13-no-data-test'],
        queryFn,
        retry: false,
      });
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'error') {
            unsub();
            resolve();
          }
        });
      });
    });

    // Assert: khong toast (man tu hien khoi loi inline)
    expect(screen.queryAllByText('Loi-query-ac13-no-data').length).toBe(0);
  });

  it('AC13: query da co data, refetch nen loi → 1 toast xuat hien trong DOM', async () => {
    // Arrange
    render(<Toaster />);
    let callCount = 0;
    const queryFn = async () => {
      callCount++;
      if (callCount === 1) return { value: 'data-cu' };
      throw new ApiError(500, 'SERVER_ERROR', 'Loi-refetch-ac13-has-data');
    };

    // Lan dau: lay data thanh cong
    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['ac13-has-data-test'],
        queryFn,
        retry: false,
        staleTime: 0,
      });
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'success') {
            unsub();
            resolve();
          }
        });
      });
    });

    // Refetch nen → loi → toast
    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['ac13-has-data-test'],
        queryFn,
        retry: false,
        staleTime: 0,
      });
      observer.refetch();
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'error') {
            unsub();
            resolve();
          }
        });
      });
    });

    // Assert: toast xuat hien (query da co data → handler toast)
    await waitFor(() => {
      expect(screen.queryAllByText('Loi-refetch-ac13-has-data').length).toBeGreaterThan(0);
    });
  });

  it('AC13 + 401: query co data, refetch loi 401 → 0 toast tu query-client (interceptor lo)', async () => {
    // Arrange
    render(<Toaster />);
    let callCount = 0;
    const queryFn = async () => {
      callCount++;
      if (callCount === 1) return { value: 'existing-data' };
      throw new ApiError(401, 'UNAUTHORIZED', 'Phien-het-han-tu-query-401');
    };

    // Lan dau: data thanh cong
    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['ac13-401-test'],
        queryFn,
        retry: false,
        staleTime: 0,
      });
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'success') {
            unsub();
            resolve();
          }
        });
      });
    });

    // Refetch → loi 401
    await act(async () => {
      const observer = new QueryObserver(queryClient, {
        queryKey: ['ac13-401-test'],
        queryFn,
        retry: false,
        staleTime: 0,
      });
      observer.refetch();
      await new Promise<void>((resolve) => {
        const unsub = observer.subscribe(() => {
          if (observer.getCurrentResult().status === 'error') {
            unsub();
            resolve();
          }
        });
      });
    });

    // Assert: query-client bo qua 401 → khong toast tu tang nay
    expect(screen.queryAllByText('Phien-het-han-tu-query-401').length).toBe(0);
  });
});

// ─── Ma tran 401 vs 403 ──────────────────────────────────────────────────────
describe('Ma tran phan quyen client — 401 vs 403', () => {
  it('403 → ApiError FORBIDDEN, accessToken van con, khong goi /auth/refresh', async () => {
    // Arrange
    let refreshCalled = false;
    http.defaults.adapter = makeAdapter(async (cfg) => {
      if (cfg.url?.includes('/auth/refresh')) {
        refreshCalled = true;
        return makeResponse(cfg, 200, {});
      }
      throw makeAxiosErr(cfg, 403, { message: 'Ban khong co quyen thuc hien viec nay' });
    });

    // Act
    const err = await http.get('/tasks/in-other-dept').catch((e) => e);

    // Assert
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(useAuthStore.getState().accessToken).toBe('access-token');
    expect(refreshCalled).toBe(false);
  });

  it('403 → khong co request thu hai (khong retry, chi 1 lan goi adapter)', async () => {
    // Arrange
    let adapterCallCount = 0;
    http.defaults.adapter = makeAdapter(async (cfg) => {
      adapterCallCount++;
      throw makeAxiosErr(cfg, 403, {});
    });

    // Act
    await http.get('/forbidden-resource').catch(() => {});

    // Assert
    expect(adapterCallCount).toBe(1);
  });

  it('403 voi message backend → dung message backend, phien nguyen ven', async () => {
    // Arrange
    http.defaults.adapter = makeAdapter(async (cfg) => {
      throw makeAxiosErr(cfg, 403, { message: 'Thieu phong ban' });
    });

    // Act
    const err = await http.get('/dept-resource').catch((e) => e);

    // Assert
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Thieu phong ban');
    expect(useAuthStore.getState().accessToken).toBe('access-token');
  });

  it('401 → co goi /auth/refresh (tuong phan voi 403)', async () => {
    // Arrange: refresh thanh cong
    let refreshCalled = false;
    let requestCount = 0;
    http.defaults.adapter = makeAdapter(async (cfg) => {
      if (cfg.url?.includes('/auth/refresh')) {
        refreshCalled = true;
        return makeResponse(cfg, 200, {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        });
      }
      requestCount++;
      if (requestCount === 1) {
        throw makeAxiosErr(cfg, 401, {});
      }
      return makeResponse(cfg, 200, { ok: true });
    });

    // Act
    const result = await http.get('/data');

    // Assert
    expect(refreshCalled).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });
});

// ─── AC1: khong con fetch( truc tiep trong src/ ──────────────────────────────
describe('AC1 — chong hoi quy: khong con fetch( truc tiep trong src/', () => {
  it('khong file nao trong apps/web/src/ goi fetch( truc tiep (tru file test)', async () => {
    // Arrange
    const { readdir, readFile } = await import('node:fs/promises');
    const path = await import('node:path');

    async function collectFiles(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await collectFiles(full)));
        } else if (
          /\.(ts|tsx)$/.test(entry.name) &&
          !entry.name.includes('.test.')
        ) {
          results.push(full);
        }
      }
      return results;
    }

    const srcDir = path.resolve(__dirname, '..');
    const files = await collectFiles(srcDir);

    const violations: string[] = [];
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      // Tim fetch( nhung loai tru comment
      if (/\bfetch\s*\(/.test(content)) {
        violations.push(file);
      }
    }

    // Assert: khong file nao dung fetch() truc tiep
    expect(violations).toEqual([]);
  });
});
