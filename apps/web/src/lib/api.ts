import type { AxiosRequestConfig } from 'axios';
import { http } from './http';

export { ApiError, type ApiErrorCode } from './api-error';

/**
 * Client HTTP dùng chung cho toàn bộ app.
 * Mỗi hàm trả thẳng response.data (đã unwrap); 204 trả undefined.
 */
export const api = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return http.get<T>(url, config).then((r) => r.data);
  },
  post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return http.post<T>(url, body, config).then((r) => (r.status === 204 ? (undefined as T) : r.data));
  },
  patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return http.patch<T>(url, body, config).then((r) => (r.status === 204 ? (undefined as T) : r.data));
  },
  put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return http.put<T>(url, body, config).then((r) => (r.status === 204 ? (undefined as T) : r.data));
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return http.delete<T>(url, config).then((r) => (r.status === 204 ? (undefined as T) : r.data));
  },
};
