import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import type { NoteSourceType } from '../notes/note.entity';
import { truncateToChatTokens } from '../shared/helpers/token-estimation';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions/services/youtube-transcriptions.service';
import { ANSWERER, type Answerer, type AnswerInput } from './answerer';
import { CHAT_MODEL_IDS, type ValidChatModel } from '../config/config.entity';
import type { AskModelDto, AskRequestDto, AskResponseDto } from './dto/ask.dto';

// Matches the cap transcript structure extraction uses (issue #390).
const MAX_SOURCE_TOKENS = 50_000;

const CHAT_MODEL_LABELS: Record<ValidChatModel, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
};

interface AskSource {
  title: string;
  text: string;
}

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  constructor(
    private readonly articlesService: ArticlesService,
    private readonly youtubeTranscriptionsService: YoutubeTranscriptionsService,
    private readonly configService: ConfigService,
    @Inject(ANSWERER) private readonly answerer: Answerer,
  ) {}

  async ask(request: AskRequestDto): Promise<AskResponseDto> {
    const source = await this.loadSource(
      request.source_type,
      request.source_id,
    );
    const sourceText = truncateToChatTokens(source.text, MAX_SOURCE_TOKENS);
    const model = request.model ?? this.configService.getEnabledChatModel();

    const answer = await this.answerOrThrow(request, {
      model,
      sourceTitle: source.title,
      sourceText,
      history: request.history ?? [],
      question: request.question,
    });

    return {
      answer,
      model,
      truncated: sourceText.length < source.text.length,
    };
  }

  listModels(): AskModelDto[] {
    const { deepseekChatModel, openaiChatModel } =
      this.configService.getModelConfig();
    const modelNames: Record<ValidChatModel, string> = {
      deepseek: deepseekChatModel,
      openai: openaiChatModel,
    };
    const defaultModel = this.configService.getEnabledChatModel();

    return CHAT_MODEL_IDS.map((id) => ({
      id,
      label: CHAT_MODEL_LABELS[id],
      model_name: modelNames[id],
      is_default: id === defaultModel,
    }));
  }

  private async answerOrThrow(
    request: AskRequestDto,
    input: AnswerInput,
  ): Promise<string> {
    const context = `${request.source_type} ${request.source_id} (${input.model})`;
    let answer: string;
    try {
      answer = await this.answerer.answer(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Ask failed for ${context}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException(
        `The chat model failed to answer: ${message}`,
      );
    }

    if (!answer.trim()) {
      this.logger.error(`Ask got an empty answer for ${context}`);
      throw new BadGatewayException('The chat model returned an empty answer');
    }
    return answer;
  }

  private async loadSource(
    sourceType: NoteSourceType,
    sourceId: string,
  ): Promise<AskSource> {
    if (sourceType === 'article') {
      const article = await this.articlesService.getArticleById(sourceId);
      if (!article) {
        throw new NotFoundException('Article not found');
      }
      return { title: article.title, text: article.raw_content };
    }

    const transcription =
      await this.youtubeTranscriptionsService.getTranscriptionById(sourceId);
    if (!transcription) {
      throw new NotFoundException('YouTube transcription not found');
    }
    return {
      title: transcription.videoTitle,
      text: transcription.transcriptionText,
    };
  }
}
