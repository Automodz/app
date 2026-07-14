'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { UserPlus, X, KeyRound, Phone, BadgeCheck, UserX, ChevronRight } from 'lucide-react';
import {
  createEmployee, updateEmployee, deactivateEmployee, reactivateEmployee,
  resetPin, listEmployees,
} from '@/lib/firebaseService';
import { PIN_MIN_LENGTH, PIN_MAX_LENGTH } from '@/lib/config/storeConfig';
import { formatCurrency } from '@/lib/utils';
import type { Employee, EmployeeRole } from '@/lib/types';

const ROLES: EmployeeRole[] = ['detailer', 'washer', 'manager', 'helper'];

const emptyForm = {
  name: '', phone: '', email: '', role: 'detailer' as EmployeeRole, pin: '',
  salaryType: 'monthly' as 'monthly' | 'per_day', monthlyBase: '', perDayRate: '',
  joinedAt: new Date().toISOString().slice(0, 10),
};

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pinResetFor, setPinResetFor] = useState<Employee | null>(null);
  const [newPin, setNewPin] = useState('');

  const load = async () => {
    setEmployees(await listEmployees(true));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const validPin = (p: string) => new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(p);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({
      name: e.name, phone: e.phone, email: e.email ?? '', role: e.role, pin: '',
      salaryType: e.salary.type,
      monthlyBase: e.salary.monthlyBase?.toString() ?? '',
      perDayRate: e.salary.perDayRate?.toString() ?? '',
      joinedAt: e.joinedAt,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.phone.replace(/\D/g, '').length < 10) {
      toast.error('Name and 10-digit phone required'); return;
    }
    const salary = {
      type: form.salaryType,
      ...(form.salaryType === 'monthly'
        ? { monthlyBase: Number(form.monthlyBase) || 0 }
        : { perDayRate: Number(form.perDayRate) || 0 }),
    };
    setSaving(true);
    try {
      if (editing) {
        await updateEmployee(editing.id, {
          name: form.name.trim(), phone: form.phone.replace(/\D/g, '').slice(-10),
          email: form.email.trim().toLowerCase(), role: form.role, salary, joinedAt: form.joinedAt,
        });
        toast.success('Employee updated');
      } else {
        if (!validPin(form.pin)) {
          toast.error(`PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`);
          setSaving(false); return;
        }
        await createEmployee({
          name: form.name.trim(), phone: form.phone.replace(/\D/g, '').slice(-10),
          email: form.email.trim().toLowerCase(), role: form.role, pin: form.pin, salary, joinedAt: form.joinedAt,
        });
        toast.success('Employee added - PIN set');
      }
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e); toast.error('Save failed');
    } finally { setSaving(false); }
  };

  const handlePinReset = async () => {
    if (!pinResetFor || !validPin(newPin)) {
      toast.error(`PIN must be ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`); return;
    }
    await resetPin(pinResetFor.id, newPin);
    toast.success(`PIN reset for ${pinResetFor.name}`);
    setPinResetFor(null); setNewPin('');
  };

  const toggleActive = async (e: Employee) => {
    if (e.active) { await deactivateEmployee(e.id); toast.success(`${e.name} deactivated`); }
    else { await reactivateEmployee(e.id); toast.success(`${e.name} reactivated`); }
    await load();
  };

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="data-label block mb-1">{label}</label>
      {node}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-2xl" style={{ color: 'var(--chrome)' }}>EMPLOYEES</h1>
          <p className="text-sm font-body" style={{ color: 'var(--steel)' }}>
            {employees.filter(e => e.active).length} active · PINs unlock Store Mode
          </p>
        </div>
        <button onClick={openCreate} className="btn-ember flex items-center gap-2 px-4 py-2.5 text-sm">
          <UserPlus size={15} /> Add
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
      ) : employees.length === 0 ? (
        <div className="card text-center py-12">
          <p className="font-body" style={{ color: 'var(--steel)' }}>No employees yet. Add your team to enable Store Mode.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((e, i) => (
            <motion.div key={e.id} initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="card-dark" style={{ opacity: e.active ? 1 : 0.5 }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--smoke)' }}>
                  <span className="font-display font-800 text-lg" style={{ color: 'var(--ember)' }}>
                    {e.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{e.name}</span>
                    <span className="data-label px-1.5 py-0.5 rounded" style={{ background: 'var(--dark)', color: 'var(--ember)' }}>{e.role}</span>
                    {!e.active && <span className="data-label" style={{ color: 'var(--steel)' }}>inactive</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs font-body" style={{ color: 'var(--steel)' }}>
                    <span className="flex items-center gap-1"><Phone size={10} />{e.phone}</span>
                    <span>
                      {e.salary.type === 'monthly'
                        ? `${formatCurrency(e.salary.monthlyBase ?? 0)}/mo`
                        : `${formatCurrency(e.salary.perDayRate ?? 0)}/day`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPinResetFor(e)} title="Reset PIN"
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
                    <KeyRound size={14} />
                  </button>
                  <button onClick={() => toggleActive(e)} title={e.active ? 'Deactivate' : 'Reactivate'}
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--dark)', color: e.active ? 'var(--steel)' : 'var(--ember)' }}>
                    {e.active ? <UserX size={14} /> : <BadgeCheck size={14} />}
                  </button>
                  <button onClick={() => openEdit(e)} title="Edit"
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--dark)', color: 'var(--steel)' }}>
                    <ChevronRight size={14} />
                  </button>
                  <Link href={`/admin/employees/${e.id}`} title="Attendance & salary"
                    className="px-3 h-9 flex items-center rounded-xl data-label"
                    style={{ background: 'var(--smoke)', color: 'var(--chrome)' }}>
                    Payroll
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / edit drawer */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowForm(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-lg" style={{ color: 'var(--chrome)' }}>
                  {editing ? 'EDIT EMPLOYEE' : 'NEW EMPLOYEE'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'var(--dark)', color: 'var(--steel)' }}><X size={14} /></button>
              </div>
              <div className="space-y-3">
                {field('Name', <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Employee name" />)}
                {field('Phone', <input className="input" value={form.phone} inputMode="numeric" onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />)}
                {field('Google email (app sign-in)', <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="employee@gmail.com - optional" />)}
                {field('Role',
                  <div className="flex gap-2 flex-wrap">
                    {ROLES.map(r => (
                      <button key={r} onClick={() => setForm({ ...form, role: r })}
                        className="px-3 py-2 rounded-xl data-label"
                        style={{
                          background: form.role === r ? 'var(--accent-mist)' : 'var(--dark)',
                          border: form.role === r ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                          color: form.role === r ? 'var(--ember)' : 'var(--steel)',
                        }}>{r}</button>
                    ))}
                  </div>
                )}
                {!editing && field(`Kiosk PIN (${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits)`,
                  <input className="input" value={form.pin} inputMode="numeric" maxLength={PIN_MAX_LENGTH}
                    onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="Shown only now - hashed after save" />)}
                {field('Salary type',
                  <div className="flex gap-2">
                    {(['monthly', 'per_day'] as const).map(t => (
                      <button key={t} onClick={() => setForm({ ...form, salaryType: t })}
                        className="px-3 py-2 rounded-xl data-label"
                        style={{
                          background: form.salaryType === t ? 'var(--accent-mist)' : 'var(--dark)',
                          border: form.salaryType === t ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                          color: form.salaryType === t ? 'var(--ember)' : 'var(--steel)',
                        }}>{t === 'monthly' ? 'Monthly' : 'Per day'}</button>
                    ))}
                  </div>
                )}
                {form.salaryType === 'monthly'
                  ? field('Monthly base (₹)', <input className="input" inputMode="numeric" value={form.monthlyBase} onChange={e => setForm({ ...form, monthlyBase: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 18000" />)
                  : field('Per-day rate (₹)', <input className="input" inputMode="numeric" value={form.perDayRate} onChange={e => setForm({ ...form, perDayRate: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 700" />)}
                {field('Joined', <input className="input" type="date" value={form.joinedAt} onChange={e => setForm({ ...form, joinedAt: e.target.value })} />)}
                <button onClick={handleSave} disabled={saving} className="btn-ember w-full py-3 mt-2">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PIN reset modal */}
      <AnimatePresence>
        {pinResetFor && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPinResetFor(null)} />
            <motion.div initial={false} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-1/3 z-50 rounded-2xl p-5 max-w-sm mx-auto"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="font-display font-700 mb-1" style={{ color: 'var(--chrome)' }}>Reset PIN</h3>
              <p className="text-xs font-body mb-3" style={{ color: 'var(--steel)' }}>
                New kiosk PIN for <b>{pinResetFor.name}</b>. The old PIN stops working immediately.
              </p>
              <input className="input mb-3" inputMode="numeric" maxLength={PIN_MAX_LENGTH} value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder={`${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`} autoFocus />
              <div className="flex gap-2">
                <button onClick={() => { setPinResetFor(null); setNewPin(''); }} className="btn-ghost flex-1 py-2.5">Cancel</button>
                <button onClick={handlePinReset} className="btn-ember flex-1 py-2.5">Set PIN</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
