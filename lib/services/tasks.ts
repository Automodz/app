import {
  collection, doc, addDoc, updateDoc, getDocs, query, where,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FollowUpTask } from '../types';

export const addTask = async (data: {
  note: string; dueDate: string;
  customerName?: string; customerPhone?: string;
  refType?: 'quote' | 'job' | 'booking'; refId?: string;
  byName: string;
}): Promise<string> => {
  const r = await addDoc(collection(db, 'tasks'), {
    note: data.note, dueDate: data.dueDate,
    ...(data.customerName ? { customerName: data.customerName } : {}),
    ...(data.customerPhone ? { customerPhone: data.customerPhone } : {}),
    ...(data.refType ? { refType: data.refType, refId: data.refId } : {}),
    done: false, createdByName: data.byName, createdAt: serverTimestamp(),
  });
  return r.id;
};

export const completeTask = (id: string) =>
  updateDoc(doc(db, 'tasks', id), { done: true, completedAt: Timestamp.now() });

/** Open tasks due today or overdue, oldest first. */
export const getDueTasks = async (today: string): Promise<FollowUpTask[]> => {
  const snap = await getDocs(query(
    collection(db, 'tasks'), where('done', '==', false),
  ));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as FollowUpTask))
    .filter(t => t.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
};

export const getOpenTasks = async (): Promise<FollowUpTask[]> => {
  const snap = await getDocs(query(collection(db, 'tasks'), where('done', '==', false)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as FollowUpTask))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
};
