# US-WEB-01 Gọi API bằng axios và xử lý lỗi tập trung ở web

Giai đoạn: 1 (nền tảng) Module: web (hạ tầng FE, cắt ngang) Ưu tiên: high Ước lượng: 3 điểm

Là **người dùng bất kỳ vai trò nào**, tôi muốn mọi lỗi khi gọi API được báo bằng một thông báo tiếng Việt rõ ràng và nhất quán, để không phải đoán vì sao thao tác thất bại.

Là **frontend developer**, tôi muốn một client HTTP duy nhất (axios + interceptor) và một chỗ xử lý lỗi tập trung, để mỗi feature không phải tự lặp lại code bắt lỗi, gắn token, refresh token, hiện toast.

> Đây là **story kỹ thuật** (non-functional), không thêm endpoint và không đổi hành vi nghiệp vụ nào. Phạm vi chỉ `apps/web`. Backend **không** sửa.

## Vì sao làm bây giờ

1. Hiện mỗi feature tự bắt lỗi: `login-page.tsx` tự `setError`, `create-user-dialog.tsx` tự `toast.error`, `departments-page.tsx` / `users-page.tsx` chưa có khối lỗi chuẩn. Càng thêm màn thì càng lệch.
2. Wrapper `fetch` hiện tại **không phân biệt lỗi mạng / timeout với lỗi nghiệp vụ**: mất mạng thì `fetch` throw `TypeError` chứ không phải `ApiError`, nên `login-page` mới phải viết fallback `'Không kết nối được máy chủ'` thủ công. Không có timeout → request treo vô hạn.
3. Chuẩn hoá trước giai đoạn 3 (công việc) rẻ hơn nhiều so với sửa sau khi đã có 10+ màn.

## Tiêu chí nghiệm thu

- **AC1 — Một client duy nhất.** Given toàn bộ `apps/web`, When grep `fetch(` trong `src/`, Then không còn chỗ nào gọi `fetch` trực tiếp; mọi request đi qua instance axios trong `src/lib/http.ts`.
- **AC2 — Giữ nguyên hành vi đang chạy.** Given các luồng đã có (đăng nhập, `GET /users`, `GET /departments`, `POST /users`, `POST /auth/logout`), When chạy lại bộ test web hiện có (16 test) sau khi cập nhật mock, Then tất cả xanh và hành vi trên UI không đổi.
- **AC3 — Mọi lỗi về một kiểu `ApiError`.** Given bất kỳ request thất bại (lỗi HTTP, lỗi mạng, timeout, body không phải JSON), When lỗi lọt ra khỏi lớp `lib/api.ts`, Then nó **luôn** là `instanceof ApiError` với đủ `status`, `code`, `message` (tiếng Việt) — không bao giờ là `AxiosError` thô.
- **AC4 — Giữ được message của backend.** Given backend trả `409 { message: 'Email đã được sử dụng' }`, When tạo người dùng trùng email, Then `error.status === 409` và `error.message === 'Email đã được sử dụng'` (không bị thay bằng message mặc định) — popup tạo người dùng vẫn gắn lỗi vào field `email` như `US-USERS-01`.
- **AC5 — Lỗi validate dạng mảng.** Given backend trả `400 { message: ['email không hợp lệ', 'password quá ngắn'] }`, When nhận lỗi, Then `error.message` là hai câu nối bằng `, ` và `error.details` là mảng gốc.
- **AC6 — Mất mạng.** Given máy chủ không truy cập được, When gọi API, Then nhận `ApiError { status: 0, code: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ' }`.
- **AC7 — Timeout.** Given máy chủ không phản hồi trong 15 giây, When quá hạn, Then nhận `ApiError { status: 0, code: 'TIMEOUT', message: 'Máy chủ phản hồi quá lâu, thử lại sau' }` và request bị huỷ.
- **AC8 — Refresh token 401 giữ nguyên, có kiểm thử.** Given access token hết hạn, When ba request chạy song song cùng nhận 401, Then chỉ gọi `POST /auth/refresh` **một lần** (single-flight) và cả ba request được thử lại **đúng một lần** với token mới.
- **AC9 — Refresh thất bại thì đăng xuất.** Given refresh token cũng hết hạn, When `POST /auth/refresh` trả lỗi, Then phiên bị `clear()`, hiện **đúng một** toast `Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại` và người dùng về `/login` (do `AppLayout` tự điều hướng khi mất `accessToken`; **không** dùng `window.location`).
- **AC10 — Không refresh vòng lặp.** Given request tới `/auth/login`, `/auth/refresh`, `/auth/logout` nhận 401, When xử lý lỗi, Then **không** thử refresh và **không** retry.
- **AC11 — Toast tập trung cho mutation.** Given một mutation thất bại và không khai `meta.skipErrorToast`, When lỗi xảy ra, Then `MutationCache.onError` hiện `toast.error(error.message)` — feature không cần viết gì thêm.
- **AC12 — Feature vẫn tự xử lý được khi cần.** Given mutation khai `meta: { skipErrorToast: true }` (ví dụ `useCreateUser`), When lỗi xảy ra, Then handler tập trung **không** toast; chỉ feature toast/gắn field error → không bị toast hai lần.
- **AC13 — Query lỗi không toast trùng với khối lỗi inline.** Given một query lỗi lần đầu (chưa có data), When render, Then handler tập trung **không** toast (màn tự hiện khối lỗi + nút thử lại). Given query đã có data và refetch nền lỗi, When lỗi xảy ra, Then hiện toast (vì màn không có chỗ hiện lỗi).
- **AC14 — Retry đúng chỗ.** Given lỗi `status === 0` hoặc `>= 500`, When query chạy, Then thử lại tối đa 1 lần. Given lỗi 4xx (400/401/403/404/409), When query chạy, Then **không** retry. Mutation **không bao giờ** tự retry.
- **AC15 — Không rò rỉ bí mật.** Given interceptor ghi log, When có lỗi, Then không `console.log` access token, refresh token, mật khẩu hay body request.

