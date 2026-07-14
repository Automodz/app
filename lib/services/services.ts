import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Service } from '../types';
import { STATIC_SERVICES } from '../constants';

export const getServices = async (): Promise<Service[]> => {
  try {
    const snap = await getDocs(collection(db, 'services'));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
  } catch {}
  return STATIC_SERVICES;
};

export const seedServices = async () => {
  for (const s of STATIC_SERVICES)
    await addDoc(collection(db, 'services'), { ...s, active: true, createdAt: serverTimestamp() });
};