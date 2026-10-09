import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { DepartmentsModule } from './modules/departments/departments.module';
import { HealthController } from './modules/health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PermissionsGuard } from './modules/rbac/permissions.guard';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuditModule,
    RbacModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Thứ tự quan trọng: xác thực trước, kiểm tra quyền sau.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
