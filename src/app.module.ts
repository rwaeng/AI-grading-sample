import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiModule } from './gemini/gemini.module';
import { GoldenStandardModule } from './golden-standard/golden-standard.module';
import { ValidationModule } from './validation/validation.module';
import { GradingModule } from './grading/grading.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GeminiModule,
    ValidationModule,
    GoldenStandardModule,
    GradingModule,
  ],
})
export class AppModule {}
