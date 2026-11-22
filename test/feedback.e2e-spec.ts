/**
 * E2E for `POST /api/feedback`. The real JWT guard, rate limit guards,
 * controller, FeedbackService and GithubIssuesClient run; only `fetch` (GitHub),
 * the users lookup and Redis are stubbed. AuthController sits in the same app so
 * the spec can prove feedback and login keep separate rate limit buckets.
 */
import { RateLimitGuard, RateLimitService } from '@libs/rate-limit';
import { InMemoryRedis } from '@libs/rate-limit/in-memory-redis.fake';
import { RedisService } from '@libs/redis';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { LoginResponseDto } from '../src/auth/dto/login-response.dto';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { ConfigService } from '../src/config/config.service';
import { FEEDBACK_MESSAGE_MAX_LENGTH } from '../src/feedback/dto/feedback.dto';
import { FeedbackController } from '../src/feedback/feedback.controller';
import { FeedbackRateLimitGuard } from '../src/feedback/feedback-rate-limit.guard';
import { FeedbackService } from '../src/feedback/feedback.service';
import { GithubIssuesClient } from '../src/feedback/github-issues.client';
import { User } from '../src/users/user.entity';
import { UsersService } from '../src/users/users.service';

const JWT_SECRET = 'feedback-e2e-jwt-secret';
const GITHUB_TOKEN = 'ghp_feedback_e2e_secret_token';
const GITHUB_REPO = 'owner/meridiano-nestjs';

const users: Record<string, User> = {
  'user-1': { id: 'user-1', email: 'anahelenasilva@hotmail.com' } as User,
  'user-2': { id: 'user-2', email: 'someone@example.com' } as User,
};

describe('Feedback (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let configService: MockProxy<ConfigService>;
  let authService: MockProxy<AuthService>;
  let fetchSpy: jest.SpyInstance;
  let tokenFor: (userId: string) => string;
  const redis = new InMemoryRedis();

  beforeAll(async () => {
    configService = mock<ConfigService>();
    configService.getJwtSecret.mockReturnValue(JWT_SECRET);
    configService.getMeridianoApiKey.mockReturnValue(undefined);

    const usersService = mock<UsersService>();
    usersService.getUserById.mockImplementation((id: string) =>
      Promise.resolve(users[id] ?? null),
    );
    authService = mock<AuthService>();
    authService.validateUser.mockImplementation((id: string) =>
      usersService.getUserById(id),
    );

    moduleFixture = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [FeedbackController, AuthController],
      providers: [
        FeedbackService,
        GithubIssuesClient,
        FeedbackRateLimitGuard,
        RateLimitGuard,
        RateLimitService,
        JwtStrategy,
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: configService },
        { provide: RedisService, useValue: { getClient: () => redis } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const jwtService = moduleFixture.get(JwtService);
    tokenFor = (userId) => jwtService.sign({ sub: userId });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    redis.clear();
    configService.getGithubFeedbackConfig.mockReturnValue({
      token: GITHUB_TOKEN,
      repo: GITHUB_REPO,
    });
    authService.login.mockResolvedValue(
      new LoginResponseDto('jwt', {
        id: 'user-1',
        email: 'anahelenasilva@hotmail.com',
        username: 'ana',
      }),
    );
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            number: 412,
            html_url: `https://github.com/${GITHUB_REPO}/issues/412`,
          }),
          { status: 201 },
        ),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  const sendFeedback = (body: object, userId: string | null = 'user-1') => {
    const req = request(app.getHttpServer()).post('/api/feedback');
    if (userId) req.set('Authorization', `Bearer ${tokenFor(userId)}`);
    return req.send(body);
  };

  const login = () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'anahelenasilva@hotmail.com', password: 'Password123' });

  const sentIssue = () => {
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return { url, init, body: JSON.parse(init.body as string) };
  };

  it('returns 201 and creates a GitHub issue labelled feedback and no agent:* label', async () => {
    const response = await sendFeedback({
      message: 'The play button overlaps the title',
    }).expect(201);

    expect(response.body).toEqual({
      issueNumber: 412,
      issueUrl: `https://github.com/${GITHUB_REPO}/issues/412`,
    });
    const issue = sentIssue();
    expect(issue.url).toBe(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
    );
    expect(issue.init.headers).toMatchObject({
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    });
    expect(issue.body.labels).toEqual(['feedback']);
    expect(
      issue.body.labels.some((label: string) => label.startsWith('agent:')),
    ).toBe(false);
    expect(issue.body.title).toBe(
      'Feedback: The play button overlaps the title',
    );
    expect(issue.body.body).toContain('an****@h****.***');
    expect(issue.body.body).not.toContain('anahelenasilva@hotmail.com');
  });

  it('returns 401 without a JWT and does not call GitHub', async () => {
    await sendFeedback({ message: 'Hi' }, null).expect(401);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty message', { message: '' }],
    ['a whitespace-only message', { message: '   \n ' }],
    ['a missing message', {}],
    [
      'a message over the length limit',
      { message: 'a'.repeat(FEEDBACK_MESSAGE_MAX_LENGTH + 1) },
    ],
  ])('returns 400 for %s and does not call GitHub', async (_, body) => {
    await sendFeedback(body).expect(400);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 429 on the sixth request from one user within an hour', async () => {
    for (let i = 0; i < 5; i++) {
      await sendFeedback({ message: `Feedback ${i}` }).expect(201);
    }

    const blocked = await sendFeedback({ message: 'One too many' }).expect(429);

    expect(blocked.headers['x-ratelimit-limit']).toBe('5');
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('keeps a separate allowance per user', async () => {
    for (let i = 0; i < 5; i++) {
      await sendFeedback({ message: `Feedback ${i}` }).expect(201);
    }

    await sendFeedback({ message: 'From another user' }, 'user-2').expect(201);
  });

  it('does not share the 429 bucket with POST /api/auth/login', async () => {
    for (let i = 0; i < 5; i++) {
      await sendFeedback({ message: `Feedback ${i}` }).expect(201);
    }
    await sendFeedback({ message: 'One too many' }).expect(429);

    await login().expect(201);
  });

  it('is not blocked when login from the same IP is spent', async () => {
    for (let i = 0; i < 5; i++) {
      await login().expect(201);
    }
    await login().expect(429);

    await sendFeedback({ message: 'Still allowed' }).expect(201);
  });

  it('returns 502 without leaking the token when GitHub fails', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Bad credentials', token: GITHUB_TOKEN }),
        { status: 401 },
      ),
    );

    const response = await sendFeedback({ message: 'Hi' }).expect(502);

    expect(response.body.message).toBe('Could not file the feedback on GitHub');
    expect(JSON.stringify(response.body)).not.toContain(GITHUB_TOKEN);
    expect(response.text).not.toContain(GITHUB_TOKEN);
  });

  it('returns 503 without calling GitHub when the token is unset', async () => {
    configService.getGithubFeedbackConfig.mockReturnValue(null);

    await sendFeedback({ message: 'Hi' }).expect(503);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
