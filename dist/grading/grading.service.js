"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GradingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradingService = void 0;
const common_1 = require("@nestjs/common");
const gemini_service_1 = require("../gemini/gemini.service");
const golden_standard_service_1 = require("../golden-standard/golden-standard.service");
const prompts_1 = require("../gemini/prompts");
const uuid_1 = require("uuid");
let GradingService = GradingService_1 = class GradingService {
    geminiService;
    goldenStandardService;
    logger = new common_1.Logger(GradingService_1.name);
    storage = new Map();
    constructor(geminiService, goldenStandardService) {
        this.geminiService = geminiService;
        this.goldenStandardService = goldenStandardService;
    }
    async grade(questionId, answer) {
        this.logger.log(`Grading answer for question: ${questionId}`);
        const goldenStandard = this.goldenStandardService.findByQuestionId(questionId);
        if (!goldenStandard) {
            throw new common_1.NotFoundException(`Golden standard not found for question: ${questionId}`);
        }
        const prompt = prompts_1.GRADING_PROMPT
            .replace('{{question}}', goldenStandard.question)
            .replace('{{answer}}', answer)
            .replace('{{golden_standard}}', JSON.stringify({
            standardDefinition: goldenStandard.standardDefinition,
            technicalMechanism: goldenStandard.technicalMechanism,
            keyTerminology: goldenStandard.keyTerminology,
            commonMisconceptions: goldenStandard.commonMisconceptions,
        }, null, 2));
        const response = await this.geminiService.generateWithFlashLite(prompt, {
            functions: [prompts_1.GRADING_FUNCTION],
            temperature: 0.1,
        });
        if (!response.functionCall || response.functionCall.name !== 'submit_junior_grading') {
            this.logger.error('AI did not call the grading function');
            throw new Error('Grading failed: AI did not return proper function call');
        }
        const aiArgs = response.functionCall.args;
        const calculatedScore = this.calculateScore(aiArgs);
        const result = {
            id: (0, uuid_1.v4)(),
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
    calculateScore(aiArgs) {
        let totalScore = 0;
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
        const completenessScore = aiArgs.is_complete_sentence ? 10 : 0;
        totalScore += completenessScore;
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
    findById(id) {
        return this.storage.get(id);
    }
    findByQuestionId(questionId) {
        return Array.from(this.storage.values()).filter((result) => result.questionId === questionId);
    }
    findAll() {
        return Array.from(this.storage.values());
    }
};
exports.GradingService = GradingService;
exports.GradingService = GradingService = GradingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService,
        golden_standard_service_1.GoldenStandardService])
], GradingService);
//# sourceMappingURL=grading.service.js.map