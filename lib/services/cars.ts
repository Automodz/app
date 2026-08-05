/**
 * WHAT LIVES HERE NOW: the studio's own writes, from the admin application.
 *
 * Every customer-facing reader and writer that used to sit in this file is
 * gone. `/cars` renders on the server, so listings are read through
 * `lib/server/marketplace.ts`; leads, offers and saved cars are written
 * through `lib/server/marketService.ts` behind `POST /api/cars/*`, because a
 * client write cannot guarantee the studio is told and the Firestore rules now
 * refuse it outright.
 */
import {
  collection, doc, addDoc, updateDoc, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { uploadImage, deleteImage } from './storage';
import type { CarListing, CarLead, SellRequest, CarPhoto, LeadStatus } from '../types';

// ── Listings ─────────────────────────────────────────────────────────────────

export const createCarListing = async (
  data: Omit<CarListing, 'id' | 'photos' | 'createdAt' | 'updatedAt'>,
): Promise<string> => {
  const r = await addDoc(collection(db, 'carListings'), {
    ...data, photos: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return r.id;
};

export const updateCarListing = (id: string, data: Partial<Omit<CarListing, 'id' | 'createdAt'>>) =>
  updateDoc(doc(db, 'carListings', id), { ...data, updatedAt: serverTimestamp() });

export const uploadListingPhotos = async (listingId: string, files: File[]): Promise<CarPhoto[]> => {
  const photos: CarPhoto[] = [];
  for (const file of files) {
    const path = `carListings/${listingId}/${crypto.randomUUID()}.jpg`;
    photos.push(await uploadImage(path, file));
  }
  return photos;
};

export const deleteListingPhoto = async (listingId: string, photo: CarPhoto, remaining: CarPhoto[]) => {
  await deleteImage(photo.path);
  await updateDoc(doc(db, 'carListings', listingId), { photos: remaining, updatedAt: serverTimestamp() });
};

export const getAllCarListings = async (): Promise<CarListing[]> => {
  const snap = await getDocs(collection(db, 'carListings'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as CarListing))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const getCarLeads = async (): Promise<CarLead[]> => {
  const snap = await getDocs(collection(db, 'carLeads'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as CarLead))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const updateLeadStatus = (id: string, status: LeadStatus, adminNotes?: string) =>
  updateDoc(doc(db, 'carLeads', id), {
    status, ...(adminNotes != null ? { adminNotes } : {}), updatedAt: serverTimestamp(),
  });

// ── Sell requests ────────────────────────────────────────────────────────────

export const getSellRequests = async (): Promise<SellRequest[]> => {
  const snap = await getDocs(collection(db, 'sellRequests'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as SellRequest))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const updateSellRequestStatus = (id: string, status: LeadStatus, adminNotes?: string) =>
  updateDoc(doc(db, 'sellRequests', id), {
    status, ...(adminNotes != null ? { adminNotes } : {}), updatedAt: serverTimestamp(),
  });
