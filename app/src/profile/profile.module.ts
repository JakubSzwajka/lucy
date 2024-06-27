import { Module } from '@nestjs/common';
import { ProfileController } from './controllers/profile.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../lucy/entities/agent.entity';
import { AgentService } from './services/agent.service';

@Module({
  imports: [TypeOrmModule.forFeature([Agent])],
  controllers: [ProfileController],
  providers: [AgentService],
})
export class ProfileModule {}
