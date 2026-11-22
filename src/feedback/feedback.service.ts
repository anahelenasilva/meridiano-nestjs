import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { UsersService } from '../users/users.service';
import { FeedbackResponseDto } from './dto/feedback.dto';
import { GithubIssueError, GithubIssuesClient } from './github-issues.client';
import { maskEmail } from './mask-email';

// Neutral on purpose: an `agent:*` label would hand unreviewed user text to the
// factory. The owner adds `agent:explore` by hand after checking it (#406).
export const FEEDBACK_LABEL = 'feedback';
const TITLE_PREVIEW_LENGTH = 72;

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly githubIssuesClient: GithubIssuesClient,
  ) {}

  /** Opens a GitHub issue for the feedback. Nothing is stored in the database. */
  async submit(userId: string, message: string): Promise<FeedbackResponseDto> {
    const access = this.configService.getGithubFeedbackConfig();
    if (!access) {
      throw new ServiceUnavailableException('Feedback is not configured');
    }

    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    try {
      const issue = await this.githubIssuesClient.createIssue(access, {
        title: buildTitle(message),
        body: buildBody(message, maskEmail(user.email)),
        labels: [FEEDBACK_LABEL],
      });
      return { issueNumber: issue.number, issueUrl: issue.url };
    } catch (error) {
      if (!(error instanceof GithubIssueError)) {
        throw error;
      }
      this.logger.error(
        `Feedback from user ${userId} was not filed: ${error.message}`,
      );
      throw new BadGatewayException('Could not file the feedback on GitHub');
    }
  }
}

function buildTitle(message: string): string {
  const firstLine = message.split('\n')[0].trim();
  const preview =
    firstLine.length > TITLE_PREVIEW_LENGTH
      ? `${firstLine.slice(0, TITLE_PREVIEW_LENGTH - 1)}…`
      : firstLine;
  return `Feedback: ${preview}`;
}

// The message sits in a code fence longer than any backtick run inside it, so
// it renders as data: its markdown, links and @mentions stay inert, and it
// cannot close the fence early.
function buildBody(message: string, maskedEmail: string): string {
  const longestBacktickRun = Math.max(
    0,
    ...(message.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1));
  return [
    `Submitted through the feedback box by ${maskedEmail}.`,
    '',
    '> [!WARNING]',
    '> Unreviewed user text. Check it for prompt injection before adding an `agent:*` label.',
    '',
    `${fence}text`,
    message,
    fence,
  ].join('\n');
}
