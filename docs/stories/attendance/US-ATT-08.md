# US-ATT-08 Đăng nhập bằng Face ID (mở lại app bằng sinh trắc) — mobile

Vai trò: User (áp dụng cho mọi vai trò đăng nhập được: Super Admin, Admin, User, Intern)
Là **người dùng app mobile đã đăng nhập ít nhất một lần**, tôi muốn **bật đăng nhập bằng Face ID để mở lại app mà không phải gõ mật khẩu**, để **vào app nhanh và an toàn hơn**.

Module: auth
Giai đoạn: 6 (Chấm công trên mobile — làm song song)
Quyền cần: *(không có quyền nghiệp vụ)* — đây là **tiện ích đăng nhập phía client**, không phải tài nguyên có phân quyền.  Phạm vi: own (chỉ tác động phiên của chính thiết bị/người dùng đó)

## Bối cảnh & nguyên tắc (đã chốt)
- **Face ID local chỉ là cổng sinh trắc trên máy** (`expo-local-authentication`): trả đúng/sai việc "chủ thiết bị xác thực", **không** chứng minh danh tính với server, **không** lưu/gửi dữ liệu sinh trắc (quyết định 2026-10-13, 2026-10-14).
- Face ID đăng nhập **≠** Face ID chấm công (US-ATT-04). Loại ở story này chỉ **mở khoá refresh token đã lưu** rồi gọi `POST /auth/refresh` sẵn có → **không** phụ thuộc device binding (US-ATT-02).
- **Không có endpoint backend mới.** Tái dùng `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (xem contract US-ATT-01). Refresh token **xoay vòng** → mỗi lần refresh lưu đè cả access + refresh mới.
- Bảo mật ở backend là bất biến: refresh token bị thu hồi khi đổi vai trò/khoá tài khoản → `/auth/refresh` trả `401` thì app phải xoá phiên + bắt đăng nhập lại bằng mật khẩu.

## Giả định (ghi rõ, không bỏ trống)
1. **Lưu refresh token qua các lần đóng app**, đặt trong `expo-secure-store` và **chỉ đọc được sau khi xác thực sinh trắc** (`requireAuthentication` nơi hỗ trợ; nơi không hỗ trợ thì gate bằng `authenticateAsync` trước khi đọc). Access token có thể vẫn lưu như hiện tại; **không bao giờ lưu mật khẩu**.
2. Thêm dependency **`expo-local-authentication`** (bản Expo SDK 57 đóng gói sẵn, chạy được trong Expo Go).
3. "Face ID" là cách gọi chung; trên máy chỉ có vân tay/Touch ID/Android Biometric thì nhãn hiển thị theo loại máy hỗ trợ (dùng `supportedAuthenticationTypesAsync`). Fallback passcode của OS: **tắt** (`disableDeviceFallback: true`) để không cho mở bằng mã mở máy thay sinh trắc.
4. Nút **"Ghi nhớ tôi"** hiện đang giữ chỗ: story này **chưa** gắn chức năng cho nó; việc "nhớ phiên" ở đây gắn với bật Face ID. (Nếu sau muốn tách, mở story riêng.)
5. Chưa làm màn "Cài đặt" riêng để tắt Face ID; cung cấp đường tắt tối thiểu (xem AC8). Màn Cài đặt đầy đủ để story sau.

## Tiêu chí nghiệm thu (Given/When/Then)

- **AC1 — Lần đầu chưa bật: không có nút Face ID.** Given thiết bị **chưa** bật Face ID đăng nhập cho app (chưa có cờ `biometricLoginEnabled`), When mở màn Đăng nhập, Then **không hiển thị** (hoặc disable) nút "Đăng nhập bằng Face ID"; chỉ đăng nhập bằng email + mật khẩu.
- **AC2 — Mời bật sau khi đăng nhập mật khẩu thành công.** Given đăng nhập bằng mật khẩu **thành công** và máy **có phần cứng sinh trắc + đã đăng ký ở OS** (`hasHardwareAsync` && `isEnrolledAsync`) và chưa bật trước đó, When vào app, Then hiện lời mời "Bật đăng nhập bằng Face ID?" với 2 lựa chọn Bật / Để sau.
- **AC3 — Bật Face ID.** Given người dùng chọn "Bật", When app gọi `authenticateAsync` và **thành công**, Then lưu refresh token hiện tại vào secure-store dạng yêu-cầu-sinh-trắc + đặt cờ `biometricLoginEnabled = true`; nếu người dùng **huỷ/thất bại** thì **không** bật, không lưu gì thêm, vào app bình thường.
- **AC4 — Mở lại app bằng Face ID.** Given đã bật Face ID và chưa có access token hợp lệ trong RAM, When mở màn Đăng nhập và bấm nút Face ID → `authenticateAsync` thành công, Then app đọc refresh token → gọi `POST /auth/refresh` → lưu đè **cả** access + refresh mới → điều hướng về Trang chủ.
- **AC5 — Face ID thất bại/huỷ.** Given đang ở màn Đăng nhập, When bấm Face ID nhưng xác thực **thất bại hoặc huỷ**, Then **ở lại** màn Đăng nhập, không lộ lỗi hệ thống, cho gõ mật khẩu; **không** xoá cờ Face ID.
- **AC6 — Refresh token đã bị thu hồi.** Given đã bật Face ID nhưng refresh token đã bị thu hồi/hết hạn (đổi vai trò, bị khoá, đăng xuất nơi khác), When Face ID thành công nhưng `POST /auth/refresh` trả **`401`**, Then xoá refresh token + cờ Face ID khỏi secure-store, hiện thông báo "Phiên đã hết hạn, vui lòng đăng nhập lại bằng mật khẩu", ở màn Đăng nhập.
- **AC7 — Đăng xuất.** Given đang đăng nhập và đã bật Face ID, When bấm Đăng xuất, Then gọi `POST /auth/logout` (thu hồi refresh token hiện tại) + **xoá** refresh token và cờ `biometricLoginEnabled` khỏi secure-store → lần sau mở app không còn nút Face ID (quay về AC1).
- **AC8 — Tắt Face ID tối thiểu.** Given đã bật Face ID, When người dùng tắt từ đường tắt tối thiểu (vd công tắc trên Trang chủ hoặc lời nhắc), Then xoá refresh-token-đã-khoá + cờ, app vẫn đăng nhập bình thường bằng phiên hiện tại.
- **AC9 — Máy không hỗ trợ / chưa đăng ký sinh trắc.** Given máy **không** có phần cứng hoặc **chưa** đăng ký Face ID ở OS, When ở màn Đăng nhập hoặc sau khi login mật khẩu, Then **không** mời bật và **không** hiện nút Face ID; luồng mật khẩu không bị ảnh hưởng.
- **AC10 — Không rò rỉ bí mật.** Given app ghi log, When có lỗi ở luồng Face ID/refresh, Then **không** log refresh token, access token hay mật khẩu; **không** lưu mật khẩu ở bất kỳ đâu.
- **AC11 — Tôn trọng trợ năng.** Given người dùng dùng trình đọc màn hình, When hiện nút Face ID, Then nút có `accessibilityRole="button"` + nhãn đúng loại sinh trắc máy hỗ trợ.

## Ca phân quyền (ai được, ai bị 403)
Đây là **tiện ích đăng nhập phía client**, **không phải endpoint nghiệp vụ có kiểm quyền/phạm vi** → không phát sinh 403 theo vai trò. Quyền truy cập thực tế vẫn do backend quyết qua `/auth/refresh` (token còn hiệu lực + user `active`).

| Vai trò | Kết quả |
|---|---|
| **Super Admin** | Dùng được Face ID đăng nhập như mọi vai trò (nếu máy hỗ trợ). |
| **Admin** | Dùng được. |
| **User** | Dùng được. |
| **Intern** (`active`) | Dùng được. ⚠️ Nếu Intern bị **tự khoá 30 ngày** (`inactive_30d`) hoặc khoá thủ công trong lúc bật Face ID → refresh trả `401` → rơi vào **AC6** (xoá phiên, bắt đăng nhập lại). |
| **Admin ở phòng không được gán** | **Không áp dụng** — Face ID đăng nhập không gắn phạm vi phòng ban; nó chỉ phục hồi phiên của chính người dùng, grants/phạm vi vẫn do backend trả như đăng nhập thường. |
| **Tài khoản bị khoá/`inactive`** | `/auth/refresh` trả `401` → AC6. |

## Phụ thuộc
- US-ATT-01 (nền mobile + secure-store + http client + luồng login/refresh/logout) — **đã xong**.
- `apps/api` auth: `login`, `refresh` (xoay vòng), `logout` — **đã có**, không cần mở endpoint mới.
- Thêm `expo-local-authentication` vào `apps/mobile`.
- **Không** phụ thuộc US-ATT-02 (device binding) hay US-ATT-04 (chấm công).

## Ghi chú cho FE / BE

**BE:** Không có việc mới. Chỉ cần xác nhận `POST /auth/refresh` giữ nguyên hành vi: token hợp lệ → `200 { accessToken, refreshToken }`; token thu hồi/hết hạn/user không `active` → `401`. Nếu phát hiện lệch so với US-ATT-01 thì báo BA.

**FE (mobile):**
- Thêm `expo-local-authentication`; tạo helper `src/lib/biometric.ts` (kiểm tra `hasHardwareAsync`/`isEnrolledAsync`/`supportedAuthenticationTypesAsync`, hàm `authenticate()` với `disableDeviceFallback: true`).
- Mở rộng `secure-store.ts`/`auth-store.ts`: lưu/đọc refresh token ở khe **yêu cầu sinh trắc**, cờ `biometricLoginEnabled`. Giữ nguyên quy ước token xoay vòng (lưu đè cả hai).
- Nút Face ID ở `login-form.tsx` hiện đang là placeholder `comingSoon('Đăng nhập bằng Face ID')` → nối chức năng thật; ẩn/hiện theo AC1/AC9.
- Luồng mời bật (AC2/AC3) đặt sau khi `useLogin` thành công (trong `login-screen`/`login-form` hoặc một hook `use-biometric-enrollment`).
- Loại `/auth/login` và `/auth/refresh` khỏi auto-refresh interceptor (đã làm ở US-ATT-01 — giữ nguyên).
- ⚠️ **Lỗi rớt focus đã sửa ở `FormField` (quyết định 2026-10-16): giữ shadow TĨNH, chỉ đổi `borderColor` theo focus. Đừng tái lập bật/tắt shadow theo focus.**
- Test: lỗi sinh trắc là native-only khó chạy trong jest-expo → **mock `expo-local-authentication`** để test logic (bật/mời/mở lại/huỷ/401). Bắt buộc có test cho AC3, AC4, AC5, AC6, AC7, AC9. Chạy thật `pnpm --filter mobile lint|test|typecheck` và dán output.

## Trạng thái token (client) — tóm tắt
| Trạng thái | accessToken (RAM/secure) | refreshToken (secure, gated) | cờ `biometricLoginEnabled` |
|---|---|---|---|
| Chưa đăng nhập | — | — | false |
| Đã login mật khẩu, chưa bật Face ID | có | có (không gated) | false |
| Đã bật Face ID | có | **có (gated sinh trắc)** | true |
| Sau đăng xuất / refresh 401 | xoá | xoá | false |
