import { z } from 'zod';

/** Giới hạn geofence theo AC6 / decisions 2026-10-13. */
export const RADIUS_MIN_M = 20;
export const RADIUS_MAX_M = 5000;
export const DEFAULT_RADIUS_M = 150;
const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

/** Số thứ ISO của ngày trong tuần: 1=T2 … 7=CN. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Chuyển "HH:mm" hợp lệ thành số phút trong ngày; -1 nếu sai định dạng. */
export function timeToMinutes(value: string): number {
  if (!TIME_RE.test(value)) return -1;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

const timeField = z
  .string()
  .trim()
  .regex(TIME_RE, 'Giờ phải đúng định dạng HH:mm');

/**
 * Form lịch làm việc. Nghỉ trưa gộp dưới cờ `hasLunch`: bật thì bắt nhập đủ cặp;
 * tắt thì gửi cả hai `null` (Giả định 3). Ràng buộc chéo (giờ ra > giờ vào, nghỉ trưa
 * trong giờ làm) kiểm bằng `superRefine` để khớp AC6.
 */
export const workScheduleSchema = z
  .object({
    workStart: timeField,
    workEnd: timeField,
    hasLunch: z.boolean(),
    lunchStart: z.string().trim(),
    lunchEnd: z.string().trim(),
    workDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, 'Chọn ít nhất một ngày làm việc'),
    monthlyLateAllowanceMin: z
      .number({ error: 'Nhập số phút quota' })
      .int('Quota phải là số nguyên')
      .min(0, 'Quota không được âm'),
  })
  .superRefine((v, ctx) => {
    const start = timeToMinutes(v.workStart);
    const end = timeToMinutes(v.workEnd);
    if (start >= 0 && end >= 0 && end <= start) {
      ctx.addIssue({ code: 'custom', path: ['workEnd'], message: 'Giờ ra phải sau giờ vào' });
    }

    if (!v.hasLunch) return;

    if (!TIME_RE.test(v.lunchStart)) {
      ctx.addIssue({ code: 'custom', path: ['lunchStart'], message: 'Giờ phải đúng định dạng HH:mm' });
    }
    if (!TIME_RE.test(v.lunchEnd)) {
      ctx.addIssue({ code: 'custom', path: ['lunchEnd'], message: 'Giờ phải đúng định dạng HH:mm' });
    }

    const ls = timeToMinutes(v.lunchStart);
    const le = timeToMinutes(v.lunchEnd);
    if (ls < 0 || le < 0) return;

    if (le <= ls) {
      ctx.addIssue({
        code: 'custom',
        path: ['lunchEnd'],
        message: 'Giờ kết thúc nghỉ trưa phải sau giờ bắt đầu',
      });
    }
    if (start >= 0 && end >= 0 && (ls < start || le > end)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lunchStart'],
        message: 'Nghỉ trưa phải nằm trong giờ làm việc',
      });
    }
  });

export type WorkScheduleFormValues = z.infer<typeof workScheduleSchema>;

/** Form thêm/sửa điểm văn phòng (AC6). `radiusM` để trống → backend mặc định 150. */
export const officeLocationSchema = z.object({
  name: z.string().trim().min(1, 'Tên không được để trống'),
  latitude: z
    .number({ error: 'Nhập vĩ độ' })
    .min(LAT_MIN, `Vĩ độ trong khoảng ${LAT_MIN}…${LAT_MAX}`)
    .max(LAT_MAX, `Vĩ độ trong khoảng ${LAT_MIN}…${LAT_MAX}`),
  longitude: z
    .number({ error: 'Nhập kinh độ' })
    .min(LNG_MIN, `Kinh độ trong khoảng ${LNG_MIN}…${LNG_MAX}`)
    .max(LNG_MAX, `Kinh độ trong khoảng ${LNG_MIN}…${LNG_MAX}`),
  radiusM: z
    .number({ error: 'Nhập bán kính' })
    .int('Bán kính phải là số nguyên')
    .min(RADIUS_MIN_M, `Bán kính từ ${RADIUS_MIN_M} đến ${RADIUS_MAX_M} m`)
    .max(RADIUS_MAX_M, `Bán kính từ ${RADIUS_MIN_M} đến ${RADIUS_MAX_M} m`),
  isActive: z.boolean(),
});

export type OfficeLocationFormValues = z.infer<typeof officeLocationSchema>;
