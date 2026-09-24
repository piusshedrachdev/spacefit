import { describe, expect, it } from 'vitest';
import { can, type Visibility } from '@/lib/permissions';

const guest: Visibility = { isAuthenticated: false, role: 'customer' };
const customer: Visibility = { isAuthenticated: true, role: 'customer' };
const seller: Visibility = { isAuthenticated: true, role: 'seller' };
const admin: Visibility = { isAuthenticated: true, role: 'admin' };

describe('visibility rules (who sees what)', () => {
  it('gates account features (bell, reviews, prefill) on sign-in', () => {
    expect(can.seeAccountFeatures(guest)).toBe(false);
    expect(can.writeReviews(guest)).toBe(false);
    expect(can.seeAccountFeatures(customer)).toBe(true);
    expect(can.writeReviews(customer)).toBe(true);
  });

  it('offers the "Become a Seller" pitch to customers only', () => {
    expect(can.applyAsSeller(guest)).toBe(true);
    expect(can.applyAsSeller(customer)).toBe(true);
    expect(can.applyAsSeller(seller)).toBe(false);
    expect(can.applyAsSeller(admin)).toBe(false);
  });

  it('shows dashboard entry points to sellers and admins', () => {
    expect(can.seeDashboardLink(customer)).toBe(false);
    expect(can.seeDashboardLink(seller)).toBe(true);
    expect(can.seeDashboardLink(admin)).toBe(true);
    expect(can.openSellerDashboard(seller)).toBe(true);
    expect(can.openSellerDashboard(admin)).toBe(false);
    expect(can.openAdmin(admin)).toBe(true);
    expect(can.openAdmin(seller)).toBe(false);
  });

  it('shows the consultation banner to signed-in customers only', () => {
    expect(can.seeConsultation(guest)).toBe(false);
    expect(can.seeConsultation(customer)).toBe(true);
    expect(can.seeConsultation(seller)).toBe(false);
    expect(can.seeConsultation(admin)).toBe(false);
  });

  it('always allows guest checkout (legacy parity)', () => {
    expect(can.checkout(guest)).toBe(true);
    expect(can.checkout(customer)).toBe(true);
  });

  it('scopes catalogue management by role', () => {
    expect(can.manageOwnCatalogue(seller)).toBe(true);
    expect(can.manageOwnCatalogue(customer)).toBe(false);
    expect(can.moderateCatalogue(admin)).toBe(true);
    expect(can.moderateCatalogue(seller)).toBe(false);
  });
});
