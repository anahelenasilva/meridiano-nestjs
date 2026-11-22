import { Injectable } from '@nestjs/common';

const GITHUB_API_URL = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 10_000;
const ERROR_DETAIL_MAX_LENGTH = 300;

export interface GithubRepoAccess {
  token: string;
  /** `owner/name` */
  repo: string;
}

export interface GithubIssueToCreate {
  title: string;
  body: string;
  labels: string[];
}

export interface CreatedGithubIssue {
  number: number;
  url: string;
}

/** Its message names the repo and GitHub's answer, never the token. */
export class GithubIssueError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GithubIssueError';
  }
}

@Injectable()
export class GithubIssuesClient {
  async createIssue(
    access: GithubRepoAccess,
    issue: GithubIssueToCreate,
  ): Promise<CreatedGithubIssue> {
    const response = await this.post(access, issue);

    if (!response.ok) {
      const detail = (await response.text().catch(() => ''))
        .split(access.token)
        .join('[redacted]')
        .slice(0, ERROR_DETAIL_MAX_LENGTH);
      throw new GithubIssueError(
        `GitHub answered ${response.status} creating an issue on ${access.repo}: ${detail}`,
        response.status,
      );
    }

    const created = (await response.json().catch(() => null)) as {
      number?: unknown;
      html_url?: unknown;
    } | null;
    if (
      typeof created?.number !== 'number' ||
      typeof created.html_url !== 'string'
    ) {
      throw new GithubIssueError(
        `GitHub created an issue on ${access.repo} but its answer had no number or html_url`,
        response.status,
      );
    }
    return { number: created.number, url: created.html_url };
  }

  private async post(
    access: GithubRepoAccess,
    issue: GithubIssueToCreate,
  ): Promise<Response> {
    try {
      return await fetch(`${GITHUB_API_URL}/repos/${access.repo}/issues`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${access.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'meridiano-api',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(issue),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new GithubIssueError(
        `GitHub request to create an issue on ${access.repo} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
