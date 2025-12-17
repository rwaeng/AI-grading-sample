import { Module } from '@nestjs/common';
import { GradingController } from './grading.controller';
import { GradingService } from './grading.service';
import { GoldenStandardModule } from '../golden-standard/golden-standard.module';

@Module({
  imports: [GoldenStandardModule],
  controllers: [GradingController],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
