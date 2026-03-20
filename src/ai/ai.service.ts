import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  AppealCategory,
  AppealPriority,
} from '../appeals/entities/appeal.entity';

interface AppealAnalysisResult {
  category: AppealCategory;
  priority: AppealPriority;
  reasoning: string;
  estimatedResolutionDays: number;
}

@Injectable()
export class AiService {
  private readonly groq: Groq;
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {
    this.groq = new Groq({
      apiKey: this.configService.get<string>('GROQ_API_KEY'),
    });
  }

  async analyzeAppeal(
    title: string,
    description: string,
  ): Promise<AppealAnalysisResult> {
    const prompt = this.buildPrompt(title, description);

    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // low temperature — we need consistent structured output
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from AI');
      }

      return this.parseAndValidate(content);
    } catch (error) {
      this.logger.error('Failed to analyze appeal', error);
      throw new InternalServerErrorException('Appeal analysis failed');
    }
  }

  private buildPrompt(title: string, description: string): string {
    return `You are an AI assistant for a government digital services agency in Azerbaijan. 
Your job is to analyze citizen appeals and classify them.

Appeal title: "${title}"
Appeal description: "${description}"

Classify this appeal and respond with a JSON object using exactly these fields:
{
  "category": one of [infrastructure, healthcare, education, utilities, public_order, other],
  "priority": one of [low, medium, high, urgent],
  "reasoning": "brief explanation of your classification in 1-2 sentences",
  "estimatedResolutionDays": number between 1 and 90
}

Priority guidelines:
- urgent: immediate threat to health, safety, or critical public services
- high: significant disruption affecting many people
- medium: noticeable problem but not immediately dangerous
- low: minor inconvenience or improvement suggestion`;
  }

  private parseAndValidate(raw: string): AppealAnalysisResult {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('AI returned invalid JSON, falling back to defaults');
      return this.fallbackResult();
    }

    const validCategories = Object.values(AppealCategory);
    const validPriorities = Object.values(AppealPriority);

    const category = validCategories.includes(parsed.category as AppealCategory)
      ? (parsed.category as AppealCategory)
      : AppealCategory.OTHER;

    const priority = validPriorities.includes(parsed.priority as AppealPriority)
      ? (parsed.priority as AppealPriority)
      : AppealPriority.MEDIUM;

    return {
      category,
      priority,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      estimatedResolutionDays:
        typeof parsed.estimatedResolutionDays === 'number'
          ? Math.min(Math.max(parsed.estimatedResolutionDays, 1), 90)
          : 30,
    };
  }

  // If AI fails, the appeal still gets submitted — just with neutral defaults
  private fallbackResult(): AppealAnalysisResult {
    return {
      category: AppealCategory.OTHER,
      priority: AppealPriority.MEDIUM,
      reasoning: 'Automatic classification unavailable',
      estimatedResolutionDays: 30,
    };
  }
}
