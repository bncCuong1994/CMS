import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('Thiếu JWT_ACCESS_SECRET');
        }
        return {
          secret: secret ?? 'dev-only-access-secret',
          signOptions: { expiresIn: config.get('JWT_ACCESS_TTL') ?? '15m' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
