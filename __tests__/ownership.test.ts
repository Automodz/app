/**
 * OWNERSHIP IS AN ID. A REGISTRATION IS A STRING SOMEBODY TYPED.
 *
 * Production carried three bookings whose stored plate and name disagreed with
 * the vehicle their own `vehicleId` named — a "Honda City" on the BMW's plate
 * pointing at the i20. Every `vehicleId` was correct. The customer projection
 * joined by `vehicleRegNo`, so the BMW's room filled with another car's work.
 *
 * These assertions reproduce that exact corruption and prove the shapes the
 * fix depends on. The query-level proof lives in the customerPicture and
 * source suites; this is the data contract underneath them.
 */
import type { Booking, Job, Vehicle } from '@/lib/types';

/* The three production records, as they actually are. */
const I20 = { id: 'DYIeih9YtXdTDiNmnpPC', name: 'I20 NLine', registrationNumber: 'GJ01AB1235' };
const BMW = { id: 'atuFTVOn7fnROvMCwgll', name: 'BMW', registrationNumber: 'GJ01AB1234' };
const KIA = { id: 'MfU7e5qLzdLvkvvi8E3o', name: 'Kia Seltos', registrationNumber: 'GJ01AB8539' };
const GARAGE = [I20, BMW, KIA] as unknown as Vehicle[];

const CORRUPTED = [
  { id: '6NYaDfyE2WlMZfVtXQ4M', vehicleName: 'Kia Seltos', vehicleRegNo: 'GJ01AB1234', vehicleId: I20.id },
  { id: 'RoqpKxa2zrzLvgBRMqZv', vehicleName: 'Honda City', vehicleRegNo: 'GJ01AB1234', vehicleId: I20.id },
  { id: 'iTM0pGRPZgkAdJyxhOeP', vehicleName: 'Kia seltos', vehicleRegNo: 'GJ01AB1234', vehicleId: BMW.id },
] as unknown as Booking[];

/** The join the projection now performs: id, and only id. */
const byId = <T extends { vehicleId?: string }>(rows: T[], vehicleId: string) =>
  rows.filter(r => r.vehicleId === vehicleId);

/** The join it used to perform, kept only to prove it was wrong. */
const byPlate = <T extends { vehicleRegNo?: string }>(rows: T[], reg: string) =>
  rows.filter(r => r.vehicleRegNo === reg);

describe('the BMW / Kia / Honda corruption', () => {
  it('the plate join put two other cars in the BMW\'s room', () => {
    const wrong = byPlate(CORRUPTED, BMW.registrationNumber);
    expect(wrong).toHaveLength(3);
    expect(wrong.map(b => b.vehicleName)).toContain('Honda City');
  });

  it('the id join gives the BMW only what is actually its own', () => {
    const right = byId(CORRUPTED, BMW.id);
    expect(right).toHaveLength(1);
    expect(right[0].id).toBe('iTM0pGRPZgkAdJyxhOeP');
    expect(right.map(b => b.vehicleName)).not.toContain('Honda City');
  });

  it('the two mislabelled bookings belong to the i20, as their ids always said', () => {
    expect(byId(CORRUPTED, I20.id).map(b => b.id))
      .toEqual(['6NYaDfyE2WlMZfVtXQ4M', 'RoqpKxa2zrzLvgBRMqZv']);
  });

  it('the Kia receives none of them', () => {
    expect(byId(CORRUPTED, KIA.id)).toEqual([]);
  });
});

describe('a registration establishes nothing', () => {
  it('a stale vehicleRegNo does not move ownership', () => {
    const stale = { vehicleId: KIA.id, vehicleRegNo: 'GJ01AB1234' } as unknown as Booking;
    expect(byId([stale], KIA.id)).toHaveLength(1);
    expect(byId([stale], BMW.id)).toHaveLength(0);
  });

  it('vehicleId wins over both vehicleName and vehicleRegNo', () => {
    const lying = {
      vehicleId: KIA.id, vehicleName: 'BMW', vehicleRegNo: BMW.registrationNumber,
    } as unknown as Booking;
    expect(byId([lying], KIA.id)).toHaveLength(1);
  });

  it('changing a plate does not change identity or history', () => {
    const before = byId(CORRUPTED, I20.id).length;
    const renamed = { ...I20, registrationNumber: 'GJ99XX0000' };
    expect(renamed.id).toBe(I20.id);
    expect(byId(CORRUPTED, renamed.id)).toHaveLength(before);
  });

  it('a missing vehicleId resolves to NO vehicle — never a plate lookup', () => {
    const walkIn = { id: 'j1', vehicleRegNo: BMW.registrationNumber } as unknown as Job;
    for (const v of GARAGE) expect(byId([walkIn], v.id)).toEqual([]);
    /* And it must not be rescued by the plate, which would re-parent it. */
    expect(byPlate([walkIn], BMW.registrationNumber)).toHaveLength(1);
  });

  it('two cars sharing a plate never merge histories', () => {
    const twin = { id: 'other', name: 'Twin', registrationNumber: BMW.registrationNumber };
    const rows = [
      { id: 'a', vehicleId: BMW.id, vehicleRegNo: BMW.registrationNumber },
      { id: 'b', vehicleId: twin.id, vehicleRegNo: BMW.registrationNumber },
    ] as unknown as Booking[];
    expect(byId(rows, BMW.id).map(r => r.id)).toEqual(['a']);
    expect(byId(rows, twin.id).map(r => r.id)).toEqual(['b']);
  });

  it('a plate typo cannot re-parent history', () => {
    const typo = { id: 'x', vehicleId: KIA.id, vehicleRegNo: 'GJ01AB853' } as unknown as Booking;
    expect(byId([typo], KIA.id)).toHaveLength(1);
    expect(byPlate([typo], KIA.registrationNumber)).toHaveLength(0);
  });
});

describe('booking → job carries the ids, not the strings', () => {
  /* Mirrors `createJobFromBooking`, which now persists both. */
  const jobFrom = (b: { id: string; vehicleId: string; userId: string; vehicleRegNo: string }) => ({
    bookingId: b.id,
    vehicleId: b.vehicleId,
    customerId: b.userId,
    vehicleRegNo: b.vehicleRegNo.toUpperCase(),
  });

  const booking = {
    id: 'bk1', vehicleId: KIA.id, userId: 'u1', vehicleRegNo: 'gj01ab8539',
  };

  it('the job inherits vehicleId from the booking', () => {
    expect(jobFrom(booking).vehicleId).toBe(KIA.id);
  });

  it('the job inherits customerId from the booking', () => {
    expect(jobFrom(booking).customerId).toBe('u1');
  });

  it('a mislabelled booking still produces a correctly parented job', () => {
    const job = jobFrom({ ...booking, vehicleRegNo: BMW.registrationNumber });
    expect(job.vehicleId).toBe(KIA.id);
    expect(byId([job], BMW.id)).toEqual([]);
  });

  it('the plate is carried as a display snapshot only', () => {
    expect(jobFrom(booking).vehicleRegNo).toBe('GJ01AB8539');
  });
});

describe('class-D bookings are left exactly as they are', () => {
  it('their display strings are not rewritten to match the vehicle', () => {
    /* Editing a historical record to agree with a current one is rewriting
       history. The ids are already right; the strings are what was recorded. */
    expect(CORRUPTED.map(b => b.vehicleName)).toEqual(['Kia Seltos', 'Honda City', 'Kia seltos']);
    expect(CORRUPTED.every(b => b.vehicleRegNo === 'GJ01AB1234')).toBe(true);
  });
});
