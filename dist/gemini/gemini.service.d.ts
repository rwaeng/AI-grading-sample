import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface GenerateOptions {
    temperature?: number;
    maxOutputTokens?: number;
    useGrounding?: boolean;
}
export interface FunctionCallingOptions {
    functions: FunctionDeclaration[];
    temperature?: number;
}
export interface GroundingSource {
    uri: string;
    title: string;
}
export interface GenerateWithGroundingResult {
    text: string;
    sources: GroundingSource[];
    searchQueries: string[];
}
export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}
export declare class GeminiService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private apiKey;
    private proModelName;
    private flashModelName;
    private flashLiteModelName;
    private readonly BASE_URL;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    generateWithPro(prompt: string, options?: GenerateOptions): Promise<GenerateWithGroundingResult>;
    generateWithFlash(prompt: string, options?: GenerateOptions): Promise<string>;
    generateWithFlashLite(prompt: string, options: FunctionCallingOptions): Promise<{
        functionCall?: {
            name: string;
            args: Record<string, unknown>;
        };
        text?: string;
    }>;
    private callGeminiApi;
}
