import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Vehicle } from '../types';

export const addVehicle = async (uid: string, v: Omit<Vehicle, 'id' | 'createdAt'>) => {
  const r = await addDoc(collection(db, 'users', uid, 'vehicles'), {
    ...v, createdAt: serverTimestamp(),
  });
  return r.id;
};

export const getVehicles = async (uid: string): Promise<Vehicle[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'vehicles'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
};

export const updateVehicle = (uid: string, vid: string, data: Partial<Vehicle>) =>
  updateDoc(doc(db, 'users', uid, 'vehicles', vid), data);

export const deleteVehicle = (uid: string, vid: string) =>
  deleteDoc(doc(db, 'users', uid, 'vehicles', vid));