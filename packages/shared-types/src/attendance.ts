/**
 * Kiểu dùng chung cho module chấm công (US-ATT-03): cấu hình lịch làm việc cố định
 * và các điểm văn phòng (geofence). Web + API + mobile (US-ATT-04) dùng chung, KHÔNG khai lại.
 *
 * Giờ lưu dạng "HH:mm" (giờ treo tường theo múi giờ công ty). Ngày làm việc là số thứ ISO
 * 1=Thứ Hai … 7=Chủ Nhật. Việc quy đổi mốc thời gian thực / tính muộn–sớm là của US-ATT-04.
 */

/** Một điểm văn phòng kèm bán kính geofence. */
export interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  isActive: boolean;
}

/** Cấu hình chấm công: lịch làm việc cố định toàn công ty + danh sách điểm văn phòng. */
export interface AttendanceSettings {
  /** Giờ vào chuẩn, "HH:mm". */
  workStart: string;
  /** Giờ ra chuẩn, "HH:mm". */
  workEnd: string;
  /** Giờ bắt đầu nghỉ trưa, "HH:mm"; null nếu công ty không khai nghỉ trưa. */
  lunchStart: string | null;
  /** Giờ kết thúc nghỉ trưa, "HH:mm"; null nếu không khai. */
  lunchEnd: string | null;
  /** Ngày làm việc trong tuần, số thứ ISO 1=T2 … 7=CN. */
  workDays: number[];
  /** Quota đi muộn mỗi tháng (phút). */
  monthlyLateAllowanceMin: number;
  /** Múi giờ công ty (cố định `Asia/Ho_Chi_Minh` ở giai đoạn này). */
  timezone: string;
  officeLocations: OfficeLocation[];
}

/** Body `PATCH /attendance/settings`: chỉ gửi trường muốn đổi. */
export interface UpdateAttendanceSettingsRequest {
  workStart?: string;
  workEnd?: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  workDays?: number[];
  monthlyLateAllowanceMin?: number;
}

/** Body `POST /attendance/office-locations`. Thiếu `radiusM` → mặc định 150. */
export interface CreateOfficeLocationRequest {
  name: string;
  latitude: number;
  longitude: number;
  radiusM?: number;
}

/** Body `PATCH /attendance/office-locations/:id`: chỉ gửi trường muốn đổi. */
export interface UpdateOfficeLocationRequest {
  name?: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  isActive?: boolean;
}
