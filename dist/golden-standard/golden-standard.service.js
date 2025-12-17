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
var GoldenStandardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoldenStandardService = void 0;
const common_1 = require("@nestjs/common");
const gemini_service_1 = require("../gemini/gemini.service");
const validation_service_1 = require("../validation/validation.service");
const prompts_1 = require("../gemini/prompts");
const uuid_1 = require("uuid");
let GoldenStandardService = GoldenStandardService_1 = class GoldenStandardService {
    geminiService;
    validationService;
    logger = new common_1.Logger(GoldenStandardService_1.name);
    storage = new Map();
    constructor(geminiService, validationService) {
        this.geminiService = geminiService;
        this.validationService = validationService;
    }
    async generate(question) {
        this.logger.log(`Generating golden standard for: ${question}`);
        const draftsWithSources = await this.generateMultipleDrafts(question);
        this.logger.log(`Generated ${draftsWithSources.length} draft answers`);
        const allSources = this.collectUniqueSources(draftsWithSources);
        this.logger.log(`Collected ${allSources.length} unique sources from grounding`);
        const mergedDraft = await this.mergeDrafts(draftsWithSources.map(d => d.text));
        this.logger.log('Merged drafts into single answer');
        const sourceUrls = allSources.map(s => s.uri);
        const validationResult = await this.validationService.validate(question, mergedDraft, sourceUrls);
        this.logger.log(`Validation status: ${validationResult.status}`);
        const goldenStandard = this.createGoldenStandard(question, mergedDraft, validationResult, allSources);
        this.storage.set(goldenStandard.id, goldenStandard);
        return goldenStandard;
    }
    async generateMultipleDrafts(question) {
        const temperatures = [0.7, 0.75, 0.8];
        const prompt = prompts_1.GOLDEN_STANDARD_PROMPT.replace('{{question}}', question);
        const results = await Promise.all(temperatures.map((temperature) => this.geminiService.generateWithPro(prompt, {
            temperature,
            useGrounding: true,
        })));
        return results.map((result) => ({
            text: result.text,
            sources: result.sources,
        }));
    }
    collectUniqueSources(drafts) {
        const sourceMap = new Map();
        for (const draft of drafts) {
            for (const source of draft.sources) {
                if (source.uri && !sourceMap.has(source.uri)) {
                    sourceMap.set(source.uri, source);
                }
            }
        }
        return Array.from(sourceMap.values());
    }
    async mergeDrafts(drafts) {
        const mergePrompt = prompts_1.MERGE_ANSWERS_PROMPT
            .replace('{{answer1}}', drafts[0])
            .replace('{{answer2}}', drafts[1])
            .replace('{{answer3}}', drafts[2]);
        const result = await this.geminiService.generateWithPro(mergePrompt, {
            temperature: 0.3,
            useGrounding: false,
        });
        return this.parseJsonResponse(result.text);
    }
    createGoldenStandard(question, draft, validationResult, allSources) {
        const questionId = (0, uuid_1.v4)();
        const mechanism = draft.technical_mechanism || {};
        return {
            id: (0, uuid_1.v4)(),
            questionId,
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
            filteredSources: validationResult.filteredSources,
            validationStatus: validationResult.status,
            createdAt: new Date(),
        };
    }
    parseJsonResponse(response) {
        try {
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : response;
            return JSON.parse(jsonStr.trim());
        }
        catch (error) {
            this.logger.error(`Failed to parse JSON response: ${error}`);
            return {};
        }
    }
    findById(id) {
        return this.storage.get(id);
    }
    findByQuestionId(questionId) {
        for (const standard of this.storage.values()) {
            if (standard.questionId === questionId) {
                return standard;
            }
        }
        return undefined;
    }
    findAll() {
        return Array.from(this.storage.values());
    }
};
exports.GoldenStandardService = GoldenStandardService;
exports.GoldenStandardService = GoldenStandardService = GoldenStandardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService,
        validation_service_1.ValidationService])
], GoldenStandardService);
//# sourceMappingURL=golden-standard.service.js.map