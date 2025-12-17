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
var ValidationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
const common_1 = require("@nestjs/common");
const gemini_service_1 = require("../gemini/gemini.service");
const prompts_1 = require("../gemini/prompts");
let ValidationService = ValidationService_1 = class ValidationService {
    geminiService;
    logger = new common_1.Logger(ValidationService_1.name);
    constructor(geminiService) {
        this.geminiService = geminiService;
    }
    async validate(question, draftJson, sourceUrls) {
        this.logger.log('Starting validation...');
        const prompt = prompts_1.VALIDATION_PROMPT
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
    parseValidationResult(response) {
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
        }
        catch (error) {
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
};
exports.ValidationService = ValidationService;
exports.ValidationService = ValidationService = ValidationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService])
], ValidationService);
//# sourceMappingURL=validation.service.js.map