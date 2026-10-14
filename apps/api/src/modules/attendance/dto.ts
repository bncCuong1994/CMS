import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Khớp "HH:mm" 24 giờ (00:00–23:59). */
const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'Giờ phải đúng định dạng "HH:mm" (00:00–23:59)';

export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ example: '08:00', description: 'Giờ vào chuẩn "HH:mm"' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: TIME_MESSAGE })
  workStart?: string;

  @ApiPropertyOptional({ example: '17:00', description: 'Giờ ra chuẩn "HH:mm"' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: TIME_MESSAGE })
  workEnd?: string;

  @ApiPropertyOptional({ example: '12:00', nullable: true, description: 'Giờ bắt đầu nghỉ trưa "HH:mm" hoặc null' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: TIME_MESSAGE })
  lunchStart?: string | null;

  @ApiPropertyOptional({ example: '13:00', nullable: true, description: 'Giờ kết thúc nghỉ trưa "HH:mm" hoặc null' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: TIME_MESSAGE })
  lunchEnd?: string | null;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5], description: 'Ngày làm việc, số thứ ISO 1=T2 … 7=CN' })
  @IsOptional()
  @IsArray({ message: 'Ngày làm việc phải là danh sách' })
  @ArrayMinSize(1, { message: 'Phải chọn ít nhất một ngày làm việc' })
  @ArrayMaxSize(7, { message: 'Ngày làm việc tối đa 7 giá trị' })
  @ArrayUnique({ message: 'Ngày làm việc không được trùng' })
  @IsInt({ each: true, message: 'Ngày làm việc phải là số nguyên' })
  @Min(1, { each: true, message: 'Ngày làm việc phải trong khoảng 1–7' })
  @Max(7, { each: true, message: 'Ngày làm việc phải trong khoảng 1–7' })
  workDays?: number[];

  @ApiPropertyOptional({ example: 60, description: 'Quota đi muộn mỗi tháng (phút)' })
  @IsOptional()
  @IsInt({ message: 'Quota đi muộn phải là số nguyên' })
  @Min(0, { message: 'Quota đi muộn không được âm' })
  monthlyLateAllowanceMin?: number;
}

export class CreateOfficeLocationDto {
  @ApiProperty({ example: 'Văn phòng HCM' })
  @IsString({ message: 'Tên điểm văn phòng phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên điểm văn phòng không được để trống' })
  name: string;

  @ApiProperty({ example: 10.776 })
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải trong khoảng -90 đến 90' })
  @Max(90, { message: 'Vĩ độ phải trong khoảng -90 đến 90' })
  latitude: number;

  @ApiProperty({ example: 106.7 })
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải trong khoảng -180 đến 180' })
  @Max(180, { message: 'Kinh độ phải trong khoảng -180 đến 180' })
  longitude: number;

  @ApiPropertyOptional({ example: 150, description: 'Bán kính geofence (m); thiếu → mặc định 150' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Bán kính phải là số nguyên' })
  @Min(20, { message: 'Bán kính phải trong khoảng 20–5000 m' })
  @Max(5000, { message: 'Bán kính phải trong khoảng 20–5000 m' })
  radiusM?: number;
}

export class UpdateOfficeLocationDto {
  @ApiPropertyOptional({ example: 'Văn phòng HCM' })
  @IsOptional()
  @IsString({ message: 'Tên điểm văn phòng phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên điểm văn phòng không được để trống' })
  name?: string;

  @ApiPropertyOptional({ example: 10.776 })
  @IsOptional()
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải trong khoảng -90 đến 90' })
  @Max(90, { message: 'Vĩ độ phải trong khoảng -90 đến 90' })
  latitude?: number;

  @ApiPropertyOptional({ example: 106.7 })
  @IsOptional()
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải trong khoảng -180 đến 180' })
  @Max(180, { message: 'Kinh độ phải trong khoảng -180 đến 180' })
  longitude?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Bán kính phải là số nguyên' })
  @Min(20, { message: 'Bán kính phải trong khoảng 20–5000 m' })
  @Max(5000, { message: 'Bán kính phải trong khoảng 20–5000 m' })
  radiusM?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái bật/tắt phải là boolean' })
  isActive?: boolean;
}
