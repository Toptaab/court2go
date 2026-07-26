import { ApiError } from '../../common/api-error';
import { AvailabilityService } from './availability.service';

function makeService(courtRow: unknown) {
  const courts = {
    findById: jest.fn().mockResolvedValue(courtRow),
    listBlocksInRange: jest.fn().mockResolvedValue([]),
  };
  const bookings = {
    findActiveSlots: jest.fn().mockResolvedValue([]),
  };
  // Cast: the service only calls the methods stubbed above.
  const service = new AvailabilityService(courts as never, bookings as never);
  return { service, courts, bookings };
}

describe('AvailabilityService', () => {
  it('404s when the court does not exist', async () => {
    const { service } = makeService(null);
    await expect(service.getAvailability('missing-court', { date: '2026-08-03' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('404s when the court is inactive', async () => {
    const { service } = makeService({
      id: '33333333-3333-4333-8333-333333333333',
      isActive: false,
      deletedAt: null,
      schedule: [],
      peakTimeRanges: [],
      gridIntervalMinutes: 60,
      maxSlots: 4,
      basePricePerGridUnit: 100,
    });
    await expect(service.getAvailability('33333333-3333-4333-8333-333333333333', { date: '2026-08-03' })).rejects.toBeInstanceOf(ApiError);
  });

  it('404s when the court is soft-deleted', async () => {
    const { service } = makeService({
      id: '33333333-3333-4333-8333-333333333333',
      isActive: true,
      deletedAt: new Date(),
      schedule: [],
      peakTimeRanges: [],
      gridIntervalMinutes: 60,
      maxSlots: 4,
      basePricePerGridUnit: 100,
    });
    await expect(service.getAvailability('33333333-3333-4333-8333-333333333333', { date: '2026-08-03' })).rejects.toBeInstanceOf(ApiError);
  });

  it('returns closed:true without querying slots/blocks when the schedule day is closed', async () => {
    const { service, courts, bookings } = makeService({
      id: '33333333-3333-4333-8333-333333333333',
      isActive: true,
      deletedAt: null,
      gridIntervalMinutes: 60,
      maxSlots: 4,
      basePricePerGridUnit: 100,
      peakTimeRanges: [],
      schedule: [{ day: 'MON', closed: true, openTime: null, closeTime: null }],
    });
    // 2026-08-03 is a Monday, so this hits the "found a matching schedule row,
    // and it's closed" branch (not the "no matching row" default).
    const result = await service.getAvailability('33333333-3333-4333-8333-333333333333', { date: '2026-08-03' });
    expect(result.closed).toBe(true);
    expect(result.starts).toEqual([]);
    expect(bookings.findActiveSlots).not.toHaveBeenCalled();
    expect(courts.listBlocksInRange).not.toHaveBeenCalled();
  });

  it('defaults to closed when no schedule row matches the resolved weekday', async () => {
    const { service } = makeService({
      id: '33333333-3333-4333-8333-333333333333',
      isActive: true,
      deletedAt: null,
      gridIntervalMinutes: 60,
      maxSlots: 4,
      basePricePerGridUnit: 100,
      peakTimeRanges: [],
      schedule: [], // no days configured at all
    });
    const result = await service.getAvailability('33333333-3333-4333-8333-333333333333', { date: '2026-08-03' });
    expect(result.closed).toBe(true);
    expect(result.starts).toEqual([]);
  });
});
