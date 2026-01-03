import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import jwtConfig from './jwt.config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma.service';
import { StringValue } from 'ms';
import {JwtGuard} from "./jwt.guard";
import {MailModule} from "../mail/mail.module";

@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync({
      imports: [ConfigModule, MailModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwt = configService.get<{
          secret: string;
          expiresIn: StringValue;
        }>('jwt');

        return {
          secret: jwt!.secret,
          signOptions: {
            expiresIn: jwt!.expiresIn,
          },
        };
      },
    }),
    MailModule
  ],
  providers: [AuthService, PrismaService, JwtGuard],
  controllers: [AuthController],
  exports: [JwtModule, AuthService, JwtGuard],
})
export class AuthModule {}
