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
var GeminiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let GeminiService = GeminiService_1 = class GeminiService {
    configService;
    logger = new common_1.Logger(GeminiService_1.name);
    apiKey;
    proModelName;
    flashModelName;
    flashLiteModelName;
    BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        this.apiKey = this.configService.getOrThrow('GEMINI_API_KEY');
        this.proModelName = this.configService.getOrThrow('GEMINI_PRO_MODEL');
        this.flashModelName = this.configService.getOrThrow('GEMINI_FLASH_MODEL');
        this.flashLiteModelName = this.configService.getOrThrow('GEMINI_FLASH_LITE_MODEL');
    }
    async generateWithPro(prompt, options = {}) {
        const { temperature = 0.7, maxOutputTokens = 8192, useGrounding = false } = options;
        const requestBody = {
            contents: [
                {
                    parts: [{ text: prompt }],
                },
            ],
            generationConfig: {
                temperature,
                maxOutputTokens,
            },
        };
        if (useGrounding) {
            requestBody.tools = [
                {
                    googleSearch: {},
                },
            ];
        }
        const response = await this.callGeminiApi(this.proModelName, requestBody);
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const sources = [];
        const searchQueries = [];
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata) {
            if (groundingMetadata.webSearchQueries) {
                searchQueries.push(...groundingMetadata.webSearchQueries);
            }
            if (groundingMetadata.groundingChunks) {
                for (const chunk of groundingMetadata.groundingChunks) {
                    if (chunk.web) {
                        sources.push({
                            uri: chunk.web.uri || '',
                            title: chunk.web.title || '',
                        });
                    }
                }
            }
        }
        return { text, sources, searchQueries };
    }
    async generateWithFlash(prompt, options = {}) {
        const { temperature = 0.3, maxOutputTokens = 4096 } = options;
        const requestBody = {
            contents: [
                {
                    parts: [{ text: prompt }],
                },
            ],
            generationConfig: {
                temperature,
                maxOutputTokens,
            },
        };
        const response = await this.callGeminiApi(this.flashModelName, requestBody);
        return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    async generateWithFlashLite(prompt, options) {
        const { functions, temperature = 0.1 } = options;
        const requestBody = {
            contents: [
                {
                    parts: [{ text: prompt }],
                },
            ],
            generationConfig: {
                temperature,
            },
            tools: [
                {
                    functionDeclarations: functions,
                },
            ],
            toolConfig: {
                functionCallingConfig: {
                    mode: 'ANY',
                },
            },
        };
        const response = await this.callGeminiApi(this.flashLiteModelName, requestBody);
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.functionCall) {
                return {
                    functionCall: {
                        name: part.functionCall.name,
                        args: part.functionCall.args,
                    },
                };
            }
        }
        return {
            text: parts[0]?.text || '',
        };
    }
    async callGeminiApi(model, requestBody) {
        const url = `${this.BASE_URL}/${model}:generateContent?key=${this.apiKey}`;
        this.logger.debug(`Calling Gemini API: ${model}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorText = await response.text();
            this.logger.error(`Gemini API error: ${response.status} - ${errorText}`);
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }
        return response.json();
    }
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = GeminiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiService);
//# sourceMappingURL=gemini.service.js.map