import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

import {
  acceptBid,
  cancelAcceptedBid,
  cancelRequest,
  createBid,
  createRequest,
  getBidsForRequest,
  getRequest,
} from '../data';

const baseRequest = {
  customerPhone: '9876543210',
  eventName: 'Birthday',
  eventDate: '2026-08-15T19:30',
  plates: 120,
  foodType: 'both',
  menuNotes: 'No onion garlic',
  lat: 12.9716,
  lng: 77.5946,
};

beforeEach(() => {
  localStorage.clear();
});

async function createRequestWithThreeBids() {
  const request = await createRequest(baseRequest);

  const b1 = await createBid({
    requestId: request.id,
    vendorId: 'v1',
    vendorName: 'Vendor 1',
    pricePerPlate: 250,
    totalPrice: 250 * request.plates,
    menuDetails: 'Menu 1',
    notes: '',
    distance: 2.1,
  });

  const b2 = await createBid({
    requestId: request.id,
    vendorId: 'v2',
    vendorName: 'Vendor 2',
    pricePerPlate: 240,
    totalPrice: 240 * request.plates,
    menuDetails: 'Menu 2',
    notes: '',
    distance: 2.8,
  });

  const b3 = await createBid({
    requestId: request.id,
    vendorId: 'v3',
    vendorName: 'Vendor 3',
    pricePerPlate: 260,
    totalPrice: 260 * request.plates,
    menuDetails: 'Menu 3',
    notes: '',
    distance: 3.2,
  });

  return { request, b1, b2, b3 };
}

describe('Bid flow integrity', () => {
  it('keeps exactly one accepted bid after selection', async () => {
    const { request, b1, b2, b3 } = await createRequestWithThreeBids();
    await acceptBid(b2.id);

    const requestAfter = await getRequest(request.id);
    const bidsAfter = await getBidsForRequest(request.id);
    const accepted = bidsAfter.filter((b) => b.status === 'accepted');
    const rejected = bidsAfter.filter((b) => b.status === 'rejected');

    expect(requestAfter.status).toBe('confirmed');
    expect(requestAfter.confirmedBidId).toBe(b2.id);
    expect(requestAfter.confirmedVendorId).toBe('v2');
    expect(accepted).toHaveLength(1);
    expect(accepted[0].id).toBe(b2.id);
    expect(rejected.map((b) => b.id).sort()).toEqual([b1.id, b3.id].sort());
  });

  it('does not allow a different bid to replace an already confirmed bid', async () => {
    const { request, b1, b2 } = await createRequestWithThreeBids();
    await acceptBid(b1.id);
    const secondAcceptResult = await acceptBid(b2.id);

    const requestAfter = await getRequest(request.id);
    const bidsAfter = await getBidsForRequest(request.id);
    const accepted = bidsAfter.filter((b) => b.status === 'accepted');

    expect(requestAfter.confirmedBidId).toBe(b1.id);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].id).toBe(b1.id);
    expect(secondAcceptResult.id).toBe(b1.id);
  });

  it('reopens bidding when customer cancels selected bid', async () => {
    const { request, b2 } = await createRequestWithThreeBids();
    await acceptBid(b2.id);
    await cancelAcceptedBid(request.id);

    const requestAfter = await getRequest(request.id);
    const bidsAfter = await getBidsForRequest(request.id);
    const skipped = bidsAfter.filter((b) => b.status === 'skipped');
    const pending = bidsAfter.filter((b) => b.status === 'pending');

    expect(requestAfter.status).toBe('bidding');
    expect(requestAfter.confirmedBidId).toBeNull();
    expect(requestAfter.confirmedVendorId).toBeNull();
    expect(skipped).toHaveLength(1);
    expect(skipped[0].id).toBe(b2.id);
    expect(pending).toHaveLength(2);
  });

  it('prevents new bid creation after request is confirmed', async () => {
    const { request, b1 } = await createRequestWithThreeBids();
    await acceptBid(b1.id);

    const blockedBid = await createBid({
      requestId: request.id,
      vendorId: 'v4',
      vendorName: 'Late Vendor',
      pricePerPlate: 230,
      totalPrice: 230 * request.plates,
      menuDetails: 'Late menu',
      notes: '',
      distance: 4.5,
    });

    const bidsAfter = await getBidsForRequest(request.id);
    expect(blockedBid).toBeNull();
    expect(bidsAfter).toHaveLength(3);
  });

  it('cancels full request and closes all associated bids', async () => {
    const { request, b2 } = await createRequestWithThreeBids();
    await acceptBid(b2.id);

    const cancelled = await cancelRequest(request.id);
    const requestAfter = await getRequest(request.id);
    const bidsAfter = await getBidsForRequest(request.id);

    expect(cancelled).not.toBeNull();
    expect(requestAfter.status).toBe('cancelled');
    expect(requestAfter.confirmedBidId).toBeNull();
    expect(requestAfter.confirmedVendorId).toBeNull();
    expect(bidsAfter.every((b) => b.status === 'skipped')).toBe(true);
  });

  it('creates unique IDs for rapid request and bid creation', async () => {
    const req1 = await createRequest(baseRequest);
    const req2 = await createRequest(baseRequest);

    expect(req1.id).not.toBe(req2.id);

    const bid1 = await createBid({
      requestId: req1.id,
      vendorId: 'v10',
      vendorName: 'Vendor 10',
      pricePerPlate: 200,
      totalPrice: 200 * req1.plates,
      menuDetails: 'Menu 10',
      notes: '',
      distance: 1.1,
    });
    const bid2 = await createBid({
      requestId: req1.id,
      vendorId: 'v11',
      vendorName: 'Vendor 11',
      pricePerPlate: 210,
      totalPrice: 210 * req1.plates,
      menuDetails: 'Menu 11',
      notes: '',
      distance: 1.3,
    });

    expect(bid1.id).not.toBe(bid2.id);
  });
});