## Ca phân quyền

Story không thêm endpoint nên không có ma trận quyền mới. Bảng dưới là **hành vi client khi backend từ chối** — backend vẫn là chỗ quyết định (rule bất biến số 1).

| Vai trò | Kết quả |
|---|---|
| Super Admin | Không đổi. Mọi request như cũ. |
| Admin (phòng được gán) | Không đổi. |
| Admin (phòng **không** được gán) | Backend trả `403` → client dựng `ApiError { status: 403, code: 'FORBIDDEN' }`, message **ưu tiên câu của backend** (vd `Thiếu phòng ban`), không có thì mặc định `Bạn không có quyền thực hiện việc này`. Mutation → toast; query lần đầu → khối lỗi inline. **Không** tự đăng xuất, **không** retry. |
| User | Như trên với mọi endpoint ngoài phạm vi. |
| Intern | Như trên. |
| Chưa đăng nhập | Request không có header `Authorization`; backend trả `401`; không có refresh token → không gọi refresh, `clear()` + về `/login`. |

Lưu ý phân biệt bắt buộc: **401 = hết phiên** (được refresh, có thể đăng xuất) vs **403 = sai quyền/sai phạm vi** (tuyệt đối **không** đăng xuất, không xoá phiên). Trộn hai cái này sẽ làm Admin bị đẩy ra khỏi hệ thống khi bấm vào phòng không thuộc mình.

## API contract

Không thêm/sửa endpoint. Đây là **contract nội bộ của FE** mà mọi feature phụ thuộc.

### `src/lib/api-error.ts`

```ts
export type ApiErrorCode =
  | 'NETWORK_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'UNAUTHORIZED'
  | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'TOO_MANY_REQUESTS'
  | 'SERVER_ERROR' | 'UNKNOWN';

export class ApiError extends Error {
  readonly status: number;        // 0 khi lỗi mạng hoặc timeout
  readonly code: ApiErrorCode;
  readonly details?: string[];    // mảng message validate gốc của NestJS
}

/** Chuyển bất kỳ lỗi nào (AxiosError, Error, giá trị lạ) thành ApiError. */
export function toApiError(error: unknown): ApiError;
```

Quy tắc dựng `message`: **ưu tiên `message` từ body backend** (string → dùng luôn; mảng → `join(', ')` và lưu mảng vào `details`). Chỉ khi body không có `message` mới dùng câu mặc định theo bảng:

| status / tình huống | code | message mặc định |
|---|---|---|
| không có response (mạng) | `NETWORK_ERROR` | Không kết nối được máy chủ |
| `ECONNABORTED` / quá 15s | `TIMEOUT` | Máy chủ phản hồi quá lâu, thử lại sau |
| 400, 422 | `VALIDATION_ERROR` | Dữ liệu không hợp lệ |
| 401 | `UNAUTHORIZED` | Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại |
| 403 | `FORBIDDEN` | Bạn không có quyền thực hiện việc này |
| 404 | `NOT_FOUND` | Không tìm thấy dữ liệu |
| 409 | `CONFLICT` | Dữ liệu đã tồn tại |
| 429 | `TOO_MANY_REQUESTS` | Bạn thao tác quá nhanh, thử lại sau |
| >= 500 | `SERVER_ERROR` | Máy chủ gặp lỗi, thử lại sau |
| còn lại | `UNKNOWN` | Có lỗi xảy ra, thử lại sau |

Body lỗi của backend hiện là mặc định của NestJS: `{ statusCode, message: string | string[], error }`. **Chưa có trường `code` máy đọc được** → FE suy ra `code` từ `status`. Khi backend bổ sung `code`, FE phải đọc `body.code` trước. Đã ghi là nợ trong backlog, không xử lý trong story này.

### `src/lib/http.ts`

```ts
export const http: AxiosInstance; // baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
// timeout: REQUEST_TIMEOUT_MS = 15_000 (hằng số có tên, không viết số trần)
```

