import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@cms/shared-types';
import { AuthUser, CurrentUser, RequirePermission } from '../../common/decorators';
import { CreateUserDto, ListUsersQuery } from './dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: ListUsersQuery) {
    return this.users.list(user, query.departmentId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_CREATE, { departmentFrom: { source: 'body', key: 'departmentId' } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }
}
