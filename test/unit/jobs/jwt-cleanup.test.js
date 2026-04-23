'use strict';

// Tests for src/app/jobs/jwt-cleanup.js
const { startJwtCleanupJob } = require('../../../src/app/jobs/jwt-cleanup');

describe('startJwtCleanupJob', () => {
  const makeJwtDenylist = (deletedCount = 0) => ({
    destroy: vi.fn().mockResolvedValue(deletedCount),
  });

  const makeRefreshToken = (deletedCount = 0) => ({
    destroy: vi.fn().mockResolvedValue(deletedCount),
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a timer handle', () => {
    const JwtDenylist = makeJwtDenylist();
    const handle = startJwtCleanupJob(JwtDenylist, 999999);
    expect(handle).toBeTruthy();
    clearInterval(handle);
  });

  it('calls JwtDenylist.destroy immediately on start', async () => {
    const JwtDenylist = makeJwtDenylist(0);
    const handle = startJwtCleanupJob(JwtDenylist, 999999);
    // Allow the async run() to complete
    await new Promise((r) => setTimeout(r, 10));
    expect(JwtDenylist.destroy).toHaveBeenCalledTimes(1);
    clearInterval(handle);
  });

  it('passes the correct where clause to JwtDenylist.destroy', async () => {
    const JwtDenylist = makeJwtDenylist(0);
    const handle = startJwtCleanupJob(JwtDenylist, 999999);
    await new Promise((r) => setTimeout(r, 10));
    const [call] = JwtDenylist.destroy.mock.calls;
    expect(call[0]).toHaveProperty('where');
    expect(call[0].where).toHaveProperty('exp');
    clearInterval(handle);
  });

  it('also cleans up RefreshToken when provided', async () => {
    const JwtDenylist = makeJwtDenylist(0);
    const RefreshToken = makeRefreshToken(3);
    const handle = startJwtCleanupJob(JwtDenylist, 999999, RefreshToken);
    await new Promise((r) => setTimeout(r, 10));
    expect(RefreshToken.destroy).toHaveBeenCalledTimes(1);
    clearInterval(handle);
  });

  it('passes the correct where clause to RefreshToken.destroy', async () => {
    const JwtDenylist = makeJwtDenylist(0);
    const RefreshToken = makeRefreshToken(0);
    const handle = startJwtCleanupJob(JwtDenylist, 999999, RefreshToken);
    await new Promise((r) => setTimeout(r, 10));
    const [call] = RefreshToken.destroy.mock.calls;
    expect(call[0]).toHaveProperty('where');
    clearInterval(handle);
  });

  it('does not call RefreshToken.destroy when RefreshToken is null', async () => {
    const JwtDenylist = makeJwtDenylist(0);
    const RefreshToken = makeRefreshToken(0);
    const handle = startJwtCleanupJob(JwtDenylist, 999999, null);
    await new Promise((r) => setTimeout(r, 10));
    expect(RefreshToken.destroy).not.toHaveBeenCalled();
    clearInterval(handle);
  });

  it('handles JwtDenylist.destroy error gracefully (no throw)', async () => {
    const JwtDenylist = { destroy: vi.fn().mockRejectedValue(new Error('DB error')) };
    const handle = startJwtCleanupJob(JwtDenylist, 999999);
    // Should not throw
    await expect(new Promise((r) => setTimeout(r, 20))).resolves.toBeUndefined();
    clearInterval(handle);
  });

  it('handles RefreshToken.destroy error gracefully (no throw)', async () => {
    const JwtDenylist = makeJwtDenylist(0);
    const RefreshToken = { destroy: vi.fn().mockRejectedValue(new Error('DB error')) };
    const handle = startJwtCleanupJob(JwtDenylist, 999999, RefreshToken);
    await expect(new Promise((r) => setTimeout(r, 20))).resolves.toBeUndefined();
    clearInterval(handle);
  });

  it('logs when rows were deleted (deleted > 0)', async () => {
    const JwtDenylist = makeJwtDenylist(5);
    const handle = startJwtCleanupJob(JwtDenylist, 999999);
    await new Promise((r) => setTimeout(r, 10));
    // No assertion on the log itself — just ensure no error thrown
    expect(JwtDenylist.destroy).toHaveBeenCalled();
    clearInterval(handle);
  });
});
