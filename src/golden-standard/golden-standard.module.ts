import { Module, forwardRef } from '@nestjs/common';
import { GoldenStandardController } from './golden-standard.controller';
import { GoldenStandardService } from './golden-standard.service';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [forwardRef(() => ValidationModule)],
  controllers: [GoldenStandardController],
  providers: [GoldenStandardService],
  exports: [GoldenStandardService],
})
export class GoldenStandardModule {}
