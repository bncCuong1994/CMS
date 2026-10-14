import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AttendanceSettings, OfficeLocation } from '@cms/shared-types';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOfficeLocationDto, UpdateAttendanceSettingsDto, UpdateOfficeLocationDto } from './dto';

/** Bộ cấu hình mặc định khi hệ thống chưa lưu bản ghi nào (Giả định 1 của US-ATT-03). */
const DEFAULT_SETTINGS = {
  workStart: '08:00',
  workEnd: '17:00',
  lunchStart: '12:00' as string | null,
  lunchEnd: '13:00' as string | null,
  workDays: [1, 2, 3, 4, 5],
  monthlyLateAllowanceMin: 60,
  timezone: 'Asia/Ho_Chi_Minh',
} as const;

const DEFAULT_RADIUS_M = 150;

/** Phút từ nửa đêm cho chuỗi "HH:mm" đã validate định dạng. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

type SettingsRow = Prisma.AttendanceSettingsGetPayload<Record<string, never>>;
type LocationRow = Prisma.OfficeLocationGetPayload<Record<string, never>>;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Bản ghi singleton (hoặc null nếu chưa cấu hình). */
  private findSettingsRow() {
    return this.prisma.attendanceSettings.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  private toSchedule(row: SettingsRow | null): Omit<AttendanceSettings, 'officeLocations'> {
    if (!row) return { ...DEFAULT_SETTINGS, workDays: [...DEFAULT_SETTINGS.workDays] };
    return {
      workStart: row.workStart,
      workEnd: row.workEnd,
      lunchStart: row.lunchStart,
      lunchEnd: row.lunchEnd,
      workDays: row.workDays,
      monthlyLateAllowanceMin: row.monthlyLateAllowanceMin,
      timezone: row.timezone,
    };
  }

  private toLocationDto(row: LocationRow): OfficeLocation {
    return {
      id: row.id,
      name: row.name,
      latitude: row.latitude.toNumber(),
      longitude: row.longitude.toNumber(),
      radiusM: row.radiusM,
      isActive: row.isActive,
    };
  }

  async getSettings(): Promise<AttendanceSettings> {
    const [row, locations] = await Promise.all([
      this.findSettingsRow(),
      this.prisma.officeLocation.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { ...this.toSchedule(row), officeLocations: locations.map((l) => this.toLocationDto(l)) };
  }

  /**
   * Kiểm tra ràng buộc liên trường trên lịch đã gộp (giờ ra > giờ vào; nghỉ trưa hợp lệ,
   * nằm trong giờ làm, lunchStart < lunchEnd; nghỉ trưa phải khai đủ cặp hoặc bỏ cả hai).
   */
  private assertScheduleConsistent(s: Omit<AttendanceSettings, 'officeLocations'>): void {
    const start = toMinutes(s.workStart);
    const end = toMinutes(s.workEnd);
    if (end <= start) throw new BadRequestException('Giờ ra phải sau giờ vào');

    const hasLunchStart = s.lunchStart != null;
    const hasLunchEnd = s.lunchEnd != null;
    if (hasLunchStart !== hasLunchEnd) {
      throw new BadRequestException('Nghỉ trưa phải khai đủ cả giờ bắt đầu và giờ kết thúc, hoặc bỏ trống cả hai');
    }
    if (hasLunchStart && hasLunchEnd) {
      const ls = toMinutes(s.lunchStart as string);
      const le = toMinutes(s.lunchEnd as string);
      if (le <= ls) throw new BadRequestException('Giờ kết thúc nghỉ trưa phải sau giờ bắt đầu');
      if (ls < start || le > end) throw new BadRequestException('Nghỉ trưa phải nằm trong giờ làm việc');
    }
  }

  async updateSettings(actor: AuthUser, dto: UpdateAttendanceSettingsDto): Promise<AttendanceSettings> {
    const existing = await this.findSettingsRow();
    const current = this.toSchedule(existing);

    // Gộp thay đổi lên giá trị hiện tại/mặc định rồi kiểm tra liên trường.
    const merged: Omit<AttendanceSettings, 'officeLocations'> = {
      workStart: dto.workStart ?? current.workStart,
      workEnd: dto.workEnd ?? current.workEnd,
      lunchStart: dto.lunchStart !== undefined ? dto.lunchStart : current.lunchStart,
      lunchEnd: dto.lunchEnd !== undefined ? dto.lunchEnd : current.lunchEnd,
      workDays: dto.workDays ?? current.workDays,
      monthlyLateAllowanceMin: dto.monthlyLateAllowanceMin ?? current.monthlyLateAllowanceMin,
      timezone: current.timezone,
    };
    this.assertScheduleConsistent(merged);

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.attendanceSettings.update({ where: { id: existing.id }, data: { ...merged } });
      } else {
        await tx.attendanceSettings.create({ data: { ...merged } });
      }
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'attendance.settings.update',
          entityType: 'attendance_settings',
          entityId: existing?.id,
          before: existing ? current : null,
          after: merged,
        },
        tx,
      );
    });

    return this.getSettings();
  }

  async createLocation(actor: AuthUser, dto: CreateOfficeLocationDto): Promise<OfficeLocation> {
    const data = {
      name: dto.name,
      latitude: new Prisma.Decimal(dto.latitude),
      longitude: new Prisma.Decimal(dto.longitude),
      radiusM: dto.radiusM ?? DEFAULT_RADIUS_M,
    };
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.officeLocation.create({ data });
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'attendance.office_location.create',
          entityType: 'office_location',
          entityId: row.id,
          after: this.toLocationDto(row),
        },
        tx,
      );
      return row;
    });
    return this.toLocationDto(created);
  }

  async updateLocation(actor: AuthUser, id: string, dto: UpdateOfficeLocationDto): Promise<OfficeLocation> {
    const existing = await this.prisma.officeLocation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Không tìm thấy điểm văn phòng');

    const data: Prisma.OfficeLocationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.latitude !== undefined) data.latitude = new Prisma.Decimal(dto.latitude);
    if (dto.longitude !== undefined) data.longitude = new Prisma.Decimal(dto.longitude);
    if (dto.radiusM !== undefined) data.radiusM = dto.radiusM;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.officeLocation.update({ where: { id }, data });
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'attendance.office_location.update',
          entityType: 'office_location',
          entityId: id,
          before: this.toLocationDto(existing),
          after: this.toLocationDto(row),
        },
        tx,
      );
      return row;
    });
    return this.toLocationDto(updated);
  }

  async deleteLocation(actor: AuthUser, id: string): Promise<void> {
    const existing = await this.prisma.officeLocation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Không tìm thấy điểm văn phòng');

    await this.prisma.$transaction(async (tx) => {
      await tx.officeLocation.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'attendance.office_location.delete',
          entityType: 'office_location',
          entityId: id,
          before: this.toLocationDto(existing),
        },
        tx,
      );
    });
  }
}
