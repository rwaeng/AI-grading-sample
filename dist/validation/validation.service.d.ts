import { GeminiService } from '../gemini/gemini.service';
import { ValidationResult } from '../common/interfaces';
export declare class ValidationService {
    private readonly geminiService;
    private readonly logger;
    constructor(geminiService: GeminiService);
    validate(question: string, draftJson: Record<string, unknown>, sourceUrls: string[]): Promise<ValidationResult>;
    private parseValidationResult;
}
