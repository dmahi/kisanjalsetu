import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { CropsService } from './crops/crops.service';
import { FieldsService } from './fields/fields.service';
import { TubewellsService } from './tubewells/tubewells.service';
import { SessionsService } from './sessions/sessions.service';
import { PaymentsService } from './payments/payments.service';
import { MoneyService } from './common/money.service';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const conn = app.get(getConnectionToken()) as any;
  const users = app.get(UsersService);
  const crops = app.get(CropsService);
  const fields = app.get(FieldsService);
  const tubewells = app.get(TubewellsService);
  const sessions = app.get(SessionsService);
  const payments = app.get(PaymentsService);
  const money = app.get(MoneyService);

  const TubewellModel = conn.models['Tubewell'];
  const CropModel = conn.models['Crop'];
  const SessionModel = conn.models['WaterSession'];

  const ADMIN = '+919999999999';
  if (!(await users.findByPhone(ADMIN))) {
    await users.create({ name: 'Platform Admin', phone: ADMIN, role: 'admin' });
    console.log('Created admin user:', ADMIN);
  }

  const owner1 = await ensureUser(users, '+919811111111', 'tubewell_owner', 'Rajesh Tubewell');
  const owner2 = await ensureUser(users, '+919822222222', 'tubewell_owner', 'Suresh Tubewell');
  const farmerA = await ensureUser(users, '+919833333333', 'farmer', 'Farmer A');
  const farmerB = await ensureUser(users, '+919844444444', 'farmer', 'Farmer B');
  const farmerC = await ensureUser(users, '+919855555555', 'farmer', 'Farmer C');

  let tw1 = await TubewellModel.findOne({ code: 'TW1' }).exec();
  if (!tw1) {
    tw1 = await tubewells.create(String(owner1._id), {
      name: 'Tubewell 1', code: 'TW1', address: 'Village Rajpur', village: 'Rajpur',
      latitude: 26.5, longitude: 77.0,
      settings: { ratePerHourPaise: money.rupeesToPaise(100) },
    });
    console.log('Created Tubewell 1 (₹100/hr)');
  }

  let tw2 = await TubewellModel.findOne({ code: 'TW2' }).exec();
  if (!tw2) {
    tw2 = await tubewells.create(String(owner1._id), {
      name: 'Tubewell 2', code: 'TW2', address: 'Village Shyampur', village: 'Shyampur',
      latitude: 26.55, longitude: 77.1,
      settings: { ratePerHourPaise: money.rupeesToPaise(120) },
    });
    console.log('Created Tubewell 2 (₹120/hr)');
  }

  let tw3 = await TubewellModel.findOne({ code: 'TW3' }).exec();
  if (!tw3) {
    tw3 = await tubewells.create(String(owner2._id), {
      name: 'Tubewell 3', code: 'TW3', address: 'Village Mohanpur', village: 'Mohanpur',
      latitude: 26.6, longitude: 77.2,
      settings: { ratePerHourPaise: money.rupeesToPaise(80) },
    });
    console.log('Created Tubewell 3 (₹80/hr)');
  }

  await approveMembership(tubewells, String(tw1._id), String(farmerA._id), String(owner1._id));
  await approveMembership(tubewells, String(tw1._id), String(farmerB._id), String(owner1._id));
  await approveMembership(tubewells, String(tw2._id), String(farmerA._id), String(owner1._id));
  await approveMembership(tubewells, String(tw3._id), String(farmerC._id), String(owner2._id));

  const fieldsA = await fields.listForCustomer(String(farmerA._id));
  if (fieldsA.length === 0) {
    await fields.create(String(farmerA._id), { name: 'Field A', area: 2, areaUnit: 'acre', location: 'North block' });
    await fields.create(String(farmerA._id), { name: 'Field B', area: 4, areaUnit: 'acre', location: 'South block' });
    await fields.create(String(farmerB._id), { name: 'Field 1', area: 3, areaUnit: 'acre' });
  }

  const wheat = (await CropModel.findOne({ name: 'Wheat' }).exec()) || (await crops.ensure('Wheat'));
  const paddy = (await CropModel.findOne({ name: 'Paddy' }).exec()) || (await crops.ensure('Paddy'));
  const fa = await fields.listForCustomer(String(farmerA._id));

  const sessionCount = await SessionModel.countDocuments({ tubewellId: tw1._id }).exec();
  if (sessionCount === 0) {
    // Farmer A: 10:00-13:00 (₹300) and 16:00-18:00 (₹200) => workable example
    await sessions.createManual(String(owner1._id), {
      tubewellId: String(tw1._id), customerId: String(farmerA._id),
      fieldId: fa[0] ? String(fa[0]._id) : undefined, cropId: String(wheat._id), cropName: 'Wheat',
      startDatetime: at(10, 0), endDatetime: at(13, 0),
    });
    await sessions.createManual(String(owner1._id), {
      tubewellId: String(tw1._id), customerId: String(farmerA._id),
      fieldId: fa[1] ? String(fa[1]._id) : undefined, cropId: String(paddy._id), cropName: 'Paddy',
      startDatetime: at(16, 0), endDatetime: at(18, 0),
    });
    await sessions.createManual(String(owner1._id), {
      tubewellId: String(tw1._id), customerId: String(farmerB._id), cropName: 'Mustard',
      startDatetime: at(14, 0), endDatetime: at(14, 30),
    });
    // Farmer A takes a third session with a 10% discount
    await sessions.createManual(String(owner1._id), {
      tubewellId: String(tw1._id), customerId: String(farmerA._id),
      fieldId: fa[1] ? String(fa[1]._id) : undefined, cropId: String(paddy._id), cropName: 'Paddy',
      startDatetime: at(19, 0), endDatetime: at(19, 30),
      discountType: 'percentage', discountValue: 10, discountReason: 'Festival promotion',
    });
    console.log('Created water sessions for Farmer A @ Tubewell 1');
  }

  const paid = await payments.totalsForCustomerTubewell(String(farmerA._id), String(tw1._id));
  if (paid.totalPaidPaise === 0) {
    const req1 = await payments.createPaymentRequest(String(farmerA._id), {
      tubewellId: String(tw1._id), amountPaise: money.rupeesToPaise(300), notes: 'Morning payment',
    });
    await payments.approvePaymentRequest(String(owner1._id), String(req1._id));
    console.log('Farmer A paid ₹300 (approved)');
  }

  console.log('\n--- Seed complete ---');
  console.log('Admin  OTP login :', ADMIN, '(use dev OTP 123456)');
  console.log('Owner1 (TW1+TW2) : +919811111111');
  console.log('Owner2 (TW3)     : +919822222222');
  console.log('Farmer A (multi) : +919833333333');
  console.log('Farmer B         : +919844444444');
  console.log('Farmer C         : +919855555555');

  await app.close();
}

async function ensureUser(users: UsersService, phone: string, role: any, name: string) {
  const existing = await users.findByPhone(phone);
  if (existing) return existing;
  const created = await users.create({ name, phone, role });
  console.log('Created user:', name, phone, role);
  return created;
}

async function approveMembership(tubewells: TubewellsService, tubewellId: string, customerId: string, approvedBy: string) {
  const existing = await tubewells.listMembershipsForCustomer(customerId);
  const approved = existing.find((m: any) => String(m.tubewellId) === tubewellId && m.status === 'approved');
  if (approved) return;
  try {
    await tubewells.requestMembership(tubewellId, customerId);
  } catch {
    /* ignore */
  }
  const memberships = await tubewells.listMembershipsForCustomer(customerId);
  const pending = memberships.find((m: any) => String(m.tubewellId) === tubewellId && m.status === 'pending');
  if (pending) {
    await tubewells.membershipAction(tubewellId, customerId, 'approve', approvedBy);
  }
}

function at(h: number, m = 0): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export {};
void seed();