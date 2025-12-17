import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradeAnswerDto } from './dto';
import { GradingResult } from '../common/interfaces';

@Controller('grading')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async grade(@Body() dto: GradeAnswerDto): Promise<GradingResult> {
    return this.gradingService.grade(dto.questionId, dto.answer);
  }

  @Get()
  findAll(): GradingResult[] {
    return this.gradingService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string): GradingResult | undefined {
    return this.gradingService.findById(id);
  }

  @Get('question/:questionId')
  findByQuestionId(@Param('questionId') questionId: string): GradingResult[] {
    return this.gradingService.findByQuestionId(questionId);
  }
}
