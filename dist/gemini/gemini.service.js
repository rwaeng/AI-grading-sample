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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const vertexai_1 = require("@google-cloud/vertexai");
let GeminiService = class GeminiService {
    configService;
    vertexAI;
    proModelName;
    flashModelName;
    flashLiteModelName;
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const projectId = this.configService.getOrThrow('GOOGLE_CLOUD_PROJECT');
        const location = this.configService.getOrThrow('GOOGLE_CLOUD_LOCATION');
        this.vertexAI = new vertexai_1.VertexAI({
            project: projectId,
            location: location,
        });
        this.proModelName = this.configService.getOrThrow('GEMINI_PRO_MODEL');
        this.flashModelName = this.configService.getOrThrow('GEMINI_FLASH_MODEL');
        this.flashLiteModelName = this.configService.getOrThrow('GEMINI_FLASH_LITE_MODEL');
    }
    async generateWithPro(prompt, options = {}) {
        const { temperature = 0.7, maxOutputTokens = 8192, useGrounding = false } = options;
        const tools = [];
        if (useGrounding) {
            tools.push({
                googleSearchRetrieval: {},
            });
        }
        const model = this.vertexAI.getGenerativeModel({
            model: this.proModelName,
            generationConfig: {
                temperature,
                maxOutputTokens,
            },
            tools: tools.length > 0 ? tools : undefined,
        });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const sources = [];
        const searchQueries = [];
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
        const model = this.vertexAI.getGenerativeModel({
            model: this.flashModelName,
            generationConfig: {
                temperature,
                maxOutputTokens,
            },
        });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const response = result.response;
        return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    async generateWithFlashLite(prompt, options) {
        const { functions, temperature = 0.1 } = options;
        const tools = [
            {
                functionDeclarations: functions,
            },
        ];
        const model = this.vertexAI.getGenerativeModel({
            model: this.flashLiteModelName,
            generationConfig: {
                temperature,
            },
            tools,
        });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const response = result.response;
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];
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
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GeminiService);
//# sourceMappingURL=gemini.service.js.map