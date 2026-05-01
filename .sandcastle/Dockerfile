FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Preinstall the repo's package manager directly so sandbox hooks do not depend
# on Corepack downloads or prompts at runtime.
RUN npm install -g pnpm@10

# Rename the base image's "node" user to "agent" and align it with the host
# UID/GID Sandcastle uses when starting Docker containers.
ARG HOST_UID=1000
ARG HOST_GID=1000
RUN set -eux; \
  if getent group "${HOST_GID}" >/dev/null; then \
  :; \
  else \
  groupadd -g "${HOST_GID}" agenthost; \
  fi; \
  usermod -u "${HOST_UID}" -g "${HOST_GID}" -d /home/agent -m -l agent node
USER agent

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Sandcastle starts the container with the host UID/GID, which often does not
# exist in the image on macOS. Make the home directory writable for arbitrary
# runtime users, and pre-create the common state directories they need.
USER root
RUN mkdir -p \
  /home/agent/.cache \
  /home/agent/.claude \
  /home/agent/.config \
  /home/agent/.local/share/pnpm \
  /home/agent/.local/state \
  /home/agent/.npm \
  && chmod 1777 /home/agent \
  && chmod -R a+rwX \
  /home/agent/.cache \
  /home/agent/.claude \
  /home/agent/.config \
  /home/agent/.local/share \
  /home/agent/.local/state \
  /home/agent/.npm \
  && chmod -R a+rX /home/agent/.local
USER agent

# HOME must be explicit: when Docker runs as an arbitrary host UID (no /etc/passwd entry),
# it does not derive HOME from the image's user record, so it falls back to /.
# pnpm's store and config dirs are under $HOME, so an unset HOME breaks installs.
ENV HOME="/home/agent"
ENV PATH="/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
