import { GeminiService } from '../gemini/gemini.service';
import { GoldenStandardService } from '../golden-standard/golden-standard.service';
import { GradingResult } from '../common/interfaces';
export declare class GradingService {
    private readonly geminiService;
    private readonly goldenStandardService;
    private readonly logger;
    private readonly storage;
    constructor(geminiService: GeminiService, goldenStandardService: GoldenStandardService);
    grade(questionId: string, answer: string): Promise<GradingResult>;
    private calculateScore;
    findById(id: string): GradingResult | undefined;
    findByQuestionId(questionId: string): GradingResult[];
    findAll(): GradingResult[];
}
