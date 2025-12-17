import { GradingService } from './grading.service';
import { GradeAnswerDto } from './dto';
import { GradingResult } from '../common/interfaces';
export declare class GradingController {
    private readonly gradingService;
    constructor(gradingService: GradingService);
    grade(dto: GradeAnswerDto): Promise<GradingResult>;
    findAll(): GradingResult[];
    findById(id: string): GradingResult | undefined;
    findByQuestionId(questionId: string): GradingResult[];
}
