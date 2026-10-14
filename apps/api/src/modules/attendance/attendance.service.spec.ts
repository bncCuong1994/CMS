import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators';

const actor: AuthUser = { id: 'actor-1', email: 'root@test.local', grants: { global: [], departments: {} } };

function makeSettingsRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'settings-1',
    workStart: '08:00',
    workEnd: '17:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    workDays: [1, 2, 3, 4, 5],
    monthlyLateAllowanceMin: 60,
    timezone: 'Asia/Ho_Chi_Minh',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function makeLocationRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'loc-1',
    name: 'Văn phòng HCM',
    latitude: new Prisma.Decimal(10.776),
    longitude: new Prisma.Decimal(106.7),
    radiusM: 150,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...over,
  };
}

/** PrismaService giả: transaction chạy callback với chính mock. */
function buildPrismaMock() {
  const attendanceSettings = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const officeLocation = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const prisma: {
    attendanceSettings: typeof attendanceSettings;
    officeLocation: typeof officeLocation;
    $transaction: jest.Mock;
  } = {
    attendanceSettings,
    officeLocation,
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };
  return prisma;
}

describe('AttendanceService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let audit: { log: jest.Mock };
  let service: AttendanceService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AttendanceService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  describe('getSettings', () => {
    it('chưa cấu hình → trả bộ mặc định + officeLocations rỗng', async () => {
      prisma.attendanceSettings.findFirst.mockResolvedValue(null);

      const res = await service.getSettings();

      expect(res).toEqual({
        workStart: '08:00',
        workEnd: '17:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        workDays: [1, 2, 3, 4, 5],
        monthlyLateAllowanceMin: 60,
        timezone: 'Asia/Ho_Chi_Minh',
        officeLocations: [],
      });
    });

    it('loại điểm đã xoá mềm (where deletedAt null)', async () => {
      prisma.attendanceSettings.findFirst.mockResolvedValue(null);
      prisma.officeLocation.findMany.mockResolvedValue([makeLocationRow()]);

      const res = await service.getSettings();

      expect(prisma.officeLocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
      expect(res.officeLocations).toEqual([
        { id: 'loc-1', name: 'Văn phòng HCM', latitude: 10.776, longitude: 106.7, radiusM: 150, isActive: true },
      ]);
    });
  });

  describe('updateSettings — ràng buộc liên trường', () => {
    beforeEach(() => prisma.attendanceSettings.findFirst.mockResolvedValue(null));

    it('giờ ra ≤ giờ vào → 400', async () => {
      await expect(service.updateSettings(actor, { workStart: '09:00', workEnd: '08:00' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('nghỉ trưa ngoài giờ làm → 400', async () => {
      await expect(
        service.updateSettings(actor, { lunchStart: '07:00', lunchEnd: '07:30' }),
      ).rejects.toThrow('Nghỉ trưa phải nằm trong giờ làm việc');
    });

    it('lunchStart ≥ lunchEnd → 400', async () => {
      await expect(service.updateSettings(actor, { lunchStart: '13:00', lunchEnd: '12:00' })).rejects.toThrow(
        'Giờ kết thúc nghỉ trưa phải sau giờ bắt đầu',
      );
    });

    it('chỉ khai một đầu nghỉ trưa → 400', async () => {
      await expect(service.updateSettings(actor, { lunchStart: '12:00', lunchEnd: null })).rejects.toThrow(
        'Nghỉ trưa phải khai đủ',
      );
    });

    it('bỏ cả hai đầu nghỉ trưa (null) → hợp lệ', async () => {
      prisma.attendanceSettings.create.mockResolvedValue(makeSettingsRow({ lunchStart: null, lunchEnd: null }));

      await service.updateSettings(actor, { lunchStart: null, lunchEnd: null });

      expect(prisma.attendanceSettings.create).toHaveBeenCalled();
      const data = prisma.attendanceSettings.create.mock.calls[0][0].data;
      expect(data.lunchStart).toBeNull();
      expect(data.lunchEnd).toBeNull();
    });
  });

  describe('updateSettings — upsert singleton', () => {
    it('chưa có bản ghi → create + audit before null', async () => {
      prisma.attendanceSettings.findFirst
        .mockResolvedValueOnce(null) // trong updateSettings
        .mockResolvedValueOnce(makeSettingsRow()); // trong getSettings cuối

      await service.updateSettings(actor, { monthlyLateAllowanceMin: 90 });

      expect(prisma.attendanceSettings.create).toHaveBeenCalledTimes(1);
      expect(prisma.attendanceSettings.update).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'attendance.settings.update', before: null }),
        expect.anything(),
      );
      expect(prisma.attendanceSettings.create.mock.calls[0][0].data.monthlyLateAllowanceMin).toBe(90);
    });

    it('đã có bản ghi → update chính bản đó, không tạo mới', async () => {
      const row = makeSettingsRow();
      prisma.attendanceSettings.findFirst.mockResolvedValue(row);

      await service.updateSettings(actor, { workStart: '09:00' });

      expect(prisma.attendanceSettings.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: row.id } }),
      );
      expect(prisma.attendanceSettings.create).not.toHaveBeenCalled();
      expect(prisma.attendanceSettings.update.mock.calls[0][0].data.workStart).toBe('09:00');
    });
  });

  describe('createLocation', () => {
    it('thiếu radiusM → mặc định 150, ghi audit', async () => {
      prisma.officeLocation.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        makeLocationRow({ ...data }),
      );

      const res = await service.createLocation(actor, { name: 'VP1', latitude: 10, longitude: 106 });

      expect(prisma.officeLocation.create.mock.calls[0][0].data.radiusM).toBe(150);
      expect(res.radiusM).toBe(150);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'attendance.office_location.create' }),
        expect.anything(),
      );
    });
  });

  describe('updateLocation', () => {
    it('không tồn tại / đã xoá mềm → 404', async () => {
      prisma.officeLocation.findFirst.mockResolvedValue(null);

      await expect(service.updateLocation(actor, 'loc-x', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cập nhật + ghi audit before/after', async () => {
      prisma.officeLocation.findFirst.mockResolvedValue(makeLocationRow());
      prisma.officeLocation.update.mockResolvedValue(makeLocationRow({ name: 'VP mới' }));

      const res = await service.updateLocation(actor, 'loc-1', { name: 'VP mới' });

      expect(res.name).toBe('VP mới');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'attendance.office_location.update', before: expect.any(Object) }),
        expect.anything(),
      );
    });
  });

  describe('deleteLocation', () => {
    it('không tồn tại → 404', async () => {
      prisma.officeLocation.findFirst.mockResolvedValue(null);
      await expect(service.deleteLocation(actor, 'loc-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('xoá mềm set deletedAt + ghi audit', async () => {
      prisma.officeLocation.findFirst.mockResolvedValue(makeLocationRow());
      prisma.officeLocation.update.mockResolvedValue(makeLocationRow({ deletedAt: new Date() }));

      await service.deleteLocation(actor, 'loc-1');

      const data = prisma.officeLocation.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'attendance.office_location.delete' }),
        expect.anything(),
      );
    });
  });
});
