import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { GoldenStandardService } from './golden-standard.service';
import { CreateGoldenStandardDto } from './dto';
import { GoldenStandard } from '../common/interfaces';

@Controller('golden-standard')
export class GoldenStandardController {
  constructor(private readonly goldenStandardService: GoldenStandardService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @Body() dto: CreateGoldenStandardDto,
  ): Promise<GoldenStandard> {
    return this.goldenStandardService.generate(dto.question);
  }

  @Get()
  findAll(): GoldenStandard[] {
    return this.goldenStandardService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string): GoldenStandard | undefined {
    return this.goldenStandardService.findById(id);
  }

  @Get('question/:questionId')
  findByQuestionId(
    @Param('questionId') questionId: string,
  ): GoldenStandard | undefined {
    return this.goldenStandardService.findByQuestionId(questionId);
  }
}
