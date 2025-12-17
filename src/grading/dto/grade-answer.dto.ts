import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class GradeAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  answer: string;
}
