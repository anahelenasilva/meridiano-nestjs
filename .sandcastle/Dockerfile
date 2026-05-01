FROM node:22-bookworm

# Build args to match host UID/GID (required on macOS where host UID != 1000)
ARG HOST_UID=1000
ARG HOST_GID=1000

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

# Rename the base image's "node" user to "agent" and align UID/GID with host.
# On macOS the host user is typically UID 501 / GID 20 (staff).
# GID 20 is "dialout" on Debian — move it aside first if needed.
RUN usermod -d /home/agent -m -l agent node \
    && if [ "${HOST_GID}" != "1000" ]; then \
         existing=$(getent group ${HOST_GID} | cut -d: -f1); \
         if [ -n "$existing" ]; then groupmod -g 9${HOST_GID} "$existing"; fi; \
         groupadd -g ${HOST_GID} hostgroup; \
       fi \
    && if [ "${HOST_UID}" != "1000" ]; then \
         usermod -u ${HOST_UID} agent; \
       fi \
    && if [ "${HOST_GID}" != "1000" ]; then \
         usermod -g ${HOST_GID} agent; \
       fi \
    && chown -R ${HOST_UID}:${HOST_GID} /home/agent
USER agent

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude to PATH
ENV PATH="/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
