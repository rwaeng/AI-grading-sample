import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { GoldenStandardService } from '../golden-standard/golden-standard.service';
import { 
  GRADING_INSTRUCTION, 
  GRADING_FUNCTION, 
  AGGREGATE_GRADING_INSTRUCTION 
} from '../gemini/prompts';
import { GradingResult, GradingFunctionArgs } from '../common/interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);
  private readonly storage = new Map<string, GradingResult>();

  constructor(
    private readonly geminiService: GeminiService,
    private readonly goldenStandardService: GoldenStandardService,
  ) {}

  /**
   * 답변 채점
   */
  async grade(questionId: string, answer: string): Promise<GradingResult> {
    this.logger.log(`Grading answer for question: ${questionId}`);

    // 1. 모범 답안 조회
    const goldenStandard = this.goldenStandardService.findByQuestionId(questionId);
    if (!goldenStandard) {
      throw new NotFoundException(`Golden standard not found for question: ${questionId}`);
    }

    // 2. 유사도 검사 (Embedding 기반 + Semantic Double Check)
    const currentEmbedding = await this.geminiService.getEmbedding(answer);
    const similarMatch = await this.findSimilarResult(questionId, currentEmbedding, answer);

    if (similarMatch) {
      this.logger.log(`Found similar answer (similarity check passed: ${similarMatch.similarity.toFixed(4)}). Returning existing result.`);
      return {
        ...similarMatch.result,
        similarity: similarMatch.similarity,
      };
    }

    // 3. AI 채점 요청 (Triple Check)
    this.logger.log(`[Triple Check] Requesting 3 independent gradings...`);
    const goldenStr = JSON.stringify({
      standardDefinition: goldenStandard.standardDefinition,
      technicalMechanism: goldenStandard.technicalMechanism,
      keyTerminology: goldenStandard.keyTerminology,
      commonMisconceptions: goldenStandard.commonMisconceptions,
    }, null, 2);

    const userPrompt = GRADING_INSTRUCTION.user(goldenStandard.question, answer, goldenStr);

    const gradingPromises = [
      this.geminiService.gradeWithFlashLite(userPrompt, { 
        functions: [GRADING_FUNCTION], 
        temperature: 0.1,
        systemInstruction: GRADING_INSTRUCTION.system
      }),
      this.geminiService.gradeWithFlashLite(userPrompt, { 
        functions: [GRADING_FUNCTION], 
        temperature: 0.4,
        systemInstruction: GRADING_INSTRUCTION.system
      }),
      this.geminiService.gradeWithFlashLite(userPrompt, { 
        functions: [GRADING_FUNCTION], 
        temperature: 0.7,
        systemInstruction: GRADING_INSTRUCTION.system
      }),
    ];

    const responses = await Promise.all(gradingPromises);
    const drafts = responses
      .filter(r => r.functionCall && r.functionCall.name === 'submit_junior_grading')
      .map(r => r.functionCall!.args);

    if (drafts.length === 0) {
      this.logger.error('AI did not call the grading function in any of the 3 attempts');
      throw new Error('Grading failed: AI did not return proper function call');
    }

    // 4. 채점 결과 통합 (Aggregation)
    this.logger.log(`[Aggregation] Fusing 3 grading results into final decision...`);
    const draftsStr = JSON.stringify(drafts, null, 2);
    const aggregateUserPrompt = AGGREGATE_GRADING_INSTRUCTION.user(goldenStandard.question, answer, draftsStr);

    const finalResponse = await this.geminiService.gradeWithFlashLite(aggregateUserPrompt, {
      functions: [GRADING_FUNCTION],
      systemInstruction: AGGREGATE_GRADING_INSTRUCTION.system,
      temperature: 0.1,
      topP: 0.5,
    });

    if (!finalResponse.functionCall || finalResponse.functionCall.name !== 'submit_junior_grading') {
      this.logger.error('Aggregation failed: AI did not return proper function call');
      throw new Error('Aggregation failed');
    }

    const aiArgs = finalResponse.functionCall.args as unknown as GradingFunctionArgs;
    const calculatedScore = this.calculateScore(aiArgs);

    // 5. 결과 저장
    const result: GradingResult = {
      id: uuidv4(),
      questionId,
      answer,
      totalScore: calculatedScore.totalScore,
      scores: calculatedScore.scores,
      evaluationReason: calculatedScore.evaluationReason,
      feedback: calculatedScore.feedback,
      embedding: currentEmbedding,
      createdAt: new Date(),
    };

    this.storage.set(result.id, result);
    this.logger.log(`Grading completed through Triple Check. Final Score: ${result.totalScore}`);

    return result;
  }

  /**
   * 유사한 답변 찾기 (Semantic Double Check + Parallel Processing)
   */
  private async findSimilarResult(questionId: string, currentEmbedding: number[], answer: string): Promise<{ result: GradingResult, similarity: number } | undefined> {
    const results = Array.from(this.storage.values()).filter(r => r.questionId === questionId);
    
    this.logger.log(`[Similarity Check] Comparing with ${results.length} existing answers for question: ${questionId}`);
    
    // 1. 모든 기존 답변과의 코사인 유사도 계산
    const candidates = results.map(res => {
      const similarity = res.embedding ? this.cosineSimilarity(currentEmbedding, res.embedding) : 0;
      return { res, similarity };
    });

    // 2. 완벽 일치(0.99 초과)가 있으면 즉시 반환 (AI 호출 불필요)
    const perfectMatch = candidates.find(c => c.similarity > 0.99);
    if (perfectMatch) {
      this.logger.log(`✅ Perfect Match found! Similarity ${perfectMatch.similarity.toFixed(4)} > 0.99. Reusing...`);
      return { result: perfectMatch.res, similarity: perfectMatch.similarity };
    }

    // 3. 높은 유사도(0.94 초과) 후보들에 대해 AI 의미 대조 요청 (Promise.all 병렬 처리)
    const borderline = candidates.filter(c => c.similarity > 0.94);
    if (borderline.length > 0) {
      this.logger.log(`⚠️ Found ${borderline.length} high-similarity candidates. Verifying semantically in parallel...`);
      
      const checkPrompt = (targetAnswer: string) => `
        두 기술 면접 답변의 기술적 의미가 '완벽히' 동일한지 판단하여 YES 또는 NO로만 답하십시오.
        [답변 1]: ${targetAnswer}
        [답변 2]: ${answer}
        결과: (YES/NO)`;

      const verificationPromises = borderline.map(async (c) => {
        const verification = await this.geminiService.generateWithFlashLite(checkPrompt(c.res.answer), { temperature: 0.1 });
        const isIdentical = verification.text?.toUpperCase().includes('YES');
        return { ...c, isIdentical };
      });

      const verifications = await Promise.all(verificationPromises);
      const matched = verifications.find(v => v.isIdentical);
      
      if (matched) {
        this.logger.log(`✅ Semantic consistency verified for result(${matched.res.id.substring(0,8)}). Reusing...`);
        return { result: matched.res, similarity: matched.similarity };
      }
    }

    return undefined;
  }

  /**
   * 코사인 유사도 계산
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 점수 계산 로직 (가중치 적용)
   */
  private calculateScore(aiArgs: GradingFunctionArgs): {
  totalScore: number;
  scores: GradingResult['scores'];
  evaluationReason: string;
  feedback: string;
} {
  // 1. 각 항목별 점수 산정 기준 정의
  const SCORING_MAP = {
    // 정확성 (35점): 기술적 사실관계의 정확도
    // 기본 개념이 틀리면 감점이 크지만, 논리가 뒷받침된다면 복구가 가능하도록 조정
    accuracy: { PERFECT: 35, MINOR_ERROR: 20, WRONG: 0 },
    
    // 논리 (35점): 주장과 근거의 연결성, 사고의 체계성
    // 정확성과 동일한 비중을 부여하여 '개발자적 사고력'을 높게 평가
    logic: { CLEAR: 35, WEAK: 15, NONE: 0 },
    
    // 깊이 (15점): 동작 원리 및 Why에 대한 탐구
    // 주니어 수준에서 가산점 성격으로 작용하도록 비중 소폭 조정
    depth: { DEEP: 15, BASIC_ONLY: 5, NONE: 0 },
    
    // 완결성 (5점): 최소한의 문장 구성 및 의사소통 능력
    completeness: 5,
    
    // 실무 적용 (10점): 사례 연결 및 실무적 응용력
    application: 10,
  };

  // 2. 각 항목 점수 계산
  const accuracyScore = SCORING_MAP.accuracy[aiArgs.accuracy_level] ?? 0;
  const logicScore = SCORING_MAP.logic[aiArgs.logic_level] ?? 0;
  const depthScore = SCORING_MAP.depth[aiArgs.depth_level] ?? 0;
  const completenessScore = aiArgs.is_complete_sentence ? SCORING_MAP.completeness : 0;
  const applicationScore = aiArgs.has_application ? SCORING_MAP.application : 0;

  // 3. 총점 합산
  const totalScore = accuracyScore + logicScore + depthScore + completenessScore + applicationScore;

  // 4. 사유(Reason) 텍스트 구조화
  // 보고서에서 강조한 "따옴표 인용 기반 근거"가 잘 드러나도록 포맷팅
  const evaluationReason = [
    `[정확성 (${accuracyScore}/35)]: ${aiArgs.accuracy_reason}`,
    `[논리 구조 (${logicScore}/35)]: ${aiArgs.logic_reason}`,
    `[설명 깊이 (${depthScore}/15)]: ${aiArgs.depth_reason}`,
  ].join('\n\n');

  return {
    totalScore,
    scores: {
      accuracy: accuracyScore,
      logic: logicScore,
      depth: depthScore,
      completeness: completenessScore,
      application: applicationScore,
    },
    evaluationReason,
    feedback: aiArgs.mentoring_feedback,
  };
}

  findById(id: string): GradingResult | undefined {
    return this.storage.get(id);
  }

  findByQuestionId(questionId: string): GradingResult[] {
    return Array.from(this.storage.values()).filter(r => r.questionId === questionId);
  }

  findAll(): GradingResult[] {
    return Array.from(this.storage.values());
  }
}
