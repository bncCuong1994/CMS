import { describe, expect, it } from 'vitest';
import { officeLocationSchema, timeToMinutes, workScheduleSchema } from './schemas';

function baseSchedule() {
  return {
    workStart: '08:00',
    workEnd: '17:00',
    hasLunch: true,
    lunchStart: '12:00',
    lunchEnd: '13:00',
    workDays: [1, 2, 3, 4, 5],
    monthlyLateAllowanceMin: 60,
  };
}

function baseLocation() {
  return { name: 'Trụ sở', latitude: 10.776, longitude: 106.7, radiusM: 150, isActive: true };
}

describe('timeToMinutes', () => {
  it('đổi "HH:mm" hợp lệ thành số phút trong ngày', () => {
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('trả -1 khi sai định dạng', () => {
    expect(timeToMinutes('8:00')).toBe(-1);
    expect(timeToMinutes('24:00')).toBe(-1);
    expect(timeToMinutes('12:60')).toBe(-1);
    expect(timeToMinutes('abc')).toBe(-1);
  });
});

describe('workScheduleSchema', () => {
  it('chấp nhận lịch hợp lệ', () => {
    expect(workScheduleSchema.safeParse(baseSchedule()).success).toBe(true);
  });

  it('cho phép tắt nghỉ trưa dù lunchStart/lunchEnd rỗng', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), hasLunch: false, lunchStart: '', lunchEnd: '' });
    expect(r.success).toBe(true);
  });

  it('từ chối giờ sai định dạng', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), workStart: '8:00' });
    expect(r.success).toBe(false);
  });

  it('từ chối khi giờ ra ≤ giờ vào', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), workStart: '17:00', workEnd: '08:00' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === 'workEnd')).toBe(true);
  });

  it('từ chối nghỉ trưa ngoài giờ làm việc', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), lunchStart: '18:00', lunchEnd: '18:30' });
    expect(r.success).toBe(false);
  });

  it('từ chối lunchStart ≥ lunchEnd', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), lunchStart: '13:00', lunchEnd: '12:00' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === 'lunchEnd')).toBe(true);
  });

  it('bật nghỉ trưa nhưng bỏ trống thì báo lỗi', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), lunchStart: '', lunchEnd: '' });
    expect(r.success).toBe(false);
  });

  it('từ chối workDays rỗng', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), workDays: [] });
    expect(r.success).toBe(false);
  });

  it('từ chối workDays ngoài 1–7', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), workDays: [0, 8] });
    expect(r.success).toBe(false);
  });

  it('từ chối quota âm', () => {
    const r = workScheduleSchema.safeParse({ ...baseSchedule(), monthlyLateAllowanceMin: -1 });
    expect(r.success).toBe(false);
  });
});

describe('officeLocationSchema', () => {
  it('chấp nhận điểm hợp lệ', () => {
    expect(officeLocationSchema.safeParse(baseLocation()).success).toBe(true);
  });

  it('từ chối tên rỗng', () => {
    expect(officeLocationSchema.safeParse({ ...baseLocation(), name: '   ' }).success).toBe(false);
  });

  it('từ chối latitude ngoài [-90, 90]', () => {
    expect(officeLocationSchema.safeParse({ ...baseLocation(), latitude: 91 }).success).toBe(false);
    expect(officeLocationSchema.safeParse({ ...baseLocation(), latitude: -91 }).success).toBe(false);
  });

  it('từ chối longitude ngoài [-180, 180]', () => {
    expect(officeLocationSchema.safeParse({ ...baseLocation(), longitude: 181 }).success).toBe(false);
  });

  it('từ chối radiusM ngoài [20, 5000]', () => {
    expect(officeLocationSchema.safeParse({ ...baseLocation(), radiusM: 19 }).success).toBe(false);
    expect(officeLocationSchema.safeParse({ ...baseLocation(), radiusM: 5001 }).success).toBe(false);
  });
});
