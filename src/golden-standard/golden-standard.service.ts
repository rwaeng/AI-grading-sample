import { Injectable, Logger } from '@nestjs/common';
import { GeminiService, GroundingSource } from '../gemini/gemini.service';
import { ValidationService } from '../validation/validation.service';
import {
  GOLDEN_STANDARD_PROMPT,
  MERGE_ANSWERS_PROMPT,
} from '../gemini/prompts';
import { GoldenStandard } from '../common/interfaces';
import { v4 as uuidv4 } from 'uuid';

interface DraftWithSources {
  text: string;
  sources: GroundingSource[];
}

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

    // Step 1: 3개의 다양한 답안 생성 (Temperature 0.7~0.8) + 출처 수집
    const draftsWithSources = await this.generateMultipleDrafts(question);
    this.logger.log(`Generated ${draftsWithSources.length} draft answers`);

    // Step 2: 모든 출처 수집 (중복 제거)
    const allSources = this.collectUniqueSources(draftsWithSources);
    this.logger.log(`Collected ${allSources.length} unique sources from grounding`);

    // Step 3: 3개 답안 종합
    const mergedDraft = await this.mergeDrafts(draftsWithSources.map(d => d.text));
    this.logger.log('Merged drafts into single answer');

    // Step 4: 교차 검증 (groundingMetadata에서 추출한 URL 사용)
    const sourceUrls = allSources.map(s => s.uri);
    const validationResult = await this.validationService.validate(
      question,
      mergedDraft,
      sourceUrls,
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
   * 3개의 다양한 답안 생성 (출처 정보 포함)
   */
  private async generateMultipleDrafts(question: string): Promise<DraftWithSources[]> {
    const temperatures = [0.7, 0.75, 0.8];
    const prompt = GOLDEN_STANDARD_PROMPT.replace('{{question}}', question);

    const results = await Promise.all(
      temperatures.map((temperature) =>
        this.geminiService.generateWithPro(prompt, {
          temperature,
          useGrounding: true,
        }),
      ),
    );

    return results.map((result) => ({
      text: result.text,
      sources: result.sources,
    }));
  }

  /**
   * 모든 출처에서 중복 제거
   */
  private collectUniqueSources(drafts: DraftWithSources[]): GroundingSource[] {
    const sourceMap = new Map<string, GroundingSource>();
    
    for (const draft of drafts) {
      for (const source of draft.sources) {
        if (source.uri && !sourceMap.has(source.uri)) {
          sourceMap.set(source.uri, source);
        }
      }
    }

    return Array.from(sourceMap.values());
  }

  /**
   * 3개 답안 종합
   */
  private async mergeDrafts(drafts: string[]): Promise<Record<string, unknown>> {
    const mergePrompt = MERGE_ANSWERS_PROMPT
      .replace('{{answer1}}', drafts[0])
      .replace('{{answer2}}', drafts[1])
      .replace('{{answer3}}', drafts[2]);

    const result = await this.geminiService.generateWithPro(mergePrompt, {
      temperature: 0.3,
      useGrounding: false,
    });

    return this.parseJsonResponse(result.text);
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
