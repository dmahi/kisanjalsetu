import { SelectOptionsService } from './select-options.service';
import { SELECT_OPTION_CATEGORIES } from './select-options.constants';

function makeOptionModel() {
  const items: any[] = [];
  let autoId = 0;

  function createItem(doc: any) {
    const item: any = {
      _id: doc._id || `64b000000000000000000${String(++autoId).padStart(3, '0')}`,
      category: doc.category,
      code: doc.code,
      labels: doc.labels,
      sortOrder: doc.sortOrder ?? 0,
      active: doc.active ?? true,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      save: jest.fn().mockImplementation(function (this: any) {
        item.updatedAt = new Date();
        return Promise.resolve(item);
      }),
    };
    items.push(item);
    return item;
  }

  const model: any = {
    findOne: (query: any) => ({
      exec: async () => items.find((i) => i.category === query.category && i.code === query.code) || null,
    }),
    find: (query: any = {}) => ({
      sort: () => ({
        exec: async () => items.filter((i) => {
          if (query.category && typeof query.category === 'string' && i.category !== query.category) return false;
          if (query.category && query.category.$in && !query.category.$in.includes(i.category)) return false;
          if (query.active !== undefined && i.active !== query.active) return false;
          return true;
        }).slice().sort((a, b) => a.sortOrder - b.sortOrder),
      }),
      exec: async () => items.slice(),
    }),
    findByIdAndDelete: (id: string) => ({
      exec: async () => {
        const idx = items.findIndex((i) => String(i._id) === String(id));
        if (idx === -1) return null;
        return items.splice(idx, 1)[0];
      },
    }),
    findById: (id: string) => ({
      exec: async () => items.find((i) => String(i._id) === String(id)) || null,
    }),
    create: (doc: any) => Promise.resolve(createItem(doc)),
  };

  return { model, items };
}

describe('SelectOptionsService', () => {
  it('seeds defaults for every category', async () => {
    const { model } = makeOptionModel();
    const service = new SelectOptionsService(model as any);
    await service.onModuleInit();
    for (const cat of SELECT_OPTION_CATEGORIES) {
      const group = await service.listByCategories([cat]);
      expect(group[cat].length).toBeGreaterThan(0);
    }
  });

  it('seeds only missing options (idempotent)', async () => {
    const { model, items } = makeOptionModel();
    const service = new SelectOptionsService(model as any);
    await service.onModuleInit();
    const countAfterFirst = items.length;
    await service.onModuleInit();
    expect(items.length).toBe(countAfterFirst);
  });

  it('groups options by category and returns only active ones', async () => {
    const { model } = makeOptionModel();
    const service = new SelectOptionsService(model as any);
    await service.onModuleInit();
    // Deactivate one option
    const group = await service.listByCategories(['tubewell_type']);
    const first = group['tubewell_type'][0];
    await service.adminUpdate(String(first._id), { active: false });
    const after = await service.listByCategories(['tubewell_type']);
    expect(after['tubewell_type'].some((o) => String(o._id) === String(first._id))).toBe(false);
  });

  it('creates new options and updates labels on duplicate code', async () => {
    const { model } = makeOptionModel();
    const service = new SelectOptionsService(model as any);
    const created = await service.adminCreate({
      category: 'payment_method',
      code: 'qr_code',
      labels: { en: 'QR Code', hi: 'क्यूआर कोड' },
    });
    expect(created.code).toBe('qr_code');
    const updated = await service.adminCreate({
      category: 'payment_method',
      code: 'qr_code',
      labels: { pa: 'ਕਿਊਆਰ ਕੋਡ' },
    });
    expect(updated.labels.en).toBe('QR Code');
    expect(updated.labels.pa).toBe('ਕਿਊਆਰ ਕੋਡ');
  });

  it('throws on unknown id patterns for update/remove', async () => {
    const { model } = makeOptionModel();
    const service = new SelectOptionsService(model as any);
    await expect(service.adminUpdate('bad-id', {})).rejects.toThrow('not found');
    await expect(service.adminRemove('bad-id')).rejects.toThrow('not found');
  });
});