- **Request interceptor**: gắn `Authorization: Bearer <accessToken>` từ `useAuthStore.getState()` nếu có. Không gắn cho `/auth/login`, `/auth/refresh`.
- **Response error interceptor**:
  1. `401` + không thuộc `/auth/*` + chưa retry (`config._retried !== true`) → gọi `refreshTokens()` (single-flight, giữ nguyên logic đang có ở `api.ts:14-36`); thành công → gắn cờ `_retried` rồi gọi lại chính request đó; thất bại → `clear()` và reject.
  2. Mọi trường hợp khác → `Promise.reject(toApiError(error))`.

### `src/lib/api.ts` (giữ đường dẫn import `@/lib/api`)

```ts
export const api = {
  get:    <T>(url: string, config?: AxiosRequestConfig) => Promise<T>,
  post:   <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => Promise<T>,
  patch:  <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => Promise<T>,
  put:    <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => Promise<T>,
  delete: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>,
};
export { ApiError, type ApiErrorCode } from './api-error';
```

Mỗi hàm trả thẳng `response.data` (đã unwrap), `204` trả `undefined as T`. Dạng gọi `api.get<T>('/users')` **đúng với skill `web-feature`** của repo.

### `src/lib/query-client.ts` (mới)

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetry },   // tối đa 1 lần, chỉ status 0 hoặc >= 500
    mutations: { retry: 0 },
  },
  queryCache: new QueryCache({ onError }),       // AC13
  mutationCache: new MutationCache({ onError }), // AC11, AC12
});
```

Khai báo meta cho TypeScript (`declare module '@tanstack/react-query' { interface Register { ... } }` hoặc `queryMeta`/`mutationMeta`) để `meta.skipErrorToast` có kiểu, không dùng `any`.

## Ghi nhận dữ liệu

`activity_events`: không. `audit_logs`: không. `notifications`: không. (Story chỉ sửa frontend; không có transaction nào ở FE.)

## Màn hình

Không thêm màn. Ảnh hưởng tới: `login-page.tsx` (đổi sang `api.post`, bỏ fallback lỗi mạng tự viết vì `ApiError` đã lo), `app-layout.tsx` (`api.post('/auth/logout', ...)`), `users-page.tsx` + `departments-page.tsx` (query dùng `api.get`), `create-user-dialog.tsx` (thêm `meta.skipErrorToast`, giữ nguyên logic 409 → field `email`).

## Phụ thuộc

- **Chặn:** `US-USERS-01` phải được merge trước, hoặc story này làm trên nhánh tách từ `feat/users-create-user` (story này sửa đúng các file mà `US-USERS-01` vừa tạo).
- **Chặn `US-USERS-02`:** cả hai cùng sửa `apps/web/src/features/users/api.ts`. Làm tuần tự: `US-WEB-01` trước, `US-USERS-02` sau (chỉ đổi kiểu, không đổi cách gọi).

## Task con

### FE-01 (fe-dev)

1. `pnpm --filter web add axios`.
2. Thêm `src/lib/api-error.ts`, `src/lib/http.ts`; viết lại `src/lib/api.ts` theo contract trên (giữ đường dẫn import cũ để diff nhỏ). Mỗi file < 120 dòng.
3. Thêm `src/lib/query-client.ts`; `main.tsx` dùng `queryClient` từ đó (bỏ khai báo inline).
4. Cập nhật 5 chỗ gọi: `features/users/api.ts`, `lib/departments.ts`, `features/auth/login-page.tsx`, `app/app-layout.tsx`, và `meta.skipErrorToast` cho `useCreateUser`.
5. Không đổi text UI đang có, không đổi layout, không sửa `apps/api` hay `packages/`.

### TEST-01 (tester, sau khi reviewer APPROVE)

- Unit `toApiError`: đủ 10 dòng bảng mapping + AC4 (giữ message BE) + AC5 (mảng message) + body rỗng/không phải JSON.
- Interceptor (stub `adapter` của axios, **không** thêm dependency mock mới): gắn token / không gắn cho `/auth/login`; AC8 single-flight 3 request song song chỉ 1 lần refresh; AC9 refresh fail → `clear()` + 1 toast; AC10 không refresh cho `/auth/*`; AC14 retry.
- Handler tập trung: mutation lỗi → 1 toast; mutation có `skipErrorToast` → 0 toast; query lỗi lần đầu → 0 toast; query có data rồi refetch lỗi → 1 toast.
- Chạy lại 16 test cũ (regression AC2) + `pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`.

## Checklist

- [x] Có đủ 6 dòng ca phân quyền
- [x] Mã lỗi viết HOA_GẠCH_DƯỚI, khớp mã HTTP
- [x] Ghi rõ có ghi activity_events / audit_logs / notifications không
- [x] Không mâu thuẫn quyết định đã chốt (kế hoạch mục 2 không chốt HTTP client; axios là bổ sung)
