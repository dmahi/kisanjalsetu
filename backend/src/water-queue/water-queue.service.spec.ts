import { WaterQueueService } from './water-queue.service';
import { QUEUE_STATUS } from './schemas/water-queue.schema';

const TW_ID = '64b000000000000000000001';
const REQ_ID = '64b000000000000000000002';
const CUST_ID = '64b000000000000000000003';
const FIELD_ID = '64b000000000000000000004';
const OWNER_ID = '64b000000000000000000005';

function matchesFilter(item: any, query: any): boolean {
  if (query.tubewellId && String(item.tubewellId) !== String(query.tubewellId)) return false;
  if (query.status && typeof query.status === 'string' && item.status !== query.status) return false;
  if (query.status && typeof query.status === 'object' && query.status.$in && !query.status.$in.includes(item.status)) return false;
  if (query.status && typeof query.status === 'object' && query.status.$ne && query.status.$ne === item.status) return false;
  if (query.queuePosition !== undefined && item.queuePosition !== query.queuePosition) return false;
  if (query._id && String(item._id) !== String(query._id)) return false;
  return true;
}

function makeQueueModel() {
  const items: any[] = [];
  let autoId = 100;
  function createItem(doc: any) {
    const id = doc._id || `64b0000000000000000000${(autoId++).toString(16).padStart(2, '0')}`;
    const item: any = {
      _id: id,
      tubewellId: doc.tubewellId || TW_ID,
      waterRequestId: doc.waterRequestId || REQ_ID,
      customerId: doc.customerId || CUST_ID,
      fieldId: doc.fieldId || FIELD_ID,
      cropId: doc.cropId,
      cropName: doc.cropName,
      queuePosition: doc.queuePosition ?? 0,
      status: doc.status || QUEUE_STATUS.WAITING,
      queuedAt: doc.queuedAt || new Date(),
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
      removedAt: doc.removedAt,
      waterSessionId: doc.waterSessionId,
      save: jest.fn().mockImplementation(function (this: any) { return Promise.resolve(this); }),
    };
    items.push(item);
    return item;
  }
  return {
    items,
    create: jest.fn().mockImplementation((doc: any) => Promise.resolve(createItem(doc))),
    find: jest.fn().mockImplementation((query: any) => {
      return {
        sort: jest.fn().mockImplementation((sortObj: any) => {
          const filtered = items.filter((i) => matchesFilter(i, query));
          const key = Object.keys(sortObj)[0];
          const dir = sortObj[key] === -1 ? -1 : 1;
          filtered.sort((a: any, b: any) => (a[key] > b[key] ? dir : -dir));
          return {
            limit: jest.fn().mockReturnThis(),
            session: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(filtered),
          };
        }),
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(items.filter((i) => matchesFilter(i, query))),
      };
    }),
    findOne: jest.fn().mockImplementation((query: any) => {
      const item = items.find((i) => matchesFilter(i, query));
      return {
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(item || null),
      };
    }),
    findById: jest.fn().mockImplementation((id: string) => {
      const item = items.find((i) => String(i._id) === String(id));
      return {
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(item || null),
      };
    }),
    updateMany: jest.fn().mockImplementation((query: any, update: any) => {
      const matching = items.filter((i) => matchesFilter(i, query));
      if (update.$inc) {
        for (const item of matching) {
          for (const [key, val] of Object.entries(update.$inc)) {
            item[key] = (item[key] || 0) + (val as number);
          }
        }
      }
      return { exec: jest.fn().mockResolvedValue({ modifiedCount: matching.length }) };
    }),
    countDocuments: jest.fn().mockImplementation((query: any) => ({
      session: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(items.filter((i) => matchesFilter(i, query)).length),
    })),
  };
}

