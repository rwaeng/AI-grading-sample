import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: Record<string, unknown>;
        };
      }>;
    };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
    };
  }>;
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private apiKey!: string;
  private proModelName!: string;
  private flashModelName!: string;
  private flashLiteModelName!: string;

  private readonly BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.proModelName = this.configService.getOrThrow<string>('GEMINI_PRO_MODEL');
    this.flashModelName = this.configService.getOrThrow<string>('GEMINI_FLASH_MODEL');
    this.flashLiteModelName = this.configService.getOrThrow<string>('GEMINI_FLASH_LITE_MODEL');
  }

  /**
   * Gemini Pro로 모범 답안 생성 (Grounding with Google Search 지원)
   */
  async generateWithPro(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<GenerateWithGroundingResult> {
    const { temperature = 0.7, maxOutputTokens = 8192, useGrounding = false } = options;

    const requestBody: Record<string, unknown> = {
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

    // Grounding with Google Search
    if (useGrounding) {
      requestBody.tools = [
        {
          googleSearch: {},
        },
      ];
    }

    const response = await this.callGeminiApi(this.proModelName, requestBody);

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const sources: GroundingSource[] = [];
    const searchQueries: string[] = [];

    // Grounding 메타데이터에서 출처 정보 추출
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

  /**
   * Gemini Flash로 교차 검증
   */
  async generateWithFlash(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<string> {
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

  /**
   * Gemini Flash Lite로 채점 (Function Calling)
   */
  async generateWithFlashLite(
    prompt: string,
    options: FunctionCallingOptions,
  ): Promise<{ functionCall?: { name: string; args: Record<string, unknown> }; text?: string }> {
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

  /**
   * Gemini API 호출 공통 메서드
   */
  private async callGeminiApi(
    model: string,
    requestBody: Record<string, unknown>,
  ): Promise<GeminiResponse> {
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

    return response.json() as Promise<GeminiResponse>;
  }
}
