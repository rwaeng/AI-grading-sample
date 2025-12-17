import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { GoldenStandardService } from '../golden-standard/golden-standard.service';
import { GRADING_PROMPT, GRADING_FUNCTION } from '../gemini/prompts';
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

    // 모범 답안 조회
    const goldenStandard = this.goldenStandardService.findByQuestionId(questionId);
    if (!goldenStandard) {
      throw new NotFoundException(`Golden standard not found for question: ${questionId}`);
    }

    // 프롬프트 구성
    const prompt = GRADING_PROMPT
      .replace('{{question}}', goldenStandard.question)
      .replace('{{answer}}', answer)
      .replace('{{golden_standard}}', JSON.stringify({
        standardDefinition: goldenStandard.standardDefinition,
        technicalMechanism: goldenStandard.technicalMechanism,
        keyTerminology: goldenStandard.keyTerminology,
        commonMisconceptions: goldenStandard.commonMisconceptions,
      }, null, 2));

    // AI 채점 요청 (Function Calling)
    const response = await this.geminiService.generateWithFlashLite(prompt, {
      functions: [GRADING_FUNCTION],
      temperature: 0.1,
    });

    if (!response.functionCall || response.functionCall.name !== 'submit_junior_grading') {
      this.logger.error('AI did not call the grading function');
      throw new Error('Grading failed: AI did not return proper function call');
    }

    // 점수 계산
    const aiArgs = response.functionCall.args as unknown as GradingFunctionArgs;
    const calculatedScore = this.calculateScore(aiArgs);

    // 결과 저장
    const result: GradingResult = {
      id: uuidv4(),
      questionId,
      answer,
      totalScore: calculatedScore.totalScore,
      scores: calculatedScore.scores,
      evaluationReason: calculatedScore.evaluationReason,
      feedback: calculatedScore.feedback,
      createdAt: new Date(),
    };

    this.storage.set(result.id, result);
    this.logger.log(`Grading completed. Score: ${result.totalScore}`);

    return result;
  }

  /**
   * 점수 계산 로직
   */
  private calculateScore(aiArgs: GradingFunctionArgs): {
    totalScore: number;
    scores: GradingResult['scores'];
    evaluationReason: string;
    feedback: string;
  } {
    let totalScore = 0;

    // 1. 개념 정확성 (30점 / 15점 / 0점)
    let accuracyScore = 0;
    switch (aiArgs.accuracy_level) {
      case 'PERFECT':
        accuracyScore = 30;
        break;
      case 'MINOR_ERROR':
        accuracyScore = 15;
        break;
      case 'WRONG':
        accuracyScore = 0;
        break;
    }
    totalScore += accuracyScore;

    // 2. 논리적 근거 (20점 / 10점 / 0점)
    let logicScore = 0;
    switch (aiArgs.logic_level) {
      case 'CLEAR':
        logicScore = 20;
        break;
      case 'WEAK':
        logicScore = 10;
        break;
      case 'NONE':
        logicScore = 0;
        break;
    }
    totalScore += logicScore;

    // 3. 문장 완결성 (10점 / 0점)
    const completenessScore = aiArgs.is_complete_sentence ? 10 : 0;
    totalScore += completenessScore;

    // 4. 지식의 깊이 (20점 / 10점 / 0점)
    let depthScore = 0;
    switch (aiArgs.depth_level) {
      case 'DEEP':
        depthScore = 20;
        break;
      case 'BASIC_ONLY':
        depthScore = 10;
        break;
      case 'NONE':
        depthScore = 0;
        break;
    }
    totalScore += depthScore;

    // 5. 실무 적용력 (20점 / 0점)
    const applicationScore = aiArgs.has_application ? 20 : 0;
    totalScore += applicationScore;

    return {
      totalScore,
      scores: {
        accuracy: accuracyScore,
        logic: logicScore,
        completeness: completenessScore,
        depth: depthScore,
        application: applicationScore,
      },
      evaluationReason: `[정확성]: ${aiArgs.accuracy_reason}\n[논리]: ${aiArgs.logic_reason}\n[깊이]: ${aiArgs.depth_reason}`,
      feedback: aiArgs.mentoring_feedback,
    };
  }

  /**
   * ID로 채점 결과 조회
   */
  findById(id: string): GradingResult | undefined {
    return this.storage.get(id);
  }

  /**
   * 질문별 채점 결과 조회
   */
  findByQuestionId(questionId: string): GradingResult[] {
    return Array.from(this.storage.values()).filter(
      (result) => result.questionId === questionId,
    );
  }

  /**
   * 모든 채점 결과 조회
   */
  findAll(): GradingResult[] {
    return Array.from(this.storage.values());
  }
}
