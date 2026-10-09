import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Marketing' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'MARKETING', description: 'Mã viết hoa, không dấu' })
  @Matches(/^[A-Z][A-Z0-9_]{1,31}$/)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
