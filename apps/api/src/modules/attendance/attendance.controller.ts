import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@cms/shared-types';
import { AuthUser, CurrentUser, RequirePermission } from '../../common/decorators';
import { AttendanceService } from './attendance.service';
import { CreateOfficeLocationDto, UpdateAttendanceSettingsDto, UpdateOfficeLocationDto } from './dto';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('settings')
  @RequirePermission(PERMISSIONS.ATTENDANCE_CONFIG_READ)
  @ApiOkResponse({ description: 'Cấu hình chấm công hiện tại (hoặc bộ mặc định nếu chưa cấu hình)' })
  getSettings() {
    return this.attendance.getSettings();
  }

  @Patch('settings')
  @RequirePermission(PERMISSIONS.ATTENDANCE_CONFIG, { globalOnly: true })
  @ApiOkResponse({ description: 'Cấu hình sau khi cập nhật' })
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateAttendanceSettingsDto) {
    return this.attendance.updateSettings(user, dto);
  }

  @Post('office-locations')
  @RequirePermission(PERMISSIONS.ATTENDANCE_CONFIG, { globalOnly: true })
  @ApiOkResponse({ description: 'Điểm văn phòng vừa tạo' })
  createLocation(@CurrentUser() user: AuthUser, @Body() dto: CreateOfficeLocationDto) {
    return this.attendance.createLocation(user, dto);
  }

  @Patch('office-locations/:id')
  @RequirePermission(PERMISSIONS.ATTENDANCE_CONFIG, { globalOnly: true })
  @ApiOkResponse({ description: 'Điểm văn phòng sau khi cập nhật' })
  updateLocation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfficeLocationDto,
  ) {
    return this.attendance.updateLocation(user, id, dto);
  }

  @Delete('office-locations/:id')
  @RequirePermission(PERMISSIONS.ATTENDANCE_CONFIG, { globalOnly: true })
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Đã xoá mềm điểm văn phòng' })
  deleteLocation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.attendance.deleteLocation(user, id);
  }
}
