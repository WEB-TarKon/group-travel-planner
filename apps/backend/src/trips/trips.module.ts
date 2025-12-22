import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { PrismaModule } from '../prisma.module';
import {AuthModule} from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [TripsService],
  controllers: [TripsController]
})
export class TripsModule {}
