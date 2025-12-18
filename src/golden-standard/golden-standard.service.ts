import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { ValidationService } from '../validation/validation.service';
import { 
  GOLDEN_STANDARD_INSTRUCTION, 
  MERGE_ANSWERS_INSTRUCTION 
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
   * 모범 답안 생성 (이미 존재하면 반환, 없으면 생성)
   */
  async generate(question: string): Promise<GoldenStandard> {
    const existing = this.findByQuestionText(question);
    if (existing) return existing;

    const results = await Promise.all([
      this.geminiService.generateWithPro(
        GOLDEN_STANDARD_INSTRUCTION.user(question), 
        { systemInstruction: GOLDEN_STANDARD_INSTRUCTION.system, temperature: 0.1 }
      ),
      this.geminiService.generateWithPro(
        GOLDEN_STANDARD_INSTRUCTION.user(question), 
        { systemInstruction: GOLDEN_STANDARD_INSTRUCTION.system, temperature: 0.4 }
      ),
      this.geminiService.generateWithPro(
        GOLDEN_STANDARD_INSTRUCTION.user(question), 
        { systemInstruction: GOLDEN_STANDARD_INSTRUCTION.system, temperature: 0.7 }
      ),
    ]);
    
    // 🔍 URL 인덱싱
    const sourceMap = new Map<string, string>();
    const reverseSourceMap = new Map<string, string>();
    let sourceCounter = 1;

    results.forEach(r => {
      r.sources.forEach(s => {
        if (!sourceMap.has(s.uri)) {
          const key = `[S${sourceCounter++}]`;
          sourceMap.set(s.uri, key);
          reverseSourceMap.set(key, s.uri);
        }
      });
    });

    const draftsJson = results.map(r => this.parseJsonResponse(r.text));
    
    // Step 2: Merge Drafts
    this.logger.log(`[Synthesis] Merging 3 drafts into one using Flash Lite...`);
    const draftsStr = JSON.stringify(draftsJson.map(d => ({
      ...d,
      reference_source: d.reference_source?.substring(0, 100)
    })), null, 2);
    
    const mergedResult = await this.geminiService.generateWithFlashLite(
      MERGE_ANSWERS_INSTRUCTION.user(draftsStr),
      { systemInstruction: MERGE_ANSWERS_INSTRUCTION.system, temperature: 0.1 }
    );
    const finalDraftJson = this.parseJsonResponse(mergedResult.text);

    // Step 3: Validation (인덱스 리스트 전달)
    this.logger.log(`[Validation] Cross-validating with indexed sources...`);
    const indexedSourceList = Array.from(reverseSourceMap.entries())
      .map(([key, url]) => `${key}: ${url.substring(0, 100)}...`) 
      .join('\n');

    const validationResult = await this.validationService.validate(
      question,
      finalDraftJson,
      Array.from(reverseSourceMap.keys()),
      indexedSourceList,
    );

    // 🔍 URL 복구: [S1] -> 실제 긴 URL
    const actualFilteredSources = (validationResult.filteredSources || [])
      .map(key => reverseSourceMap.get(key) || key);

    // Step 4: Storage
    const goldenStandard = this.createGoldenStandard(
      question,
      finalDraftJson,
      { ...validationResult, filteredSources: actualFilteredSources },
    );
    this.storage.set(goldenStandard.id, goldenStandard);

    return goldenStandard;
  }

  /**
   * 질문 텍스트로 조회
   */
  private findByQuestionText(text: string): GoldenStandard | undefined {
    return Array.from(this.storage.values()).find(s => s.question === text);
  }

  /**
   * GoldenStandard 객체 생성
   */
  private createGoldenStandard(
    question: string,
    draft: Record<string, any>,
    validationResult: { 
      status: 'PASS' | 'FAIL'; 
      filteredSources: string[];
      riskScore?: number;
      validationDetails?: {
        isSourceAuthoritative: boolean;
        isFactuallyCorrect: boolean;
        hasHallucination: boolean;
      };
      reviewComment?: string;
    },
  ): GoldenStandard {
    const mechanism = draft.technical_mechanism || {};

    return {
      id: uuidv4(),
      questionId: uuidv4(),
      question,
      referenceSource: draft.reference_source || '',
      standardDefinition: draft.standard_definition || '',
      technicalMechanism: {
        basicPrinciple: mechanism.basic_principle || '',
        deepPrinciple: mechanism.deep_principle || '',
      },
      keyTerminology: draft.key_terminology || [],
      commonMisconceptions: draft.common_misconceptions || '',
      practicalApplication: draft.practical_application || '',
      filteredSources: validationResult.filteredSources || [],
      validationStatus: validationResult.status,
      validationDetails: validationResult.validationDetails ? {
        riskScore: validationResult.riskScore || 0,
        ...validationResult.validationDetails,
      } : undefined,
      reviewComment: validationResult.reviewComment,
      createdAt: new Date(),
    };
  }

  /**
   * JSON 응답 파싱 (Markdown 태그 유연하게 처리 + 잘림 대응)
   */
  private parseJsonResponse(response: string): Record<string, any> {
    let cleanJson = response;
    try {
      // 1. ```json ... ``` 패턴 추출 시도
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanJson = jsonMatch[1];
      } else {
        // 2. 백틱만 있는 경우나 태그가 없는 경우 대응: 첫 '{'와 마지막 '}' 사이 추출
        const start = response.indexOf('{');
        const end = response.lastIndexOf('}');
        if (start !== -1) {
          cleanJson = end !== -1 && end > start 
            ? response.substring(start, end + 1)
            : response.substring(start); // 닫는 중괄호가 없으면 일단 끝까지 가져옴
        }
      }

      let trimmedJson = cleanJson.trim();

      // 3. 간단한 JSON 복구: 닫는 중괄호가 부족할 경우 인위적으로 추가
      const openBraces = (trimmedJson.match(/\{/g) || []).length;
      const closeBraces = (trimmedJson.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        trimmedJson += '}'.repeat(openBraces - closeBraces);
      }
      
      return JSON.parse(trimmedJson);
    } catch (error) {
      this.logger.error(`Failed to parse JSON response: ${error.message}`);
      // JSON 잘림 시 status PASS 여부 확인 루틴 (복구 불가 시 최소 데이터)
      if (cleanJson.includes('"status": "PASS"')) return { status: 'PASS' };
      return {};
    }
  }

  findById(id: string): GoldenStandard | undefined {
    return this.storage.get(id);
  }

  findByQuestionId(questionId: string): GoldenStandard | undefined {
    return Array.from(this.storage.values()).find(s => s.questionId === questionId);
  }

  findAll(): GoldenStandard[] {
    return Array.from(this.storage.values());
  }
}
