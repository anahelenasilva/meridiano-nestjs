import { GithubIssueError, GithubIssuesClient } from './github-issues.client';

describe('GithubIssuesClient.createIssue', () => {
  const access = { token: 'secret-github-token', repo: 'owner/repo' };
  const issue = { title: 'Feedback: hi', body: 'hi', labels: ['feedback'] };
  let fetchSpy: jest.SpyInstance;
  const client = new GithubIssuesClient();

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('posts the issue to the repo with the token and returns its number and url', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          number: 42,
          html_url: 'https://github.com/owner/repo/issues/42',
        }),
        { status: 201 },
      ),
    );

    await expect(client.createIssue(access, issue)).resolves.toEqual({
      number: 42,
      url: 'https://github.com/owner/repo/issues/42',
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/owner/repo/issues');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer secret-github-token',
    });
    expect(JSON.parse(init.body as string)).toEqual(issue);
  });

  it('throws a GithubIssueError with the status when GitHub refuses, without the token', async () => {
    fetchSpy.mockResolvedValue(
      new Response('{"message":"Bad credentials"}', { status: 401 }),
    );

    const error = await client
      .createIssue(access, issue)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubIssueError);
    expect((error as GithubIssueError).status).toBe(401);
    expect((error as GithubIssueError).message).toContain('Bad credentials');
    expect((error as GithubIssueError).message).not.toContain(access.token);
  });

  it('redacts the token when GitHub echoes it back', async () => {
    fetchSpy.mockResolvedValue(
      new Response(`{"token":"${access.token}"}`, { status: 422 }),
    );

    const error = await client
      .createIssue(access, issue)
      .catch((e: unknown) => e);

    expect((error as GithubIssueError).message).toContain('[redacted]');
    expect((error as GithubIssueError).message).not.toContain(access.token);
  });

  it('throws a GithubIssueError when the request itself fails', async () => {
    fetchSpy.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    await expect(client.createIssue(access, issue)).rejects.toThrow(
      new GithubIssueError(
        'GitHub request to create an issue on owner/repo failed: getaddrinfo ENOTFOUND',
      ),
    );
  });

  it('throws a GithubIssueError when the answer has no issue number', async () => {
    fetchSpy.mockResolvedValue(new Response('{}', { status: 201 }));

    await expect(client.createIssue(access, issue)).rejects.toBeInstanceOf(
      GithubIssueError,
    );
  });
});
