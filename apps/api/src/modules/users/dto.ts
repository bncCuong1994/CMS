import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLES } from '@cms/shared-types';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Chuẩn hoá tham số lọc nhiều giá trị về string[]:
 * - lặp tham số (?role=USER&role=INTERN) → mảng sẵn
 * - phẩy ngăn cách (?role=USER,INTERN) → tách bằng dấu phẩy
 * - một giá trị đơn → mảng 1 phần tử
 * Loại bỏ phần tử rỗng/khoảng trắng; trả undefined khi không có giá trị thực.
 */
function toStringArray(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const items = raw
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [item]))
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
  return items.length > 0 ? items : undefined;
}

const DEPARTMENT_ROLES = [ROLES.ADMIN, ROLES.USER, ROLES.INTERN] as const;
export type DepartmentRole = (typeof DEPARTMENT_ROLES)[number];

const FILTER_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.USER, ROLES.INTERN] as const;
export type FilterRole = (typeof FILTER_ROLES)[number];

const USER_STATUSES = ['active', 'inactive', 'locked'] as const;
export type UserStatusFilter = (typeof USER_STATUSES)[number];

export const USERS_PAGE_SIZE_DEFAULT = 20;
export const USERS_PAGE_SIZE_MAX = 100;

export class ListUsersQuery {
  @ApiPropertyOptional({
    isArray: true,
    type: String,
    format: 'uuid',
    description: 'Nhiều giá trị uuid: lặp (?departmentId=a&departmentId=b) hoặc phẩy (?departmentId=a,b)',
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  departmentId?: string[];

  @ApiPropertyOptional({ description: 'Tìm chứa trên fullName hoặc email (không phân biệt hoa/thường)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    isArray: true,
    enum: FILTER_ROLES,
    description: 'Nhiều giá trị: lặp (?role=USER&role=INTERN) hoặc phẩy (?role=USER,INTERN)',
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(FILTER_ROLES, { each: true })
  role?: FilterRole[];

  @ApiPropertyOptional({
    isArray: true,
    enum: USER_STATUSES,
    description: 'Nhiều giá trị: lặp hoặc phẩy ngăn cách',
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(USER_STATUSES, { each: true })
  status?: UserStatusFilter[];

  @ApiPropertyOptional({ minimum: 1, default: USERS_PAGE_SIZE_DEFAULT })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: USERS_PAGE_SIZE_MAX,
    default: USERS_PAGE_SIZE_DEFAULT,
    description: `Tối đa ${USERS_PAGE_SIZE_MAX}; vượt sẽ bị kẹp về ${USERS_PAGE_SIZE_MAX}`,
  })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty()
  @IsUUID()
  departmentId: string;

  @ApiProperty({ enum: DEPARTMENT_ROLES })
  @IsIn(DEPARTMENT_ROLES)
  role: DepartmentRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;
}

/**
 * Sửa bán phần người dùng (US-USERS-04). Mọi trường optional; chỉ trường được gửi mới cập nhật.
 * `phone`/`position` cho phép gửi `null` để xoá. Không cho đổi `email`/`password`/`SUPER_ADMIN` ở đây.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 20 })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  position?: string | null;

  @ApiPropertyOptional({ isArray: true, type: String, format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ enum: DEPARTMENT_ROLES })
  @IsOptional()
  @IsIn(DEPARTMENT_ROLES)
  role?: DepartmentRole;
}
