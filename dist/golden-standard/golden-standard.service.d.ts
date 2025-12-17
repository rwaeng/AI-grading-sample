import { GeminiService } from '../gemini/gemini.service';
import { ValidationService } from '../validation/validation.service';
import { GoldenStandard } from '../common/interfaces';
export declare class GoldenStandardService {
    private readonly geminiService;
    private readonly validationService;
    private readonly logger;
    private readonly storage;
    constructor(geminiService: GeminiService, validationService: ValidationService);
    generate(question: string): Promise<GoldenStandard>;
    private generateMultipleDrafts;
    private mergeDrafts;
    private createGoldenStandard;
    private parseJsonResponse;
    findById(id: string): GoldenStandard | undefined;
    findByQuestionId(questionId: string): GoldenStandard | undefined;
    findAll(): GoldenStandard[];
}
