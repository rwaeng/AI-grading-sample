import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateGoldenStandardDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  question: string;
}
