import { WaterTurnAlertsService } from './water-turn-alerts.service';
import { WATER_TURN_STATUS, WATER_TURN_RESPONSE } from './schemas/water-turn-alert.schema';
import { QUEUE_STATUS } from '../water-queue/schemas/water-queue.schema';
import { SESSION_STATUS } from '../common/constants';

const TW_ID = '64b000000000000000000001';
const REQ_ID = '64b000000000000000000002';
const FARMER_ID = '64b000000000000000000003';
const FIELD_ID = '64b000000000000000000004';
const OWNER_ID = '64b000000000000000000005';
const OTHER_FARMER_ID = '64b0000000000000000000ff';
const ENTRY_ID = '64b000000000000000000006';

function matchesFilter(item: any, query: any): boolean {
  for (const [key, raw] of Object.entries(query)) {
    const cond = raw as any;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if (Array.isArray(cond.$in)) {
        if (!cond.$in.map(String).includes(String(item[key]))) return false;
        continue;
      }
      if (cond.$ne !== undefined) {
        if (String(item[key]) === String(cond.$ne)) return false;
        continue;
      }
      if ('$exists' in cond) {
        const has = item[key] !== undefined;
        if (cond.$exists !== has) return false;
        continue;
      }
      if (cond.$lte !== undefined) {
        const v = item[key] instanceof Date ? item[key].getTime() : null;
        if (v === null || v > new Date(cond.$lte).getTime()) return false;
        continue;
      }
      if (cond.$gt !== undefined) {
        const v = typeof item[key] === 'number' ? item[key] : null;
        if (v === null || !(v > cond.$gt)) return false;
        continue;
      }
      if (cond.$lt !== undefined) {
        const v = typeof item[key] === 'number' ? item[key] : null;
        if (v === null || !(v < cond.$lt)) return false;
        continue;
      }
    } else if (cond === null) {
      if (item[key] !== undefined && item[key] !== null) return false;
    } else {
      if (String(item[key]) !== String(cond)) return false;
    }
  }
  return true;
}