function makeConnection() {
  return {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn().mockImplementation((cb: () => Promise<void>) => cb()),
      endSession: jest.fn().mockResolvedValue(true),
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

function makeNotificationsService() {
  return {
    create: jest.fn().mockResolvedValue({ _id: 'notif-1' }),
  };
}

function makeFieldsService() {
  return {
    findByIdForCustomer: jest.fn().mockResolvedValue({ _id: FIELD_ID, name: 'North Field' }),
  };
}

function makeUsersService() {
  return {
    findById: jest.fn().mockResolvedValue({ _id: CUST_ID, name: 'Ramesh', phone: '9876543210' }),
  };
}

describe('WaterQueueService', () => {
  let service: WaterQueueService;
  let queueModel: ReturnType<typeof makeQueueModel>;
  let notificationsService: ReturnType<typeof makeNotificationsService>;

  beforeEach(() => {
    queueModel = makeQueueModel();
    notificationsService = makeNotificationsService();
    service = new WaterQueueService(
      queueModel as any,
      makeConnection() as any,
      makeTubewellsService() as any,
      notificationsService as any,
      makeFieldsService() as any,
      makeUsersService() as any,
    );
  });

  it('adds accepted request to end of queue and notifies farmer with queue position', async () => {
    const entry = await service.addToQueue({
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
    });

    expect(entry.queuePosition).toBe(1);
    expect(entry.status).toBe(QUEUE_STATUS.WAITING);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Water Request Accepted',
        body: expect.stringContaining('#1 in the queue'),
      }),
    );
  });

  it('appends new accepted requests at the end of an existing queue', async () => {
    await queueModel.create({
      _id: '64b000000000000000000101',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });
    await queueModel.create({
      _id: '64b000000000000000000102',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 2,
      status: QUEUE_STATUS.WAITING,
    });

    const entry = await service.addToQueue({
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
    });

    expect(entry.queuePosition).toBe(3);
  });

  it('sends a "you are next" notification when the accepted farmer is #1', async () => {
    await service.addToQueue({
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
    });

    const calls = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(calls).toContain('queue_next');
    expect(calls).toContain('water_request_accepted');
  });

  it('does NOT send "you are next" when the accepted farmer queues behind others', async () => {
    await queueModel.create({
      _id: '64b000000000000000000103',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });

    notificationsService.create.mockClear();
    await service.addToQueue({
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
    });

    const calls = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(calls).toContain('water_request_accepted');
    expect(calls).not.toContain('queue_next');
  });

  it('moveUp swaps an entry with the one before it', async () => {
    const first = await queueModel.create({
      _id: '64b000000000000000000120',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000ab',
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });
    const second = await queueModel.create({
      _id: '64b000000000000000000121',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000ac',
      fieldId: FIELD_ID,
      queuePosition: 2,
      status: QUEUE_STATUS.WAITING,
    });

    await service.moveUp(OWNER_ID, second._id);

    expect(second.queuePosition).toBe(1);
    expect(first.queuePosition).toBe(2);
  });

  it('moveUp does nothing when entry is already at the head', async () => {
    const first = await queueModel.create({
      _id: '64b000000000000000000122',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });

    await expect(service.moveUp(OWNER_ID, first._id)).resolves.toBeUndefined();
    expect(first.queuePosition).toBe(1);
  });

  it('moveDown swaps an entry with the one after it', async () => {
    const first = await queueModel.create({
      _id: '64b000000000000000000123',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000ad',
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });
    const second = await queueModel.create({
      _id: '64b000000000000000000124',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 2,
      status: QUEUE_STATUS.WAITING,
    });

    await service.moveDown(OWNER_ID, first._id);

    expect(first.queuePosition).toBe(2);
    expect(second.queuePosition).toBe(1);
  });

  it('moveToStart brings an entry to position 1', async () => {
    const first = await queueModel.create({
      _id: '64b000000000000000000125',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000ae',
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });
    const second = await queueModel.create({
      _id: '64b000000000000000000126',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000af',
      fieldId: FIELD_ID,
      queuePosition: 2,
      status: QUEUE_STATUS.WAITING,
    });
    const third = await queueModel.create({
      _id: '64b000000000000000000127',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 3,
      status: QUEUE_STATUS.WAITING,
    });

    await service.moveToStart(OWNER_ID, third._id);

    expect(third.queuePosition).toBe(1);
    expect(first.queuePosition).toBe(2);
    expect(second.queuePosition).toBe(3);
  });

  it('moveToEnd places an entry at the tail', async () => {
    const first = await queueModel.create({
      _id: '64b000000000000000000128',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });
    const second = await queueModel.create({
      _id: '64b000000000000000000129',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000b0',
      fieldId: FIELD_ID,
      queuePosition: 2,
      status: QUEUE_STATUS.WAITING,
    });

    await service.moveToEnd(OWNER_ID, first._id);

    expect(first.queuePosition).toBe(2);
    expect(second.queuePosition).toBe(1);
  });

  it('rejects reorder of a non-waiting (active) entry', async () => {
    const active = await queueModel.create({
      _id: '64b000000000000000000130',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.ACTIVE,
    });

    await expect(service.moveToStart(OWNER_ID, active._id)).rejects.toThrow('Only waiting queue entries can be reordered');
    await expect(service.moveUp(OWNER_ID, active._id)).rejects.toThrow('Only waiting queue entries can be reordered');
    await expect(service.moveDown(OWNER_ID, active._id)).rejects.toThrow('Only waiting queue entries can be reordered');
  });

  it('rejects removal of a completed entry', async () => {
    const done = await queueModel.create({
      _id: '64b000000000000000000131',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.COMPLETED,
    });

    await expect(service.remove(OWNER_ID, done._id)).rejects.toThrow('Only waiting queue entries can be removed');
  });

  it('remove marks the entry as removed and notifies the farmer', async () => {
    const waiting = await queueModel.create({
      _id: '64b000000000000000000132',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });

    await service.remove(OWNER_ID, waiting._id);

    expect(waiting.status).toBe(QUEUE_STATUS.REMOVED);
    expect(waiting.removedAt).toBeDefined();
    const calls = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(calls).toContain('queue_removed');
  });

  it('notifies farmers of position changes after a reorder', async () => {
    const a = await queueModel.create({
      _id: '64b000000000000000000133',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000b1',
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });
    const b = await queueModel.create({
      _id: '64b000000000000000000134',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000b2',
      fieldId: FIELD_ID,
      queuePosition: 2,
      status: QUEUE_STATUS.WAITING,
    });

    notificationsService.create.mockClear();
    await service.moveUp(OWNER_ID, b._id);

    const calls = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(calls).toContain('queue_position_changed');
  });

  it('sends "you are next" when a reorder moves someone to #1', async () => {
    const a = await queueModel.create({
      _id: '64b000000000000000000135',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000b3',
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });
    const b = await queueModel.create({
      _id: '64b000000000000000000136',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: '64b0000000000000000000b4',
      fieldId: FIELD_ID,
      queuePosition: 2,
      status: QUEUE_STATUS.WAITING,
    });

    notificationsService.create.mockClear();
    await service.moveToStart(OWNER_ID, b._id);

    const calls = notificationsService.create.mock.calls.map((c: any[]) => c[0].type);
    expect(calls).toContain('queue_next');
    expect(calls).toContain('queue_position_changed');
  });

  it('a non-owner cannot reorder another tubewell entry', async () => {
    const waiting = await queueModel.create({
      _id: '64b000000000000000000137',
      tubewellId: TW_ID,
      waterRequestId: REQ_ID,
      customerId: CUST_ID,
      fieldId: FIELD_ID,
      queuePosition: 1,
      status: QUEUE_STATUS.WAITING,
    });

    const notOwner = '64b0000000000000000000ff';
    const tubewellsService = makeTubewellsService();
    tubewellsService.ownerMustOwn = jest.fn().mockRejectedValue(new Error('Not authorized'));
    const service2 = new WaterQueueService(
      queueModel as any,
      makeConnection() as any,
      tubewellsService as any,
      notificationsService as any,
      makeFieldsService() as any,
      makeUsersService() as any,
    );

    await expect(service2.moveUp(notOwner, waiting._id)).rejects.toThrow('Not authorized');
  });

  it('entry not found throws NotFoundException', async () => {
    await expect(service.moveUp(OWNER_ID, '000000000000000000000000')).rejects.toThrow('Queue entry not found');
    await expect(service.remove(OWNER_ID, '000000000000000000000000')).rejects.toThrow('Queue entry not found');
  });
});
