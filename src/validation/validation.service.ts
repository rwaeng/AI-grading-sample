import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { VALIDATION_INSTRUCTION } from '../gemini/prompts';
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
    draftJson: Record<string, any>,
    sourceIndices: string[],
    indexedSourceList: string,
  ): Promise<ValidationResult> {
    this.logger.log('Starting validation...');

    const userPrompt = VALIDATION_INSTRUCTION.user(
      question, 
      JSON.stringify(draftJson, null, 2), 
      indexedSourceList
    );

    // Validation uses Flash Lite + Grounding
    const result = await this.geminiService.generateWithFlashLite(userPrompt, {
      systemInstruction: VALIDATION_INSTRUCTION.system,
      temperature: 0.1,
      topP: 0.5,
      useGrounding: true,
    });

    const parsedResult = this.parseValidationResult(result.text);
    this.logger.log(`Validation completed: ${parsedResult.status}`);

    return parsedResult;
  }

  /**
   * 검증 결과 파싱 (Markdown 태그 유연하게 처리)
   */
  private parseValidationResult(response: string): ValidationResult {
    let jsonStr = '';
    try {
      // 1. ```json ... ``` 패턴 추출 시도
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // 2. 첫 '{'와 마지막 '}' 사이 추출 시도
        const start = response.indexOf('{');
        const end = response.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          jsonStr = response.substring(start, end + 1);
        } else {
          jsonStr = response;
        }
      }

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
      this.logger.error(`Failed to parse validation result: ${error.message}`);
      this.logger.error(`Response preview: ${response.substring(0, 500)}...`);
      this.logger.error(`Last 500 chars: ...${response.slice(-500)}`);
      
      // JSON이 잘렸을 경우를 대비한 최소한의 복구 시도 (status라도 파악)
      if (jsonStr.includes('"status": "PASS"')) {
        return { status: 'PASS', riskScore: 0, validationDetails: { isSourceAuthoritative: true, isFactuallyCorrect: true, hasHallucination: false }, filteredSources: [], reviewComment: 'JSON parsing failed but status PASS detected' };
      }

      return {
        status: 'FAIL',
        riskScore: 100,
        validationDetails: {
          isSourceAuthoritative: false,
          isFactuallyCorrect: false,
          hasHallucination: true,
        },
        filteredSources: [],
        reviewComment: `JSON Parsing Error: ${error.message}`,
      };
    }
  }
}
