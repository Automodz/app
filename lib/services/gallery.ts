import {
  collection, doc, addDoc, deleteDoc, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { uploadImage, deleteImage } from './storage';

export interface GalleryImage {
  id: string;
  url: string;
  path: string;
  caption?: string;
  category: string;            // PPF | Washing | Ceramic | Coating | Other
  active: boolean;
  createdAt?: { toMillis?: () => number };
}

export const addGalleryImage = async (file: File, category: string, caption?: string) => {
  const uploaded = await uploadImage(`gallery/${crypto.randomUUID()}.jpg`, file, { maxWidth: 1600 });
  await addDoc(collection(db, 'gallery'), {
    ...uploaded, category, ...(caption ? { caption } : {}),
    active: true, createdAt: serverTimestamp(),
  });
};

export const deleteGalleryImage = async (img: GalleryImage) => {
  await deleteImage(img.path);
  await deleteDoc(doc(db, 'gallery', img.id));
};

export const getGalleryImages = async (activeOnly = true): Promise<GalleryImage[]> => {
  const base = collection(db, 'gallery');
  const snap = activeOnly
    ? await getDocs(query(base, where('active', '==', true)))
    : await getDocs(base);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as GalleryImage))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};
