import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@cms/shared-types';
import { AuthUser, CurrentUser, RequirePermission } from '../../common/decorators';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.DEPARTMENT_READ)
  list(@CurrentUser() user: AuthUser) {
    return this.departments.list(user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.DEPARTMENT_MANAGE, { globalOnly: true })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(user, dto);
  }
}
