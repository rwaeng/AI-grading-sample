import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { VALIDATION_PROMPT } from '../gemini/prompts';
import { ValidationResult } from '../common/interfaces';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * 모범 답안 교차 검증
   */
  async validate(
    question: string,
    draftJson: Record<string, unknown>,
    sourceUrls: string[],
  ): Promise<ValidationResult> {
    this.logger.log('Starting validation...');

    const prompt = VALIDATION_PROMPT
      .replace('{{question}}', question)
      .replace('{{draft_json}}', JSON.stringify(draftJson, null, 2))
      .replace('{{source_urls}}', JSON.stringify(sourceUrls));

    const response = await this.geminiService.generateWithFlash(prompt, {
      temperature: 0.1,
    });

    const result = this.parseValidationResult(response);
    this.logger.log(`Validation completed: ${result.status}`);

    return result;
  }

  /**
   * 검증 결과 파싱
   */
  private parseValidationResult(response: string): ValidationResult {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      const parsed = JSON.parse(jsonStr.trim());

      return {
        status: parsed.status || 'FAIL',
        riskScore: parsed.risk_score || 0,
        validationDetails: {
          isSourceAuthoritative: parsed.validation_details?.is_source_authoritative || false,
          isFactuallyCorrect: parsed.validation_details?.is_factually_correct || false,
          hasHallucination: parsed.validation_details?.has_hallucination || false,
        },
        filteredSources: parsed.filtered_sources || [],
        reviewComment: parsed.review_comment || '',
      };
    } catch (error) {
      this.logger.error(`Failed to parse validation result: ${error}`);
      return {
        status: 'FAIL',
        riskScore: 100,
        validationDetails: {
          isSourceAuthoritative: false,
          isFactuallyCorrect: false,
          hasHallucination: true,
        },
        filteredSources: [],
        reviewComment: 'Failed to parse validation result',
      };
    }
  }
}
