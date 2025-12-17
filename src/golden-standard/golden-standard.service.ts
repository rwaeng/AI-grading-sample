import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { ValidationService } from '../validation/validation.service';
import {
  GOLDEN_STANDARD_PROMPT,
  MERGE_ANSWERS_PROMPT,
} from '../gemini/prompts';
import { GoldenStandard } from '../common/interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GoldenStandardService {
  private readonly logger = new Logger(GoldenStandardService.name);
  private readonly storage = new Map<string, GoldenStandard>();

  constructor(
    private readonly geminiService: GeminiService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * 모범 답안 생성 (전체 파이프라인)
   */
  async generate(question: string): Promise<GoldenStandard> {
    this.logger.log(`Generating golden standard for: ${question}`);

    // Step 1: 3개의 다양한 답안 생성 (Temperature 0.7~0.8)
    const drafts = await this.generateMultipleDrafts(question);
    this.logger.log(`Generated ${drafts.length} draft answers`);

    // Step 2: 3개 답안 종합
    const mergedDraft = await this.mergeDrafts(drafts);
    this.logger.log('Merged drafts into single answer');

    // Step 3: URL 추출
    const urls = this.geminiService.extractUrlsFromGroundingMetadata(
      JSON.stringify(mergedDraft),
    );
    this.logger.log(`Extracted ${urls.length} URLs from grounding`);

    // Step 4: 교차 검증
    const validationResult = await this.validationService.validate(
      question,
      mergedDraft,
      urls,
    );
    this.logger.log(`Validation status: ${validationResult.status}`);

    // Step 5: 저장
    const goldenStandard = this.createGoldenStandard(
      question,
      mergedDraft,
      validationResult,
    );
    this.storage.set(goldenStandard.id, goldenStandard);

    return goldenStandard;
  }

  /**
   * 3개의 다양한 답안 생성
   */
  private async generateMultipleDrafts(question: string): Promise<string[]> {
    const temperatures = [0.7, 0.75, 0.8];
    const prompt = GOLDEN_STANDARD_PROMPT.replace('{{question}}', question);

    const drafts = await Promise.all(
      temperatures.map((temperature) =>
        this.geminiService.generateWithPro(prompt, {
          temperature,
          useGrounding: true,
        }),
      ),
    );

    return drafts;
  }

  /**
   * 3개 답안 종합
   */
  private async mergeDrafts(drafts: string[]): Promise<Record<string, unknown>> {
    const mergePrompt = MERGE_ANSWERS_PROMPT
      .replace('{{answer1}}', drafts[0])
      .replace('{{answer2}}', drafts[1])
      .replace('{{answer3}}', drafts[2]);

    const mergedResponse = await this.geminiService.generateWithPro(mergePrompt, {
      temperature: 0.3,
      useGrounding: false,
    });

    return this.parseJsonResponse(mergedResponse);
  }

  /**
   * GoldenStandard 객체 생성
   */
  private createGoldenStandard(
    question: string,
    draft: Record<string, unknown>,
    validationResult: { status: 'PASS' | 'FAIL'; filteredSources: string[] },
  ): GoldenStandard {
    const questionId = uuidv4();
    const mechanism = draft.technical_mechanism as Record<string, string> || {};

    return {
      id: uuidv4(),
      questionId,
      question,
      referenceSource: (draft.reference_source as string) || '',
      standardDefinition: (draft.standard_definition as string) || '',
      technicalMechanism: {
        basicPrinciple: mechanism.basic_principle || '',
        deepPrinciple: mechanism.deep_principle || '',
      },
      keyTerminology: (draft.key_terminology as string[]) || [],
      commonMisconceptions: (draft.common_misconceptions as string) || '',
      practicalApplication: (draft.practical_application as string) || '',
      filteredSources: validationResult.filteredSources,
      validationStatus: validationResult.status,
      createdAt: new Date(),
    };
  }

  /**
   * JSON 응답 파싱
   */
  private parseJsonResponse(response: string): Record<string, unknown> {
    try {
      // JSON 블록 추출
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      return JSON.parse(jsonStr.trim());
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${error}`);
      return {};
    }
  }

  /**
   * ID로 모범 답안 조회
   */
  findById(id: string): GoldenStandard | undefined {
    return this.storage.get(id);
  }

  /**
   * 질문 ID로 모범 답안 조회
   */
  findByQuestionId(questionId: string): GoldenStandard | undefined {
    for (const standard of this.storage.values()) {
      if (standard.questionId === questionId) {
        return standard;
      }
    }
    return undefined;
  }

  /**
   * 모든 모범 답안 조회
   */
  findAll(): GoldenStandard[] {
    return Array.from(this.storage.values());
  }
}
