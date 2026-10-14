/** Chữ tiếng Việt của màn cấu hình chấm công, gom một chỗ để dễ sửa. */

/** Nhãn ngày trong tuần theo số thứ ISO 1=T2 … 7=CN. */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ Nhật',
};

/** Nhãn ngắn cho checkbox chọn ngày làm việc. */
export const WEEKDAY_SHORT: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  7: 'CN',
};

export const TEXT = {
  pageTitle: 'Cấu hình chấm công',
  pageDescription: 'Lịch làm việc cố định và các điểm văn phòng cho lõi chấm công trên mobile.',

  readOnlyBanner: 'Chỉ Super Admin được chỉnh cấu hình chấm công.',

  loading: 'Đang tải cấu hình...',
  loadError: 'Không tải được cấu hình chấm công',
  retry: 'Thử lại',

  scheduleTitle: 'Lịch làm việc',
  scheduleDescription: 'Áp dụng chung toàn công ty, múi giờ cố định.',
  workStart: 'Giờ vào',
  workEnd: 'Giờ ra',
  lunchToggle: 'Có nghỉ trưa',
  lunchStart: 'Bắt đầu nghỉ trưa',
  lunchEnd: 'Kết thúc nghỉ trưa',
  workDays: 'Ngày làm việc',
  lateAllowance: 'Quota đi muộn mỗi tháng (phút)',
  timezone: 'Múi giờ',
  saveSchedule: 'Lưu lịch làm việc',
  savingSchedule: 'Đang lưu...',
  scheduleSaved: 'Đã lưu lịch làm việc',

  locationsTitle: 'Điểm văn phòng',
  locationsDescription: 'Khai toạ độ và bán kính geofence để lõi chấm công biết được phép bấm ở đâu.',
  locationsEmpty: 'Chưa có điểm văn phòng nào. Thêm điểm đầu tiên để cho phép chấm công tại chỗ.',
  addLocation: 'Thêm điểm',
  editLocation: 'Sửa điểm',
  colName: 'Tên',
  colCoords: 'Toạ độ',
  colRadius: 'Bán kính (m)',
  colStatus: 'Trạng thái',
  colActions: 'Hành động',
  statusActive: 'Đang bật',
  statusInactive: 'Đã tắt',

  name: 'Tên điểm',
  latitude: 'Vĩ độ (latitude)',
  longitude: 'Kinh độ (longitude)',
  radius: 'Bán kính (m)',
  radiusHint: 'Để trống dùng mặc định 150 m.',
  active: 'Cho phép chấm công tại điểm này',

  cancel: 'Huỷ',
  create: 'Thêm điểm',
  creating: 'Đang thêm...',
  save: 'Lưu thay đổi',
  saving: 'Đang lưu...',
  locationCreated: 'Đã thêm điểm văn phòng',
  locationUpdated: 'Đã cập nhật điểm văn phòng',
  edit: 'Sửa',
  delete: 'Xoá',
  deleteTitle: 'Xoá điểm văn phòng',
  deleteConfirm: (name: string) => `Xoá điểm "${name}"? Người dùng sẽ không chấm công được tại đây nữa.`,
  deleting: 'Đang xoá...',
  locationDeleted: 'Đã xoá điểm văn phòng',

  genericError: 'Có lỗi xảy ra, thử lại sau',
} as const;
