import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FunctionDeclaration } from '@google-cloud/vertexai';
export interface GenerateOptions {
    temperature?: number;
    maxOutputTokens?: number;
    useGrounding?: boolean;
}
export interface FunctionCallingOptions {
    functions: FunctionDeclaration[];
    temperature?: number;
}
export declare class GeminiService implements OnModuleInit {
    private readonly configService;
    private vertexAI;
    private proModelName;
    private flashModelName;
    private flashLiteModelName;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    generateWithPro(prompt: string, options?: GenerateOptions): Promise<string>;
    generateWithFlash(prompt: string, options?: GenerateOptions): Promise<string>;
    generateWithFlashLite(prompt: string, options: FunctionCallingOptions): Promise<{
        functionCall?: {
            name: string;
            args: Record<string, unknown>;
        };
        text?: string;
    }>;
    extractUrlsFromGroundingMetadata(response: string): string[];
}
