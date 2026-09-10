import { BadRequestException } from '@nestjs/common';
import { TubewellsService } from './tubewells.service';
import { ROLES, TUBEWELL_STATUS } from '../common/constants';

class MockModel {
  exists = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
  create = jest.fn();
  deleteOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) });
  findOne = jest.fn();
  findById = jest.fn();
  deleteMany = jest.fn().mockResolvedValue({});
}

function makeService(overrides: { user?: any; updatedUser?: any } = {}) {
  const tubewellModel = new MockModel();
  const membershipModel = new MockModel();
  const tubewellDoc = {
    _id: { toString: () => 'tw1' },
    name: 'Raj Tubewell',
    code: 'TW-ABC123',
    type: 'motor_pump',
    images: ['/uploads/a.jpg'],
    description: null,
    address: 'Near bus stand',
    village: 'Gopalpur',
    city: 'Indore',
    state: 'MP',
    country: 'India',
    pincode: '452001',
    latitude: 22.71,
    longitude: 75.85,
    status: TUBEWELL_STATUS.ACTIVE,
    ownerId: { toString: () => '64b000000000000000000001' },
    settings: { ratePerHourPaise: 15000 },
    createdAt: new Date(),
  };
  tubewellModel.create.mockResolvedValue(tubewellDoc);
  const usersService = {
    findById: jest.fn().mockResolvedValue(overrides.user ?? mockFarmer()),
    setRole: jest.fn().mockResolvedValue(null),
    updateProfile: jest.fn().mockResolvedValue(null),
  };
  const svc = new TubewellsService(
    tubewellModel as any,
    membershipModel as any,
    usersService as any,
  );
  return { svc, tubewellModel, membershipModel, usersService, tubewellDoc };
}

function mockFarmer() {
  return {
    _id: { toString: () => '64b000000000000000000001' },
    name: 'Ram',
    phone: '9999000001',
    role: ROLES.FARMER,
    status: 'active',
    profileImage: null,
    createdAt: new Date(),
  };
}

const VALID_DTO = {
  name: 'Raj Tubewell',
  type: 'motor_pump',
  ratePerHourPaise: 15000,
  address: 'Near bus stand, Gopalpur',
  village: 'Gopalpur',
  city: 'Indore',
  state: 'MP',
  country: 'India',
  pincode: '452001',
  latitude: 22.71,
  longitude: 75.85,
  images: ['/uploads/a.jpg'],
  profileImage: '/uploads/me.jpg',
};

describe('TubewellsService.becomeOwner', () => {
  it('creates the tubewell, upgrades the farmer to owner and saves profile image', async () => {
    const { svc, tubewellModel, usersService, tubewellDoc } = makeService();
    const updated = mockFarmer() as { role: string };
    updated.role = ROLES.TUBEWELL_OWNER;
    usersService.findById
      .mockResolvedValueOnce(mockFarmer())
      .mockResolvedValueOnce(updated);

    const result = await svc.becomeOwner('64b000000000000000000001', VALID_DTO);

    expect(tubewellModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Raj Tubewell',
        type: 'motor_pump',
        settings: { ratePerHourPaise: 15000 },
        images: ['/uploads/a.jpg'],
        status: TUBEWELL_STATUS.ACTIVE,
        ownerId: expect.anything(),
        location: { type: 'Point', coordinates: [75.85, 22.71] },
      }),
    );
    expect(usersService.setRole).toHaveBeenCalledWith('64b000000000000000000001', ROLES.TUBEWELL_OWNER);
    expect(usersService.updateProfile).toHaveBeenCalledWith('64b000000000000000000001', {
      profileImage: '/uploads/me.jpg',
    });
    expect(result.tubewell).toBe(tubewellDoc);
    expect(result.user.role).toBe(ROLES.TUBEWELL_OWNER);
  });

  it('generates a unique code and excludes lat/lng from the stored doc payload', async () => {
    const { svc, tubewellModel } = makeService();
    await svc.becomeOwner('64b000000000000000000001', VALID_DTO);
    const call = (tubewellModel.create as jest.Mock).mock.calls[0][0];
    expect(call.code).toMatch(/^TW-[0-9A-F]{6}$/);
    expect(call.latitude).toBeUndefined();
    expect(call.longitude).toBeUndefined();
  });

  it('rejects non-farmers without creating anything', async () => {
    const { svc, tubewellModel, usersService } = makeService({
      user: { ...mockFarmer(), role: ROLES.TUBEWELL_OWNER },
    });
    await expect(svc.becomeOwner('64b000000000000000000001', VALID_DTO)).rejects.toThrow(BadRequestException);
    expect(tubewellModel.create).not.toHaveBeenCalled();
    expect(usersService.setRole).not.toHaveBeenCalled();
  });

  it('rolls back the tubewell if role upgrade fails', async () => {
    const { svc, tubewellModel, usersService } = makeService();
    usersService.setRole.mockRejectedValue(new Error('db down'));
    await expect(svc.becomeOwner('64b000000000000000000001', VALID_DTO)).rejects.toThrow('db down');
    expect(tubewellModel.deleteOne).toHaveBeenCalledWith({
      _id: expect.anything(),
    });
  });
});
