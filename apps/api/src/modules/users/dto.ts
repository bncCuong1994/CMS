import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLES } from '@cms/shared-types';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const DEPARTMENT_ROLES = [ROLES.ADMIN, ROLES.USER, ROLES.INTERN] as const;
export type DepartmentRole = (typeof DEPARTMENT_ROLES)[number];

export class ListUsersQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
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
