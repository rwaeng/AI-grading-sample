import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  useGrounding?: boolean;
  systemInstruction?: string;
}

export interface FunctionCallingOptions {
  functions: any[];
  temperature?: number;
  topP?: number;
  systemInstruction?: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface GenerateResult {
  text: string;
  sources: GroundingSource[];
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private client!: any;
  private proModelName!: string;
  private flashModelName!: string;
  private flashLiteModelName!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.client = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' }); // v1alpha for grounding/latest features

    this.proModelName = this.configService.get<string>('GEMINI_PRO_MODEL') || 'gemini-1.5-pro';
    this.flashModelName = this.configService.get<string>('GEMINI_FLASH_MODEL') || 'gemini-1.5-flash';
    this.flashLiteModelName = this.configService.get<string>('GEMINI_FLASH_LITE_MODEL') || 'gemini-2.0-flash-lite-preview-02-05';
  }

  /**
   * 모범 답안 생성용 (Gemini Pro + Grounding)
   */
  async generateWithPro(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<GenerateResult> {
    const { temperature = 0.1, topP = 0.5, useGrounding = true, systemInstruction } = options;
    this.logger.log(`[Model Call] Generating with Pro model: ${this.proModelName} (Grounding: ${useGrounding})`);

    const config: any = {
      temperature,
      topP,
      systemInstruction,
    };

    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await this.client.models.generateContent({
      model: this.proModelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config,
    });

    const text = response.text || '';
    const sources: GroundingSource[] = [];

    // Grounding metadata extraction (new SDK structure)
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      this.logger.log(`[Grounding] Found ${groundingMetadata.groundingChunks.length} grounding chunks.`);
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web) {
          sources.push({
            uri: chunk.web.uri || '',
            title: chunk.web.title || '',
          });
        }
      }
    }

    return { text, sources };
  }

  /**
   * 교차 검증 및 채점용 (Gemini Flash Lite)
   */
  async generateWithFlashLite(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<GenerateResult> {
    const { temperature = 0.1, topP = 0.5, useGrounding = false, systemInstruction } = options;
    this.logger.log(`[Model Call] Generating with Flash Lite model: ${this.flashLiteModelName}`);

    const config: any = {
      temperature,
      topP,
      systemInstruction,
      maxOutputTokens: 4096, // URL이 길어질 수 있으므로 대폭 상향
    };

    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await this.client.models.generateContent({
      model: this.flashLiteModelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config,
    });

    return {
      text: response.text || '',
      sources: [],
    };
  }

  /**
   * 채점용 (Function Calling)
   */
  async gradeWithFlashLite(
    prompt: string,
    options: FunctionCallingOptions,
  ): Promise<{ functionCall?: { name: string; args: any }; text?: string }> {
    const { functions, temperature = 0.1, topP = 0.5, systemInstruction } = options;
    this.logger.log(`[Model Call] Grading with Flash Lite model: ${this.flashLiteModelName} (Function Calling)`);

    const response = await this.client.models.generateContent({
      model: this.flashLiteModelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature,
        topP,
        systemInstruction,
        tools: [{ functionDeclarations: functions }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
    if (part) {
      this.logger.log(`[Model Response] Function called: ${part.functionCall.name}`);
      return {
        functionCall: {
          name: part.functionCall.name,
          args: part.functionCall.args,
        },
      };
    }

    return {
      text: response.text || '',
    };
  }

  /**
   * 임베딩 생성 (유사도 검사용)
   */
  async getEmbedding(text: string): Promise<number[]> {
    this.logger.log(`[Model Call] Requesting embedding for text (length: ${text.length})`);
    const response = await this.client.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ parts: [{ text }] }],
    });

    // SDK may return embeddings as an array of objects or a single response depending on version
    if (response.embeddings && response.embeddings.length > 0) {
      this.logger.log(`[Model Response] Successfully received embedding vector (dim: ${response.embeddings[0].values.length})`);
      return response.embeddings[0].values;
    }

    if (response.embeddings && response.embeddings.values) {
       this.logger.log(`[Model Response] Successfully received embedding vector (dim: ${response.embeddings.values.length})`);
       return response.embeddings.values;
    }

    this.logger.warn(`[Model Response] Failed to get embedding vector.`);
    return [];
  }
}
