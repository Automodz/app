import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, setDoc,
  query, where, serverTimestamp,
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

export const getCarListing = async (id: string): Promise<CarListing | null> => {
  const snap = await getDoc(doc(db, 'carListings', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as CarListing) : null;
};

/** Public browse - active listings only (matches rules). */
export const getActiveCarListings = async (): Promise<CarListing[]> => {
  const snap = await getDocs(query(collection(db, 'carListings'), where('active', '==', true)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as CarListing))
    .sort((a, b) => (Number(b.featured) - Number(a.featured)) ||
      ((b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
};

export const getAllCarListings = async (): Promise<CarListing[]> => {
  const snap = await getDocs(collection(db, 'carListings'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as CarListing))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const deleteCarListing = async (listing: CarListing) => {
  for (const p of listing.photos) await deleteImage(p.path);
  await deleteDoc(doc(db, 'carListings', listing.id));
};

// ── Saved cars (favourites) ──────────────────────────────────────────────────

export const saveCar = (uid: string, listingId: string) =>
  setDoc(doc(db, 'users', uid, 'savedCars', listingId), { savedAt: serverTimestamp() });

export const unsaveCar = (uid: string, listingId: string) =>
  deleteDoc(doc(db, 'users', uid, 'savedCars', listingId));

export const getSavedCarIds = async (uid: string): Promise<string[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'savedCars'));
  return snap.docs.map(d => d.id);
};

// ── Leads (inquiries + viewing requests) ─────────────────────────────────────

export const createCarLead = async (data: {
  listingId: string; listingTitle: string; type: 'inquiry' | 'viewing';
  userId?: string; name: string; phone: string;
  message?: string; preferredDate?: string; preferredTime?: string;
}): Promise<string> => {
  const clean: Record<string, unknown> = {
    listingId: data.listingId, listingTitle: data.listingTitle, type: data.type,
    name: data.name.trim(), phone: data.phone.replace(/\D/g, '').slice(-10),
    status: 'new', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  if (data.userId) clean.userId = data.userId;
  if (data.message) clean.message = data.message;
  if (data.preferredDate) clean.preferredDate = data.preferredDate;
  if (data.preferredTime) clean.preferredTime = data.preferredTime;
  const r = await addDoc(collection(db, 'carLeads'), clean);
  return r.id;
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

export const createSellRequest = async (data: {
  userId: string; name: string; phone: string;
  make: string; model: string; year: number; kmDriven: number;
  expectedPrice?: number; description?: string; files: File[];
}): Promise<string> => {
  const photos: CarPhoto[] = [];
  for (const file of data.files) {
    const path = `sellRequests/${data.userId}/${crypto.randomUUID()}.jpg`;
    photos.push(await uploadImage(path, file));
  }
  const { files: _files, ...rest } = data;
  const clean: Record<string, unknown> = {
    ...rest, phone: data.phone.replace(/\D/g, '').slice(-10),
    photos, status: 'new', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  if (!data.expectedPrice) delete clean.expectedPrice;
  if (!data.description) delete clean.description;
  const r = await addDoc(collection(db, 'sellRequests'), clean);
  return r.id;
};

export const getSellRequests = async (): Promise<SellRequest[]> => {
  const snap = await getDocs(collection(db, 'sellRequests'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as SellRequest))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const getUserSellRequests = async (uid: string): Promise<SellRequest[]> => {
  const snap = await getDocs(query(collection(db, 'sellRequests'), where('userId', '==', uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SellRequest));
};

export const updateSellRequestStatus = (id: string, status: LeadStatus, adminNotes?: string) =>
  updateDoc(doc(db, 'sellRequests', id), {
    status, ...(adminNotes != null ? { adminNotes } : {}), updatedAt: serverTimestamp(),
  });
