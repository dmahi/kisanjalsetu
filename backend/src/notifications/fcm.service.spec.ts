import { FcmService } from './fcm.service';

const UID = '64b000000000000000000001';
const UID2 = '64b000000000000000000002';

function makeModel(overrides: Record<string, unknown> = {}) {
  const model = {
    updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'new-dev' }),
    }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) }),
    deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: 'dev1', token: 'tok-a' },
          { _id: 'dev2', token: 'tok-b' },
        ]),
      }),
    }),
    ...overrides,
  };
  return model;
}

function makePush(behavior: { ok?: boolean; permanent?: boolean; error?: string } = {}) {
  return {
    send: jest.fn().mockResolvedValue({
      ok: true,
      permanent: false,
      ...behavior,
    }),
  };
}

function makeService(model: ReturnType<typeof makeModel>, push: ReturnType<typeof makePush>) {
  return new FcmService(model as any, push as any);
}

describe('FcmService.registerToken', () => {
  it('deactivates the old token when the same device reports a rotated token', async () => {
    const model = makeModel();
    const svc = makeService(model, makePush());

    await svc.registerToken(UID, { token: 'tok-new', deviceId: 'abc' });

    // 1) rotation by deviceId, 2) same-token reassign to another user.
    expect(model.updateMany).toHaveBeenNthCalledWith(
      1,
      { deviceId: 'abc', token: { $ne: 'tok-new' }, isActive: true },
      expect.objectContaining({ isActive: false, failureReason: 'replaced_by_refresh' }),
    );
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-new' }),
      expect.objectContaining({ $set: expect.objectContaining({ deviceId: 'abc', isActive: true }) }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('marks the same token registered under another account inactive (handover)', async () => {
    const model = makeModel();
    const svc = makeService(model, makePush());

    await svc.registerToken(UID2, { token: 'shared-tok' });

    expect(model.updateMany).toHaveBeenCalledWith(
      { token: 'shared-tok', userId: { $ne: expect.anything() }, isActive: true },
      expect.objectContaining({ failureReason: 'reassigned_to_another_user' }),
    );
  });

  it('reactivates a previously-logged-out token without duplicating it', async () => {
    const model = makeModel();
    const svc = makeService(model, makePush());

    await svc.registerToken(UID, { token: 'tok-x' });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-x' }),
      expect.objectContaining({ $set: expect.objectContaining({ isActive: true, lastSeenAt: expect.any(Date) }) }),
      expect.objectContaining({ upsert: true }),
    );
  });
});

describe('FcmService.deactivateUserDeviceToken (logout)', () => {
  it('deactivates only the exact token belonging to the user', async () => {
    const model = makeModel();
    const svc = makeService(model, makePush());

    await expect(svc.deactivateUserDeviceToken(UID, 'tok-a')).resolves.toBe(true);

    expect(model.updateOne).toHaveBeenCalledWith(
      { userId: expect.anything(), token: 'tok-a' },
      expect.objectContaining({ isActive: false, failureReason: 'logged_out' }),
    );
  });

  it('returns false when no matching token was modified', async () => {
    const model = makeModel();
    model.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }) });
    const svc = makeService(model, makePush());

    await expect(svc.deactivateUserDeviceToken(UID, 'unknown')).resolves.toBe(false);
  });
});

describe('FcmService.sendToUser', () => {
  it('tracks success per device and does not deactivate', async () => {
    const model = makeModel();
    const svc = makeService(model, makePush());

    const res = await svc.sendToUser(UID, { title: 'Hi', body: 'There' });

    expect(model.find).toHaveBeenCalledWith({ userId: expect.anything(), isActive: true });
    expect(res).toEqual({ sent: 2, failed: 0, deactivated: 0 });
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'dev1' },
      expect.objectContaining({ lastSuccessAt: expect.any(Date) }),
    );
  });

  it('deactivates on permanent FCM errors, keeps active on transient errors', async () => {
    const model = makeModel();
    const push = makePush();
    push.send
      .mockResolvedValueOnce({ ok: false, permanent: true, error: 'UNREGISTERED' })
      .mockResolvedValueOnce({ ok: false, permanent: false, error: 'temporarily overloaded' });
    const svc = makeService(model, push);

    const res = await svc.sendToUser(UID, { title: 'Hi' });

    expect(res).toEqual({ sent: 0, failed: 2, deactivated: 1 });
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'dev1' },
      expect.objectContaining({ isActive: false, failureReason: 'UNREGISTERED' }),
    );
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'dev2' },
      expect.not.objectContaining({ isActive: false }),
    );
  });

  it('counts successes when all devices receive the message', async () => {
    const model = makeModel();
    const svc = makeService(model, makePush());

    await expect(svc.sendToUser(UID, { title: 'x' })).resolves.toEqual({ sent: 2, failed: 0, deactivated: 0 });
  });
});

describe('FcmService.sendToTokens / sendToToken', () => {
  it('deactivates an unregistered token in a token batch without breaking others', async () => {
    const model = makeModel();
    const push = makePush();
    push.send
      .mockResolvedValueOnce({ ok: false, permanent: true, error: 'UNREGISTERED' })
      .mockResolvedValueOnce({ ok: true, permanent: false });
    const svc = makeService(model, push);

    await svc.sendToTokens(['bad-tok', 'good-tok'], { title: 'Bulk' });

    expect(push.send).toHaveBeenCalledTimes(2);
    expect(model.updateOne).toHaveBeenCalledWith(
      { token: 'bad-tok', isActive: true },
      expect.objectContaining({ isActive: false, failureReason: 'UNREGISTERED' }),
    );
  });

  it('records a permanent failure when sending to a single token', async () => {
    const model = makeModel();
    const push = makePush({ ok: false, permanent: true, error: 'NOT_FOUND' });
    const svc = makeService(model, push);

    const res = await svc.sendToToken(UID, 'single-tok', { title: 'x' });

    expect(res.permanent).toBe(true);
    expect(model.updateOne).toHaveBeenCalledWith(
      { userId: expect.anything(), token: 'single-tok', isActive: true },
      expect.objectContaining({ isActive: false }),
    );
  });
});