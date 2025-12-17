import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VertexAI,
  FunctionDeclaration,
  Tool,
  GoogleSearchRetrieval,
  GroundingChunk,
} from '@google-cloud/vertexai';

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

@Injectable()
export class GeminiService implements OnModuleInit {
  private vertexAI!: VertexAI;
  private proModelName!: string;
  private flashModelName!: string;
  private flashLiteModelName!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.getOrThrow<string>('GOOGLE_CLOUD_PROJECT');
    const location = this.configService.getOrThrow<string>('GOOGLE_CLOUD_LOCATION');

    this.vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    this.proModelName = this.configService.getOrThrow<string>('GEMINI_PRO_MODEL');
    this.flashModelName = this.configService.getOrThrow<string>('GEMINI_FLASH_MODEL');
    this.flashLiteModelName = this.configService.getOrThrow<string>('GEMINI_FLASH_LITE_MODEL');
  }

  /**
   * Gemini Pro로 모범 답안 생성 (Grounding with Google Search 지원)
   * Grounding 사용 시 출처 정보도 함께 반환
   */
  async generateWithPro(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<GenerateWithGroundingResult> {
    const { temperature = 0.7, maxOutputTokens = 8192, useGrounding = false } = options;

    const tools: Tool[] = [];
    if (useGrounding) {
      tools.push({
        googleSearchRetrieval: {} as GoogleSearchRetrieval,
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

    // Grounding 메타데이터에서 출처 정보 추출
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources: GroundingSource[] = [];
    const searchQueries: string[] = [];

    if (groundingMetadata) {
      // 검색 쿼리 추출
      if (groundingMetadata.webSearchQueries) {
        searchQueries.push(...groundingMetadata.webSearchQueries);
      }

      // 출처 URL 추출
      if (groundingMetadata.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks as GroundingChunk[]) {
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

  /**
   * Gemini Flash Lite로 채점 (Function Calling)
   */
  async generateWithFlashLite(
    prompt: string,
    options: FunctionCallingOptions,
  ): Promise<{ functionCall?: { name: string; args: Record<string, unknown> }; text?: string }> {
    const { functions, temperature = 0.1 } = options;

    const tools: Tool[] = [
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
            args: part.functionCall.args as Record<string, unknown>,
          },
        };
      }
    }

    return {
      text: parts[0]?.text || '',
    };
  }
}
