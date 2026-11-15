# E2E tests

`test/jest-e2e.json` sets `forceExit`. A spec whose `createTestingModule().compile()`
throws never gets an app to close, so the ioredis socket `RedisService` opens in its
constructor stays open and Jest waits on it forever (issue #329). `forceExit` makes the
suite report its result and exit. If you need to find a new leak, drop it for the run and
add `--detectOpenHandles`.