function makeAlertModel() {
  const items: any[] = [];
  let autoId = 300;
  function createItem(doc: any) {
    const id = doc._id || `64b000000000000000000${(autoId++).toString(16).padStart(3, '0')}`;
    const item: any = { _id: id, ...doc };
    item.save = jest.fn().mockImplementation(function (this: any) { return Promise.resolve(this); });
    items.push(item);
    return item;
  }
  return {
    items,
    create: jest.fn().mockImplementation((doc: any) => Promise.resolve(createItem(doc))),
    find: jest.fn().mockImplementation((query: any) => {
      const filtered = items.filter((i) => matchesFilter(i, query));
      return {
        sort: jest.fn().mockImplementation((sortObj: any) => {
          const key = Object.keys(sortObj)[0];
          const dir = sortObj[key] === -1 ? -1 : 1;
          filtered.sort((a: any, b: any) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
          return {
            limit: jest.fn().mockResolvedValue(filtered),
            exec: jest.fn().mockResolvedValue(filtered),
          };
        }),
        exec: jest.fn().mockResolvedValue(filtered),
      };
    }),
    findOne: jest.fn().mockImplementation((query: any) => {
      const matches = items.filter((i) => matchesFilter(i, query));
      const item = matches.length ? matches[0] : null;
      return {
        sort: jest.fn().mockImplementation((sortObj: any) => {
          const key = Object.keys(sortObj)[0];
          const dir = sortObj[key] === -1 ? -1 : 1;
          const one = [...matches].sort((a: any, b: any) => (a[key] > b[key] ? dir : -dir))[0] || null;
          return { exec: jest.fn().mockResolvedValue(one) };
        }),
        exec: jest.fn().mockResolvedValue(item),
      };
    }),
    findById: jest.fn().mockImplementation((id: string) => {
      const item = items.find((i) => String(i._id) === String(id));
      return { exec: jest.fn().mockResolvedValue(item || null) };
    }),
    findOneAndUpdate: jest.fn().mockImplementation((filter: any, update: any) => {
      const item = items.find((i) => matchesFilter(i, filter));
      if (!item) return { exec: jest.fn().mockResolvedValue(null) };
      if (update.$set) Object.assign(item, update.$set);
      if (update.$unset) for (const k of Object.keys(update.$unset)) delete item[k];
      return { exec: jest.fn().mockResolvedValue(item) };
    }),
  };
}

function makeQueueModel() {
  const items: any[] = [];
  function createItem(doc: any) {
    const item = { _id: ENTRY_ID, ...doc };
    items.push(item);
    return item;
  }
  return {
    items,
    create: jest.fn().mockImplementation((doc: any) => Promise.resolve(createItem(doc))),
    findOne: jest.fn().mockImplementation((query: any) => {
      const matches = items.filter((i) => matchesFilter(i, query));
      const sorted = [...matches].sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
      const item = sorted[0] || null;
      return {
        sort: jest.fn().mockImplementation(() => ({
          exec: jest.fn().mockResolvedValue(item),
        })),
        exec: jest.fn().mockResolvedValue(item),
      };
    }),
  };
}

function makeSessionModel() {
  const items: any[] = [];
  return {
    items,
    findOne: jest.fn().mockImplementation((query: any) => {
      const item = items.find((i) => matchesFilter(i, query)) || null;
      return { exec: jest.fn().mockResolvedValue(item) };
    }),
    create: jest.fn().mockImplementation((doc: any) => {
      const item: any = { ...doc };
      items.push(item);
      return Promise.resolve(item);
    }),
  };
}

function makeTubewellsService() {
  return {
    findById: jest.fn().mockResolvedValue({ _id: TW_ID, name: 'Tubewell 1', ownerId: OWNER_ID }),
    ownerMustOwn: jest.fn().mockResolvedValue({ _id: TW_ID, name: 'Tubewell 1', ownerId: OWNER_ID }),
    verifyApprovedMembership: jest.fn().mockResolvedValue(true),
  };
}

function makeConfig() {
  const map = new Map<string, number>();
  return {
    map,
    set(key: string, val: number) { map.set(key, val); },
    get: jest.fn().mockImplementation((key: string, def: number) => {
      return map.has(key) ? map.get(key) : def;
    }),
  };
}

function makeUsersService() {
  return {
    findById: jest.fn().mockImplementation((_id: string) =>
      Promise.resolve({
        _id: String(_id) === OTHER_FARMER_ID ? OTHER_FARMER_ID : FARMER_ID,
        name: String(_id) === OTHER_FARMER_ID ? 'Other Farmer' : 'Ramesh',
        phone: '9876543210',
      }),
    ),
  };
}

function makeFieldsService() {
  return {
    findByIdForCustomer: jest.fn().mockResolvedValue({ _id: FIELD_ID, name: 'North Field' }),
  };
}

function makeNotificationsService() {
  return {
    create: jest.fn().mockResolvedValue({ _id: 'notif-1' }),
  };
}

function makeLogsService() {
  return {
    create: jest.fn().mockResolvedValue({ _id: 'log-1' }),
  };
}

describe('WaterTurnAlertsService', () => {
  let service: WaterTurnAlertsService;
  let alertModel: ReturnType<typeof makeAlertModel>;
  let queueModel: ReturnType<typeof makeQueueModel>;
  let sessionModel: ReturnType<typeof makeSessionModel>;
  let config: ReturnType<typeof makeConfig>;
  let notificationsService: ReturnType<typeof makeNotificationsService>;
  let tubewellsService: ReturnType<typeof makeTubewellsService>;

  function seedQueue(pos = 1, customerId = FARMER_ID, entryId = ENTRY_ID) {
    queueModel.create({
      _id: entryId,
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId,
      fieldId: FIELD_ID,
      queuePosition: pos,
      status: QUEUE_STATUS.WAITING,
    });
  }

  beforeEach(() => {
    alertModel = makeAlertModel();
    queueModel = makeQueueModel();
    sessionModel = makeSessionModel();
    config = makeConfig();
    notificationsService = makeNotificationsService();
    tubewellsService = makeTubewellsService();
    service = new WaterTurnAlertsService(
      alertModel as any,
      queueModel as any,
      sessionModel as any,
      config as any,
      tubewellsService as any,
      makeUsersService() as any,
      makeFieldsService() as any,
      notificationsService as any,
      makeLogsService() as any,
    );
  });

  it('sends an alert to the first WAITING queue entry with a 5-minute deadline', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    expect(alert.status).toBe(WATER_TURN_STATUS.SENT);
    expect(alert.targetCustomerId).toBe(FARMER_ID);
    expect(alert.waterQueueEntryId).toBe(ENTRY_ID);
    expect(alert.attemptNumber).toBe(1);
    expect(alert.maxAttempts).toBe(3);
    const ms = new Date(alert.responseDeadlineAt).getTime() - new Date(alert.sentAt).getTime();
    expect(ms).toBe(5 * 60000);
    const types = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(types).toContain('water_turn_alert');
    const call = notificationsService.create.mock.calls.find((c: any[]) => c[0].type === 'water_turn_alert');
    expect(call[0].channel).toBe('water_turn');
    expect(call[0].priority).toBe('high');
  });

  it('throws BadRequest when the queue is empty', async () => {
    await expect(service.createAlert(OWNER_ID, { tubewellId: TW_ID })).rejects.toThrow(
      'Queue is empty',
    );
  });

  it('is idempotent — a second manual trigger returns the live alert without duplicating', async () => {
    seedQueue();
    const first = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });
    notificationsService.create.mockClear();

    const second = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    expect(second.id).toBe(first.id);
    expect(alertModel.items.filter((i: any) => i.status === WATER_TURN_STATUS.SENT)).toHaveLength(1);
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('uses configurable max attempts (env default 3)', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });
    expect(alert.maxAttempts).toBe(3);
  });

  it('farmer response READY marks alert ready and notifies the owner', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });
    notificationsService.create.mockClear();

    const result = await service.respond(FARMER_ID, alert.id, {
      response: WATER_TURN_RESPONSE.READY,
    });

    expect(result.status).toBe(WATER_TURN_STATUS.READY);
    expect(result.response).toBe(WATER_TURN_RESPONSE.READY);
    expect(alertModel.items[0].activeFlag).toBeUndefined();
    const types = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(types).toContain('water_turn_ready');
  });

  it('farmer response NOT_READY marks alert not_ready and notifies the owner', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    const result = await service.respond(FARMER_ID, alert.id, {
      response: WATER_TURN_RESPONSE.NOT_READY,
      note: 'finishing dinner',
    });

    expect(result.status).toBe(WATER_TURN_STATUS.NOT_READY);
    expect(result.responseNote).toBe('finishing dinner');
    const types = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(types).toContain('water_turn_not_ready');
  });

  it('rejects a second response', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });
    await service.respond(FARMER_ID, alert.id, { response: WATER_TURN_RESPONSE.READY });

    await expect(
      service.respond(FARMER_ID, alert.id, { response: WATER_TURN_RESPONSE.NOT_READY }),
    ).rejects.toThrow('Alert is already ready');
  });

  it('rejects a response after the window has expired', async () => {
    alertModel.create({
      _id: '64b000000000000000000301',
      tubewellId: TW_ID,
      waterQueueEntryId: ENTRY_ID,
      waterRequestId: REQ_ID,
      targetCustomerId: FARMER_ID,
      fieldId: FIELD_ID,
      status: WATER_TURN_STATUS.SENT,
      sentAt: new Date(Date.now() - 6 * 60000),
      responseDeadlineAt: new Date(Date.now() - 60000),
      attemptNumber: 1,
      maxAttempts: 3,
    });

    await expect(
      service.respond(FARMER_ID, '64b000000000000000000301', { response: WATER_TURN_RESPONSE.READY }),
    ).rejects.toThrow('response window has expired');
  });

  it('forbids a non-target farmer from responding', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    await expect(
      service.respond(OTHER_FARMER_ID, alert.id, { response: WATER_TURN_RESPONSE.READY }),
    ).rejects.toThrow('You do not have access to this alert');
  });

  it('Alert Again resets a NOT_READY alert to a new SENT attempt', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });
    await service.respond(FARMER_ID, alert.id, { response: WATER_TURN_RESPONSE.NOT_READY });
    notificationsService.create.mockClear();

    const retried = await service.manualRetry(OWNER_ID, alert.id);

    expect(retried.status).toBe(WATER_TURN_STATUS.SENT);
    expect(retried.attemptNumber).toBe(1);
    const types = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(types).toContain('water_turn_alert_retry');
  });

  it('rejects Alert Again from a SENT alert', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    await expect(service.manualRetry(OWNER_ID, alert.id)).rejects.toThrow(
      'Cannot retry an alert in "sent" state',
    );
  });

  it('owner can cancel a live alert', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    const cancelled = await service.cancelAlert(OWNER_ID, alert.id, 'farmer called');

    expect(cancelled.status).toBe(WATER_TURN_STATUS.CANCELLED);
    expect(cancelled.cancelledReason).toBe('farmer called');
    expect(alertModel.items[0].activeFlag).toBeUndefined();
  });

  it('cannot cancel an already-cancelled alert', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });
    await service.cancelAlert(OWNER_ID, alert.id);

    await expect(service.cancelAlert(OWNER_ID, alert.id)).rejects.toThrow('already cancelled');
  });

  it('farmer acknowledges the alert by opening it (SENT -> ACKNOWLEDGED)', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    const viewed = await service.getAlert(FARMER_ID, alert.id, 'farmer');

    expect(viewed.status).toBe(WATER_TURN_STATUS.ACKNOWLEDGED);
    expect(viewed.remainingSeconds).toBeGreaterThan(0);
  });

  it('farmer cannot open another farmer alert', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    await expect(service.getAlert(OTHER_FARMER_ID, alert.id, 'farmer')).rejects.toThrow(
      'You do not have access to this alert',
    );
  });

  it('owner must own the tubewell to view an alert (non-owner rejected)', async () => {
    seedQueue();
    const alert = await service.createAlert(OWNER_ID, { tubewellId: TW_ID });
    tubewellsService.ownerMustOwn = jest.fn().mockRejectedValue(new Error('Not authorized'));

    await expect(service.getAlert('someone-else', alert.id, 'tubewell_owner')).rejects.toThrow(
      'Not authorized',
    );
  });

  it('scheduler re-sends while attempts remain (attempt 2, new deadline)', async () => {
    alertModel.create({
      _id: '64b000000000000000000302',
      tubewellId: TW_ID,
      waterQueueEntryId: ENTRY_ID,
      waterRequestId: REQ_ID,
      targetCustomerId: FARMER_ID,
      fieldId: FIELD_ID,
      status: WATER_TURN_STATUS.SENT,
      sentAt: new Date(Date.now() - 6 * 60000),
      responseDeadlineAt: new Date(Date.now() - 1000),
      attemptNumber: 1,
      maxAttempts: 3,
    });
    notificationsService.create.mockClear();

    await service.processExpired();

    const doc = alertModel.items[0];
    expect(doc.status).toBe(WATER_TURN_STATUS.SENT);
    expect(doc.attemptNumber).toBe(2);
    expect(doc.responseDeadlineAt.getTime()).toBeGreaterThan(Date.now());
    const types = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(types).toContain('water_turn_alert_retry');
  });

  it('scheduler marks NO_RESPONSE and notifies the owner when attempts are exhausted', async () => {
    alertModel.create({
      _id: '64b000000000000000000303',
      tubewellId: TW_ID,
      waterQueueEntryId: ENTRY_ID,
      waterRequestId: REQ_ID,
      targetCustomerId: FARMER_ID,
      fieldId: FIELD_ID,
      status: WATER_TURN_STATUS.SENT,
      sentAt: new Date(Date.now() - 6 * 60000),
      responseDeadlineAt: new Date(Date.now() - 1000),
      attemptNumber: 3,
      maxAttempts: 3,
    });
    notificationsService.create.mockClear();

    await service.processExpired();

    const doc = alertModel.items[0];
    expect(doc.status).toBe(WATER_TURN_STATUS.NO_RESPONSE);
    expect(doc.noResponseAt).toBeDefined();
    const types = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(types).toContain('water_turn_no_response');
  });

  it('scheduler leaves an already-answered alert untouched', async () => {
    alertModel.create({
      _id: '64b000000000000000000304',
      tubewellId: TW_ID,
      waterQueueEntryId: ENTRY_ID,
      waterRequestId: REQ_ID,
      targetCustomerId: FARMER_ID,
      fieldId: FIELD_ID,
      status: WATER_TURN_STATUS.SENT,
      sentAt: new Date(Date.now() - 6 * 60000),
      responseDeadlineAt: new Date(Date.now() - 1000),
      attemptNumber: 1,
      maxAttempts: 3,
      respondedAt: new Date(),
      response: WATER_TURN_RESPONSE.READY,
    });
    notificationsService.create.mockClear();

    await service.processExpired();

    const doc = alertModel.items[0];
    expect(doc.status).toBe(WATER_TURN_STATUS.SENT);
    expect(doc.attemptNumber).toBe(1);
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('scheduler sends water_turn_delayed once when the session overruns the estimate', async () => {
    alertModel.create({
      _id: '64b000000000000000000305',
      tubewellId: TW_ID,
      waterQueueEntryId: ENTRY_ID,
      waterRequestId: REQ_ID,
      targetCustomerId: FARMER_ID,
      fieldId: FIELD_ID,
      status: WATER_TURN_STATUS.SENT,
      sentAt: new Date(Date.now() - 1000),
      responseDeadlineAt: new Date(Date.now() + 10 * 60000),
      attemptNumber: 1,
      maxAttempts: 3,
      estimatedRemainingMinutes: 5,
    });
    sessionModel.create({
      tubewellId: TW_ID,
      status: SESSION_STATUS.RUNNING,
      startDatetime: new Date(Date.now() - 20 * 60000),
    });
    notificationsService.create.mockClear();

    await service.processExpired();
    const typesAfterFirst = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(typesAfterFirst).toContain('water_turn_delayed');

    notificationsService.create.mockClear();
    await service.processExpired();
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('getNextForTubewell returns the next WAITING entry together with its active alert', async () => {
    seedQueue();
    await service.createAlert(OWNER_ID, { tubewellId: TW_ID });

    const result = await service.getNextForTubewell(OWNER_ID, TW_ID, 'tubewell_owner');

    expect(result.next).toEqual(expect.objectContaining({
      id: ENTRY_ID,
      customerName: 'Ramesh',
      queuePosition: 1,
    }));
    expect(result.alert).toEqual(expect.objectContaining({ status: WATER_TURN_STATUS.SENT }));
  });

  it('getNextForTubewell enforces farmer membership for non-owners', async () => {
    seedQueue();
    tubewellsService.verifyApprovedMembership = jest.fn().mockRejectedValue(new Error('Not a member'));

    await expect(service.getNextForTubewell(FARMER_ID, TW_ID, 'farmer')).rejects.toThrow(
      'Not a member',
    );
  });
});