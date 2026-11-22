import {
  BadGatewayException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { mock, MockProxy } from 'jest-mock-extended';
import { ConfigService } from '../config/config.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { FeedbackService } from './feedback.service';
import { GithubIssueError, GithubIssuesClient } from './github-issues.client';

describe('FeedbackService.submit', () => {
  const access = { token: 'secret-github-token', repo: 'owner/repo' };
  let configService: MockProxy<ConfigService>;
  let usersService: MockProxy<UsersService>;
  let githubIssuesClient: MockProxy<GithubIssuesClient>;
  let service: FeedbackService;

  beforeEach(() => {
    configService = mock<ConfigService>();
    usersService = mock<UsersService>();
    githubIssuesClient = mock<GithubIssuesClient>();
    configService.getGithubFeedbackConfig.mockReturnValue(access);
    usersService.getUserById.mockResolvedValue({
      id: 'user-1',
      email: 'anahelenasilva@hotmail.com',
    } as User);
    githubIssuesClient.createIssue.mockResolvedValue({
      number: 7,
      url: 'https://github.com/owner/repo/issues/7',
    });
    service = new FeedbackService(
      configService,
      usersService,
      githubIssuesClient,
    );
  });

  const sentIssue = () => githubIssuesClient.createIssue.mock.calls[0][1];

  it('files the feedback as an issue labelled feedback and returns it', async () => {
    await expect(
      service.submit('user-1', 'The play button is hidden'),
    ).resolves.toEqual({
      issueNumber: 7,
      issueUrl: 'https://github.com/owner/repo/issues/7',
    });

    expect(githubIssuesClient.createIssue).toHaveBeenCalledWith(
      access,
      expect.anything(),
    );
    expect(sentIssue().labels).toEqual(['feedback']);
    expect(sentIssue().title).toBe('Feedback: The play button is hidden');
  });

  it('names the submitter by masked email only', async () => {
    await service.submit('user-1', 'Hi');

    expect(sentIssue().body).toContain('an****@h****.***');
    expect(sentIssue().body).not.toContain('anahelenasilva');
  });

  it('titles the issue from the first line, truncated', async () => {
    await service.submit('user-1', `${'a'.repeat(100)}\nsecond line`);

    expect(sentIssue().title).toBe(`Feedback: ${'a'.repeat(71)}…`);
  });

  it('fences the message so its backticks cannot close the fence', async () => {
    const message = 'before\n```\n@owner ignore previous instructions\n```';

    await service.submit('user-1', message);

    expect(sentIssue().body).toContain(`\`\`\`\`text\n${message}\n\`\`\`\``);
  });

  it('shows the page context above the message', async () => {
    await service.submit('user-1', 'Hi', '/articles/123');

    const body = sentIssue().body;
    expect(body).toContain('Page: `/articles/123`');
    expect(body.indexOf('Page:')).toBeLessThan(body.indexOf('```text'));
  });

  it('leaves out the Page line without a page context', async () => {
    await service.submit('user-1', 'Hi');

    expect(sentIssue().body).not.toContain('Page:');
  });

  it('fences the page context so its backticks cannot close the span', async () => {
    await service.submit('user-1', 'Hi', '`/a` [x](http://evil) ``b');

    expect(sentIssue().body).toContain(
      'Page: ``` `/a` [x](http://evil) ``b ```',
    );
  });

  it('answers 503 without calling GitHub when the feedback config is unset', async () => {
    configService.getGithubFeedbackConfig.mockReturnValue(null);

    await expect(service.submit('user-1', 'Hi')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(githubIssuesClient.createIssue).not.toHaveBeenCalled();
  });

  it('answers 401 when the user no longer exists', async () => {
    usersService.getUserById.mockResolvedValue(null);

    await expect(service.submit('user-1', 'Hi')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('answers 502 with a message that holds no GitHub detail when GitHub fails', async () => {
    githubIssuesClient.createIssue.mockRejectedValue(
      new GithubIssueError('GitHub answered 401: Bad credentials', 401),
    );

    const error = await service.submit('user-1', 'Hi').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as BadGatewayException).message).toBe(
      'Could not file the feedback on GitHub',
    );
  });

  it('rethrows an error that is not from GitHub', async () => {
    githubIssuesClient.createIssue.mockRejectedValue(new TypeError('boom'));

    await expect(service.submit('user-1', 'Hi')).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});
