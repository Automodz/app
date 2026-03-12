// lib/firebaseService.ts
// Barrel re-export — all modules split into lib/services/*
// Existing imports across the app require no changes.

export * from './services/auth';
export * from './services/vehicles';
export * from './services/bookings';
export * from './services/notifications';
export * from './services/subscriptions';
export * from './services/admin';
export * from './services/services';
export * from './constants';
export * from './demo-data';