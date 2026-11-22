import { RateLimit } from '@libs/rate-limit';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { CreateFeedbackDto, FeedbackResponseDto } from './dto/feedback.dto';
import {
  FEEDBACK_RATE_LIMIT,
  FeedbackRateLimitGuard,
} from './feedback-rate-limit.guard';
import { FeedbackService } from './feedback.service';

@Controller('api/feedback')
@ApiAuthErrorResponse()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(FeedbackRateLimitGuard)
  @RateLimit(FEEDBACK_RATE_LIMIT)
  @ApiOperation({
    summary: 'Send feedback, filed as a GitHub issue labelled feedback',
  })
  @ApiCreatedResponse({ type: FeedbackResponseDto })
  @ApiValidationErrorResponse()
  @ApiResponse({
    status: 429,
    description: `More than ${FEEDBACK_RATE_LIMIT.maxAttempts} feedback requests from this user in ${FEEDBACK_RATE_LIMIT.windowMs / 60_000} minutes`,
  })
  @ApiBadGatewayResponse({ description: 'GitHub did not create the issue' })
  @ApiServiceUnavailableResponse({
    description: 'GITHUB_FEEDBACK_TOKEN or GITHUB_FEEDBACK_REPO is unset',
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    return this.feedbackService.submit(user.id, dto.message);
  }
}
