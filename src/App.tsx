import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, CalendarDays, Check, ClipboardList, ChevronDown, ChevronRight, CircleDollarSign, Download, FileText, HandCoins, HardHat, Lightbulb, Lock, Menu, Plus, Printer, ReceiptIndianRupee, Search, Settings, Trash2, Users, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

type View = 'Customers' | 'Quotations' | 'Estimates' | 'Invoices' | 'Labour' | 'Settings';
type Customer = { id: string; name: string; project_name: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null; gst_number: string | null; notes: string | null; created_at: string };
type Document = { id: string; invoice_number?: string; quotation_number?: string; customer_id: string | null; status: string; grand_total: number; amount_paid?: number; balance_due?: number; discount?: number; tax?: number; invoice_date?: string; quotation_date?: string; due_date?: string; valid_until?: string; notes?: string | null; created_at: string; customers?: { name: string; project_name: string | null; address: string | null; phone: string | null; gst_number: string | null } | null };
type SettingsData = { id: string; company_name: string; proprietor_name: string; address: string; phone: string; email: string; invoice_prefix: string; quotation_prefix: string; default_tax: number; default_footer: string; trust_text: string; currency: string };
type Line = { description: string; unit: string; quantity: number; rate: number };
type PreviewData = { type: 'invoice' | 'quotation'; document: Document; lines: Line[]; customer: Customer | null };
type Estimate = { id: string; estimate_number: string; customer_id: string | null; estimate_date: string; status: string; notes: string | null; created_at: string; customers?: { name: string; project_name: string | null; address: string | null; phone: string | null } | null };
type EstimateItem = { id: string; estimate_id: string; description: string; particulars: string | null; quantity: number; created_at: string };
type EstimateLine = { description: string; particulars: string; quantity: number };
type EstimatePreviewData = { estimate: Estimate; items: EstimateItem[]; customer: Customer | null };
type Labourer = { id: string; name: string; role: string | null; phone: string | null; daily_wage: number; weekly_incentive: number; is_deleted: boolean; created_at: string };
type LabourPayment = { id: string; labourer_id: string; week_ending: string; amount: number; paid: boolean; notes: string | null; created_at: string; amount_paid: number; balance: number; payment_status: string };
type AttendanceRecord = { id: string; labourer_id: string; week_ending: string; day_mon: boolean; day_tue: boolean; day_wed: boolean; day_thu: boolean; day_fri: boolean; day_sat: boolean; day_sun: boolean; incentive: number; amount: number; settled: boolean; notes: string | null; incentive_mon: number; incentive_tue: number; incentive_wed: number; incentive_thu: number; incentive_fri: number; incentive_sat: number; incentive_sun: number; site_mon: string | null; site_tue: string | null; site_wed: string | null; site_thu: string | null; site_fri: string | null; site_sat: string | null; site_sun: string | null };
type LabourAdvance = { id: string; labourer_id: string; amount: number; amount_remaining: number; given_date: string; note: string | null; created_at: string };
type LabourerWithPayments = Labourer & { payments: LabourPayment[]; attendance: AttendanceRecord[]; advances: LabourAdvance[] };

const nav = [
  ['Quotations', FileText], ['Estimates', ClipboardList], ['Invoices', ReceiptIndianRupee], ['Customers', Users], ['Labour', HardHat], ['Settings', Settings],
] as const;
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = new Date().toISOString().slice(0, 10);
function selectZeroOnFocus(event: React.FocusEvent<HTMLInputElement>) { if (event.currentTarget.value === '0') event.currentTarget.select(); }
function resizeDescription(event: React.FormEvent<HTMLTextAreaElement>) { const textarea = event.currentTarget; textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`; }

const LOCK_EMAIL = 'irsusheikh13@gmail.com';
const recoveryUrlRequested = (() => {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery' || searchParams.get('reset') === '1';
})();

function App() {
  const [view, setView] = useState<View>('Invoices');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Document[]>([]);
  const [quotations, setQuotations] = useState<Document[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'customer' | 'customerProfile' | 'document' | 'preview' | 'estimate' | 'estimatePreview' | 'labourer' | null>(null);
  const [documentType, setDocumentType] = useState<'invoice' | 'quotation'>('invoice');
  const [editingDocument, setEditingDocument] = useState<{ document: Document; lines: Line[]; customer: Customer | null } | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [editingEstimate, setEditingEstimate] = useState<{ estimate: Estimate; items: EstimateItem[]; customer: Customer | null } | null>(null);
  const [estimatePreview, setEstimatePreview] = useState<EstimatePreviewData | null>(null);
  const [labourers, setLabourers] = useState<LabourerWithPayments[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notice, setNotice] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const recoveryFlowRef = useRef(recoveryUrlRequested);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [showLock, setShowLock] = useState(recoveryUrlRequested);
  const [recoveryMode, setRecoveryMode] = useState(recoveryUrlRequested);
  const isUnlocked = !!session;

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') recoveryFlowRef.current = true;
      if (recoveryFlowRef.current) {
        setRecoveryMode(true);
        setShowLock(true);
        setSession(newSession);
        return;
      }
      setRecoveryMode(false);
      setSession(newSession);
      if (newSession) setShowLock(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
      if (recoveryFlowRef.current) {
        setRecoveryMode(true);
        setShowLock(true);
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);


  async function loadData() {
    const [customerRes, invoiceRes, quotationRes, estimateRes, settingRes, labourerRes, paymentRes, attendanceRes, advanceRes] = await Promise.all([
      supabase.from('customers').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, customers(name, project_name, address, phone, gst_number)').order('created_at', { ascending: false }),
      supabase.from('quotations').select('*, customers(name, project_name, address, phone, gst_number)').order('created_at', { ascending: false }),
      supabase.from('estimates').select('*, customers(name, project_name, address, phone, gst_number)').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('labourers').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('labour_payments').select('*').order('week_ending', { ascending: false }),
      supabase.from('labour_attendance').select('*').order('week_ending', { ascending: false }),
      supabase.from('labour_advances').select('*').order('given_date', { ascending: true }),
    ]);
    if (!customerRes.error) setCustomers(customerRes.data || []);
    if (!invoiceRes.error) setInvoices(invoiceRes.data || []);
    if (!quotationRes.error) setQuotations(quotationRes.data || []);
    if (!estimateRes.error) setEstimates(estimateRes.data || []);
    if (!settingRes.error) setSettings(settingRes.data);
    if (!labourerRes.error && !paymentRes.error && !attendanceRes.error && !advanceRes.error) {
      const labourerData = (labourerRes.data || []).map((labourer: Labourer) => ({
        ...labourer,
        payments: (paymentRes.data || []).filter((p: LabourPayment) => p.labourer_id === labourer.id),
        attendance: (attendanceRes.data || []).filter((r: AttendanceRecord) => r.labourer_id === labourer.id),
        advances: (advanceRes.data || []).filter((a: LabourAdvance) => a.labourer_id === labourer.id),
      }));
      setLabourers(labourerData);
    }
  }
  useEffect(() => { if (authChecked) void loadData(); }, [authChecked]);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(''), 2800); return () => window.clearTimeout(timer); } }, [notice]);

  const totals = useMemo(() => ({
    invoiceAmount: invoices.reduce((sum, row) => sum + Number(row.grand_total || 0), 0),
    quotationAmount: quotations.reduce((sum, row) => sum + Number(row.grand_total || 0), 0),
    paid: invoices.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0),
    pending: invoices.reduce((sum, row) => sum + Number(row.balance_due || 0), 0),
  }), [invoices, quotations]);
  const filteredCustomers = customers.filter((row) => `${row.name} ${row.phone || ''} ${row.project_name || ''}`.toLowerCase().includes(query.toLowerCase()));

  function guardDocument(action: () => void) { pendingActionRef.current = action; setShowLock(true); }
  function openCreate(type: 'invoice' | 'quotation') {
    guardDocument(() => { setEditingDocument(null); setDocumentType(type); setModal('document'); });
  }
  async function openEdit(type: 'invoice' | 'quotation', document: Document) {
    guardDocument(async () => {
      const table = type === 'invoice' ? 'invoice_items' : 'quotation_items';
      const key = type === 'invoice' ? 'invoice_id' : 'quotation_id';
      const { data, error } = await supabase.from(table).select('description, unit, quantity, rate').eq(key, document.id);
      if (error) { setNotice('Unable to load this document for editing'); return; }
      setEditingDocument({ document, lines: data || [], customer: customers.find((row) => row.id === document.customer_id) || null });
      setDocumentType(type);
      setModal('document');
    });
  }
  async function openPreview(type: 'invoice' | 'quotation', document: Document) {
    guardDocument(async () => {
      const table = type === 'invoice' ? 'invoice_items' : 'quotation_items';
      const key = type === 'invoice' ? 'invoice_id' : 'quotation_id';
      const { data, error } = await supabase.from(table).select('description, unit, quantity, rate').eq(key, document.id);
      if (error) { setNotice('Unable to load this document'); return; }
      const customer = customers.find((row) => row.id === document.customer_id) || null;
      setPreview({ type, document, lines: data || [], customer });
      setModal('preview');
    });
  }
  async function deleteCustomer(customer: Customer) { if (!window.confirm(`Delete ${customer.name}?`)) return; setCustomers((current) => current.filter((c) => c.id !== customer.id)); const { error } = await supabase.from('customers').update({ is_deleted: true }).eq('id', customer.id); if (error) { void loadData(); setNotice('Unable to delete customer'); } else setNotice('Customer removed'); }
  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const { error } = await supabase.from('customers').insert(data); if (error) setNotice(error.message); else { setModal(null); setNotice('Customer added'); void loadData(); } }
  async function saveLabourer(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const payload = { name: data.name, role: data.role || null, phone: data.phone || null, daily_wage: Number(data.daily_wage), weekly_incentive: Number(data.weekly_incentive || 0) }; const { error } = await supabase.from('labourers').insert(payload); if (error) setNotice(error.message); else { setModal(null); setNotice('Labourer added'); void loadData(); } }
  async function deleteLabourer(labourer: Labourer) { const full = labourers.find((l) => l.id === labourer.id); const pendingAdvance = full ? full.advances.reduce((sum, a) => sum + Number(a.amount_remaining || 0), 0) : 0; if (pendingAdvance > 0) { const choice = window.confirm(`Remove ${labourer.name}?\n\nThis worker has ${money(pendingAdvance)} in pending advances.\n\nPress OK to mark advances as waived and remove the worker, or Cancel to keep the worker.`); if (!choice) return; await supabase.from('labour_advances').update({ amount_remaining: 0 }).eq('labourer_id', labourer.id); } else { if (!window.confirm(`Remove ${labourer.name}?`)) return; } setLabourers((current) => current.filter((l) => l.id !== labourer.id)); const { error } = await supabase.from('labourers').update({ is_deleted: true }).eq('id', labourer.id); if (error) { void loadData(); setNotice('Unable to remove labourer'); } else setNotice('Labourer removed'); }
  async function recordLabourPayment(payment: LabourPayment, amount: number) {
    const total = Number(payment.amount || 0);
    const currentPaid = Number(payment.amount_paid || 0);
    const newPaid = Math.min(total, currentPaid + amount);
    const newBalance = Math.max(0, total - newPaid);
    const newStatus = newBalance <= 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Unpaid';
    const newPaidBool = newStatus === 'Paid';
    setLabourers((current) => current.map((l) => ({ ...l, payments: l.payments.map((p) => p.id === payment.id ? { ...p, amount_paid: newPaid, balance: newBalance, payment_status: newStatus, paid: newPaidBool } : p) })));
    const { error } = await supabase.from('labour_payments').update({ amount_paid: newPaid, balance: newBalance, payment_status: newStatus, paid: newPaidBool }).eq('id', payment.id);
    if (error) { void loadData(); setNotice('Unable to record payment'); }
    else setNotice(amount >= total ? `Fully paid ${money(total)}` : `Partial payment of ${money(amount)} recorded`);
  }
  async function markLabourPaid(payment: LabourPayment) {
    const total = Number(payment.amount || 0);
    const newPaid = total;
    setLabourers((current) => current.map((l) => ({ ...l, payments: l.payments.map((p) => p.id === payment.id ? { ...p, amount_paid: newPaid, balance: 0, payment_status: 'Paid', paid: true } : p) })));
    const { error } = await supabase.from('labour_payments').update({ amount_paid: newPaid, balance: 0, payment_status: 'Paid', paid: true }).eq('id', payment.id);
    if (error) { void loadData(); setNotice('Unable to update payment'); }
    else setNotice(`Marked fully paid ${money(total)}`);
  }
  async function deletePayment(payment: LabourPayment) {
    if (!window.confirm('Delete this week\'s payment and attendance? The week will start fresh so you can fill it again.')) return;
    setLabourers((current) => current.map((l) => ({ ...l, payments: l.payments.filter((p) => p.id !== payment.id), attendance: l.attendance.filter((r) => !(r.labourer_id === payment.labourer_id && r.week_ending === payment.week_ending)) })));
    await supabase.from('labour_payments').delete().eq('id', payment.id);
    await supabase.from('labour_attendance').delete().eq('labourer_id', payment.labourer_id).eq('week_ending', payment.week_ending);
    setNotice('Week deleted — start fresh');
    void loadData();
  }
  async function unlockWeek(record: AttendanceRecord) {
    const linked = labourers.flatMap((l) => l.payments).find((p) => p.labourer_id === record.labourer_id && p.week_ending === record.week_ending);
    if (linked && linked.payment_status === 'Paid') { setNotice('This week is already paid, so it cannot be changed'); return; }
    if (!window.confirm('Make changes to this week? The payment entry for this week will be removed so you can update the attendance.')) return;
    setLabourers((current) => current.map((l) => ({ ...l, attendance: l.attendance.map((r) => r.id === record.id ? { ...r, settled: false } : r), payments: linked ? l.payments.filter((p) => p.id !== linked.id) : l.payments })));
    if (linked) { await supabase.from('labour_payments').delete().eq('id', linked.id); }
    const { error } = await supabase.from('labour_attendance').update({ settled: false }).eq('labourer_id', record.labourer_id).eq('week_ending', record.week_ending);
    if (error) { void loadData(); setNotice('Could not open this week for changes'); return; }
    setNotice('Week opened for changes');
    void loadData();
  }
  async function markInvoicePaid(doc: Document, paid: boolean) {
    const grand = Number(doc.grand_total || 0);
    const payload = paid
      ? { status: 'Paid', amount_paid: grand, balance_due: 0 }
      : { status: 'Unpaid', amount_paid: 0, balance_due: grand };
    setInvoices((current) => current.map((row) => row.id === doc.id ? { ...row, ...payload } : row));
    if (preview) setPreview({ ...preview, document: { ...doc, ...payload } });
    const { error } = await supabase.from('invoices').update(payload).eq('id', doc.id);
    if (error) { void loadData(); setNotice('Unable to update invoice'); return; }
    setNotice(paid ? 'Invoice marked as paid' : 'Invoice marked as unpaid');
    void loadData();
  }
  async function recordPayment(doc: Document, amount: number) {
    const grand = Number(doc.grand_total || 0);
    const currentPaid = Number(doc.amount_paid || 0);
    const newPaid = currentPaid + amount;
    const newBalance = Math.max(0, grand - newPaid);
    const status = newBalance <= 0 ? 'Paid' : 'Partial';
    const payload = { amount_paid: newPaid, balance_due: newBalance, status };
    setInvoices((current) => current.map((row) => row.id === doc.id ? { ...row, ...payload } : row));
    if (preview) setPreview({ ...preview, document: { ...doc, ...payload } });
    const { error } = await supabase.from('invoices').update(payload).eq('id', doc.id);
    if (error) { void loadData(); setNotice('Unable to record payment'); return; }
    setNotice(`Payment of ${money(amount)} recorded`);
    void loadData();
  }

  function openCreateEstimate() { guardDocument(() => { setEditingEstimate(null); setModal('estimate'); }); }
  async function openEditEstimate(estimate: Estimate) {
    guardDocument(async () => {
      const { data, error } = await supabase.from('estimate_items').select('*').eq('estimate_id', estimate.id).order('created_at', { ascending: true });
      if (error) { setNotice('Unable to load this estimate for editing'); return; }
      setEditingEstimate({ estimate, items: data || [], customer: customers.find((row) => row.id === estimate.customer_id) || null });
      setModal('estimate');
    });
  }
  async function openPreviewEstimate(estimate: Estimate) {
    guardDocument(async () => {
      const { data, error } = await supabase.from('estimate_items').select('*').eq('estimate_id', estimate.id).order('created_at', { ascending: true });
      if (error) { setNotice('Unable to load this estimate'); return; }
      const customer = customers.find((row) => row.id === estimate.customer_id) || null;
      setEstimatePreview({ estimate, items: data || [], customer });
      setModal('estimatePreview');
    });
  }
  async function deleteEstimate(estimate: Estimate) {
    if (!window.confirm(`Delete ${estimate.estimate_number}?`)) return;
    setEstimates((current) => current.filter((e) => e.id !== estimate.id));
    await supabase.from('estimate_items').delete().eq('estimate_id', estimate.id);
    const { error } = await supabase.from('estimates').delete().eq('id', estimate.id);
    if (error) { void loadData(); setNotice('Unable to delete estimate'); return; }
    setNotice('Estimate deleted');
    void loadData();
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><img src="/new-logo.png" alt="Shri Venktesh Plumbing Contractor logo" /></div><div><strong>VENKTESH</strong><span>PLUMBING CONTRACTOR</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <div className="workspace"><span>WORKSPACE</span><button>Washim office <ChevronDown size={14} /></button></div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={view === label ? 'active' : ''} onClick={() => { setView(label); setMobileOpen(false); }}><Icon size={18} /><span>{label}</span>{label === 'Invoices' && invoices.filter((invoice) => invoice.status === 'Unpaid').length > 0 ? <em>{invoices.filter((invoice) => invoice.status === 'Unpaid').length}</em> : null}</button>)}</nav>
      <div className="sidebar-footer"><div className="avatar">HP</div><div><strong>Harish S. Phuse</strong><small>Proprietor</small></div>{isUnlocked && <button onClick={() => { void supabase.auth.signOut(); }} title="Lock invoices & quotations"><Lock size={17} /></button>}<button onClick={() => setView('Settings')}><Settings size={17} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(true)}><Menu size={22} /></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{view}</strong></div><div className="top-actions"><div className="search-global"><Search size={17} /><input placeholder="Search anything..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="round-button"><CalendarDays size={18} /></button><div className="profile-chip"><div className="avatar small">HP</div><span>Harish Phuse</span><ChevronDown size={14} /></div></div></header>
      {notice && <div className="toast">{notice}</div>}
      <div className="page-content">

        {view === 'Customers' && <section><PageHeading title="Customers" description="Keep your client and project information organized." action="Add customer" onAction={() => setModal('customer')} /><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search name, phone or project" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="table-card"><table><thead><tr><th>Customer</th><th>Project</th><th>Contact</th><th>Location</th><th>Added</th><th></th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr className="clickable-row" key={customer.id} onClick={() => { setSelectedCustomer(customer); setModal('customerProfile'); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedCustomer(customer); setModal('customerProfile'); } }} tabIndex={0}><td><div className="person-cell"><div className="person-avatar">{customer.name.slice(0, 2).toUpperCase()}</div><div><strong>{customer.name}</strong><small>{customer.email || 'No email added'}</small></div></div></td><td>{customer.project_name || '—'}</td><td>{customer.phone || '—'}</td><td>{[customer.city, customer.state].filter(Boolean).join(', ') || '—'}</td><td>{dateLabel(customer.created_at)}</td><td><button className="icon-button danger" onClick={(event) => { event.stopPropagation(); void deleteCustomer(customer); }}><Trash2 size={16} /></button></td></tr>)}</tbody></table>{filteredCustomers.length === 0 && <EmptyState title="No customers found" text="Add your first customer to start billing." />}</div></section>}
        {view === 'Quotations' && <DocumentList type="quotation" documents={quotations} query={query} setQuery={setQuery} onCreate={() => openCreate('quotation')} onView={openPreview} onEdit={openEdit} />}
        {view === 'Estimates' && <EstimateList estimates={estimates} query={query} setQuery={setQuery} onCreate={openCreateEstimate} onView={openPreviewEstimate} onEdit={openEditEstimate} onDelete={deleteEstimate} />}
        {view === 'Invoices' && <DocumentList type="invoice" documents={invoices} query={query} setQuery={setQuery} onCreate={() => openCreate('invoice')} onView={openPreview} onEdit={openEdit} />}
        {view === 'Labour' && <LabourView labourers={labourers} query={query} setQuery={setQuery} onAddLabourer={() => setModal('labourer')} onDeleteLabourer={deleteLabourer} onReload={loadData} onNotify={setNotice} unlockWeek={unlockWeek} onRecordPayment={recordLabourPayment} onMarkPaid={markLabourPaid} onDeletePayment={deletePayment} />}
        {view === 'Settings' && settings && <SettingsPage settings={settings} onSaved={() => { setNotice('Settings saved'); void loadData(); }} />}
      </div>
    </main>
    {modal === 'customer' && <Modal title="Add customer" onClose={() => setModal(null)}><CustomerForm onSubmit={saveCustomer} /></Modal>}
    {modal === 'customerProfile' && selectedCustomer && <Modal title="Customer profile" onClose={() => { setModal(null); setSelectedCustomer(null); }}><CustomerProfile customer={selectedCustomer} /></Modal>}
    {modal === 'labourer' && <Modal title="Add labourer" onClose={() => setModal(null)}><LabourerForm onSubmit={saveLabourer} /></Modal>}
    {modal === 'document' && <Modal wide title={editingDocument ? `Edit ${documentType === 'invoice' ? 'invoice' : 'quotation'}` : documentType === 'invoice' ? 'Create invoice' : 'Create quotation'} onClose={() => { setModal(null); setEditingDocument(null); }}><DocumentForm type={documentType} settings={settings} invoiceCount={invoices.length} quotationCount={quotations.length} editing={editingDocument} onNotify={setNotice} onSaved={() => { setModal(null); setEditingDocument(null); setNotice(`${documentType === 'invoice' ? 'Invoice' : 'Quotation'} ${editingDocument ? 'updated' : 'saved'}`); void loadData(); }} /></Modal>}
    {modal === 'preview' && preview && <Modal wide title={`${preview.type === 'invoice' ? 'Invoice' : 'Estimate'} preview`} onClose={() => setModal(null)}><DocumentPreview data={preview} settings={settings} onMarkPaid={preview.type === 'invoice' ? markInvoicePaid : undefined} onRecordPayment={preview.type === 'invoice' ? recordPayment : undefined} /></Modal>}
    {modal === 'estimate' && <Modal wide title={editingEstimate ? 'Edit estimate' : 'Create estimate'} onClose={() => { setModal(null); setEditingEstimate(null); }}><EstimateForm estimateCount={estimates.length} editing={editingEstimate} onNotify={setNotice} onSaved={() => { setModal(null); setEditingEstimate(null); setNotice(`Estimate ${editingEstimate ? 'updated' : 'saved'}`); void loadData(); }} /></Modal>}
    {modal === 'estimatePreview' && estimatePreview && <Modal wide title="Estimate preview" onClose={() => { setModal(null); setEstimatePreview(null); }}><EstimatePreview data={estimatePreview} settings={settings} /></Modal>}
    {showLock && <LockScreen email={LOCK_EMAIL} isUnlocked={isUnlocked} recoveryMode={recoveryMode} onUnlock={() => { const action = pendingActionRef.current; pendingActionRef.current = null; setShowLock(false); if (action) action(); }} onRecoveryDone={() => { recoveryFlowRef.current = false; setRecoveryMode(false); setShowLock(false); setNotice('Password updated — you are unlocked'); }} onCancel={() => { if (!recoveryMode) { pendingActionRef.current = null; setShowLock(false); setRecoveryMode(false); } }} />}
  </div>;
}

function LockScreen({ email, isUnlocked, recoveryMode, onUnlock, onRecoveryDone, onCancel }: { email: string; isUnlocked: boolean; recoveryMode: boolean; onUnlock: () => void; onRecoveryDone: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => { if (recoveryMode) { setMode('signin'); setError(''); setInfo(''); } }, [recoveryMode]);
  useEffect(() => { if (isUnlocked && !recoveryMode) { setMode('signin'); setPassword(''); setError(''); setInfo(''); } }, [isUnlocked, recoveryMode]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setInfo('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) { setError(err.message.includes('Invalid login') ? 'Wrong password. Try again or use "Forgot password" to reset.' : err.message); return; }
    setPassword(''); onUnlock();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setInfo('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); setBusy(false); return; }
    const { error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setInfo('Account created! You can now sign in with your password.');
    setPassword(''); setMode('signin');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setInfo('');
    const redirectTo = `${window.location.origin}${window.location.pathname}?reset=1`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo(`A reset link has been sent to ${email}. Check your inbox and spam folder.`);
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); setBusy(false); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); setBusy(false); return; }
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (err) { setError(err.message.includes('expired') || err.message.includes('invalid') ? 'This reset link has expired. Request a new link and open the newest email.' : err.message); return; }
    window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
    setNewPassword(''); setConfirmPassword(''); onRecoveryDone();
  }

  if (recoveryMode) {
    return <div className="modal-backdrop"><div className="lock-card"><div className="lock-icon"><Lock size={28} /></div><h2>Change password</h2><p className="lock-subtitle">Enter and confirm your new password for {email}</p><form className="lock-form" onSubmit={handleRecovery}><input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus /><input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password & unlock'}</button>{error && <p className="lock-error">{error}</p>}</form></div></div>;
  }

  return <div className="modal-backdrop"><div className="lock-card"><div className="lock-icon"><Lock size={28} /></div><h2>{mode === 'signup' ? 'Create password' : mode === 'forgot' ? 'Reset password' : 'Enter password'}</h2><p className="lock-subtitle">{mode === 'signup' ? 'Set a password to protect your invoices and quotations.' : mode === 'forgot' ? `We'll send a reset link to ${email}` : 'Enter your password to view or edit'}</p>
    {mode === 'signin' && <form className="lock-form" onSubmit={handleSignIn}><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Unlock'}</button>{error && <p className="lock-error">{error}</p>}<div className="lock-links"><button type="button" className="text-button" onClick={() => { setMode('signup'); setError(''); setInfo(''); }}>Create password</button><button type="button" className="text-button" onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}>Forgot password?</button></div></form>}
    {mode === 'signup' && <form className="lock-form" onSubmit={handleSignUp}><input type="password" placeholder="Choose a password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create password'}</button>{error && <p className="lock-error">{error}</p>}{info && <p className="lock-info">{info}</p>}<div className="lock-links"><button type="button" className="text-button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }}>Back to sign in</button></div></form>}
    {mode === 'forgot' && <form className="lock-form" onSubmit={handleForgot}><p className="lock-info">{info}</p><button className="button primary lock-submit" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>{error && <p className="lock-error">{error}</p>}<div className="lock-links"><button type="button" className="text-button" onClick={() => { setMode('signin'); setError(''); setInfo(''); }}>Back to sign in</button></div></form>}
    <button className="text-button lock-cancel" onClick={onCancel}>Cancel</button>
  </div></div>;
}

function Dashboard({ invoices, quotations, totals, onCreate, onNavigate }: { invoices: Document[]; quotations: Document[]; totals: { invoiceAmount: number; quotationAmount: number; paid: number; pending: number }; onCreate: (type: 'invoice' | 'quotation') => void; onNavigate: (view: View) => void }) { return <section><div className="welcome"><div><p className="eyebrow">TODAY</p><h1>Welcome back, Harish.</h1><p className="muted">Here's what's happening with your business.</p></div><div className="welcome-actions"><button className="button secondary" onClick={() => onCreate('quotation')}><Plus size={17} /> New quotation</button><button className="button primary" onClick={() => onCreate('invoice')}><Plus size={17} /> New invoice</button></div></div><div className="metric-grid"><Metric label="Total billing" value={money(totals.invoiceAmount)} change={`${invoices.length} invoices`} icon={ReceiptIndianRupee} tone="blue" /><Metric label="Outstanding" value={money(totals.pending)} change="Needs attention" icon={CircleDollarSign} tone="amber" /><Metric label="Collected" value={money(totals.paid)} change="Paid to date" icon={FileText} tone="green" /><Metric label="Quotation value" value={money(totals.quotationAmount)} change={`${quotations.length} quotations`} icon={FileText} tone="slate" /></div><div className="dashboard-grid"><div className="chart-card"><div className="card-heading"><div><h3>Billing overview</h3><p>Invoice and quotation value over the last 6 months</p></div><button className="filter-button">Last 6 months <ChevronDown size={14} /></button></div><div className="chart"><div className="y-axis"><span>₹2L</span><span>₹1.5L</span><span>₹1L</span><span>₹50K</span><span>₹0</span></div><div className="bars">{['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((month, index) => <div className="bar-group" key={month}><div className="bar invoice" style={{ height: `${[38, 52, 45, 68, 58, 78][index]}%` }} /><div className="bar quote" style={{ height: `${[25, 38, 30, 46, 40, 55][index]}%` }} /><span>{month}</span></div>)}</div></div><div className="legend"><span><i className="dot blue" /> Invoices</span><span><i className="dot teal" /> Quotations</span></div></div><div className="side-card"><div className="card-heading"><div><h3>Recent activity</h3><p>Your latest documents</p></div><button className="text-button" onClick={() => onNavigate('Invoices')}>View all</button></div><div className="activity-list">{[...invoices.slice(0, 3), ...quotations.slice(0, 2)].slice(0, 4).map((doc) => <div className="activity-row" key={doc.id}><div className="activity-icon"><FileText size={16} /></div><div><strong>{doc.invoice_number || doc.quotation_number}</strong><small>{doc.customers?.name || 'Walk-in customer'} · {dateLabel(doc.invoice_date || doc.quotation_date)}</small></div><b>{money(doc.grand_total)}</b></div>)}{invoices.length + quotations.length === 0 && <EmptyState title="No activity yet" text="Your saved documents will appear here." />}</div></div></div><div className="quick-section"><div className="card-heading"><div><h3>Quick actions</h3><p>Common tasks for your workday</p></div></div><div className="quick-grid"><button onClick={() => onCreate('invoice')}><ReceiptIndianRupee size={20} /><span><strong>Create invoice</strong><small>Bill a completed job</small></span><Plus size={16} /></button><button onClick={() => onCreate('quotation')}><FileText size={20} /><span><strong>Create quotation</strong><small>Send a new estimate</small></span><Plus size={16} /></button><button onClick={() => onNavigate('Customers')}><Users size={20} /><span><strong>Add customer</strong><small>Save client details</small></span><Plus size={16} /></button></div></div></section> }
function Metric({ label, value, change, icon: Icon, tone }: { label: string; value: string; change: string; icon: typeof FileText; tone: string }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><span>{label}</span><strong>{value}</strong><small>{change}</small></div> }
function PageHeading({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) { return <div className="page-heading"><div><p className="eyebrow">MANAGE</p><h1>{title}</h1><p className="muted">{description}</p></div><button className="button primary" onClick={onAction}><Plus size={17} /> {action}</button></div> }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><BookOpen size={25} /><strong>{title}</strong><span>{text}</span></div> }
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="modal-backdrop"><div className={`modal ${wide ? 'wide' : ''}`}><div className="modal-header"><h2>{title}</h2><button onClick={onClose}><X size={19} /></button></div>{children}</div></div> }
function CustomerProfile({ customer }: { customer: Customer }) { return <div className="customer-profile"><div className="profile-hero"><div className="person-avatar large">{customer.name.slice(0, 2).toUpperCase()}</div><div><h3>{customer.name}</h3><p>{customer.project_name || 'Customer'}</p></div></div><div className="profile-details customer-details"><div><span>Phone</span><strong>{customer.phone || 'Not added'}</strong></div><div><span>Email</span><strong>{customer.email || 'Not added'}</strong></div><div><span>Location</span><strong>{[customer.city, customer.state].filter(Boolean).join(', ') || 'Not added'}</strong></div><div><span>PIN code</span><strong>{customer.pincode || 'Not added'}</strong></div></div><div className="customer-profile-section"><span>Address</span><p>{customer.address || 'No address added.'}</p></div>{customer.gst_number && <div className="customer-profile-section"><span>GST number</span><p>{customer.gst_number}</p></div>}{customer.notes && <div className="customer-profile-section"><span>Notes</span><p>{customer.notes}</p></div>}</div>; }

function CustomerForm({ onSubmit }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { return <form className="form-grid" onSubmit={onSubmit}><label>Customer name *<input name="name" required placeholder="e.g. Anil Kad" /></label><label>Project / property<input name="project_name" placeholder="e.g. Kad residence" /></label><label className="full">Address<input name="address" placeholder="Street and building details" /></label><label>City<input name="city" placeholder="Washim" /></label><label>State<input name="state" placeholder="Maharashtra" /></label><label>PIN code<input name="pincode" inputMode="numeric" /></label><label>Mobile number<input name="phone" inputMode="tel" /></label><label>Email<input name="email" type="email" /></label><label>GST number<input name="gst_number" /></label><label className="full">Notes<textarea name="notes" rows={3} /></label><div className="form-actions full"><button type="submit" className="button primary">Save customer</button></div></form> }
function DocumentList({ type, documents, query, setQuery, onCreate, onView, onEdit }: { type: 'invoice' | 'quotation'; documents: Document[]; query: string; setQuery: (value: string) => void; onCreate: () => void; onView: (type: 'invoice' | 'quotation', document: Document) => void; onEdit: (type: 'invoice' | 'quotation', document: Document) => void }) { const filtered = documents.filter((row) => `${row.invoice_number || row.quotation_number} ${row.customers?.name || ''} ${row.status}`.toLowerCase().includes(query.toLowerCase())); return <section><PageHeading title={type === 'invoice' ? 'Invoices' : 'Quotations'} description={type === 'invoice' ? 'Create, track and collect payment for every job.' : 'Prepare clear estimates and win more work.'} action={type === 'invoice' ? 'Create invoice' : 'Create quotation'} onAction={onCreate} /><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder={`Search ${type}s`} value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="table-card"><table><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((row) => <tr className="clickable-row" key={row.id} onClick={() => void onView(type, row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void onView(type, row); } }} tabIndex={0}><td><button className="document-link" onClick={(event) => { event.stopPropagation(); void onView(type, row); }}>{row.invoice_number || row.quotation_number}</button><small className="table-subtext">{row.customers?.project_name || 'No project'}</small></td><td>{row.customers?.name || 'No customer'}</td><td>{dateLabel(row.invoice_date || row.quotation_date)}</td><td><span className={`status ${row.status.toLowerCase().replace(' ', '-')}`}>{row.status}</span></td><td><div className="row-actions"><button className="text-button" onClick={(event) => { event.stopPropagation(); void onEdit(type, row); }}>Edit</button><button className="text-button" onClick={(event) => { event.stopPropagation(); void onView(type, row); }}>View</button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState title={`No ${type}s yet`} text={`Create your first ${type} to see it here.`} />}</div></section> }
function SettingsPage({ settings, onSaved }: { settings: SettingsData; onSaved: () => void }) { const [form, setForm] = useState(settings); useEffect(() => setForm(settings), [settings]); async function save(event: React.FormEvent) { event.preventDefault(); const { error } = await supabase.from('company_settings').update(form).eq('id', form.id); if (!error) onSaved(); } return <section><div className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Settings</h1><p className="muted">Keep your company identity and billing preferences current.</p></div></div><form className="settings-form" onSubmit={save}><div className="settings-card"><div className="card-heading"><div><h3>Company details</h3><p>Shown on your invoices and quotations.</p></div></div><div className="form-grid"><label>Company name<input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></label><label>Proprietor name<input value={form.proprietor_name} onChange={(e) => setForm({ ...form, proprietor_name: e.target.value })} /></label><label className="full">Business address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div></div><div className="settings-card"><div className="card-heading"><div><h3>Document preferences</h3><p>Choose how new documents are numbered.</p></div></div><div className="form-grid"><label>Invoice prefix<input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} /></label><label>Quotation prefix<input value={form.quotation_prefix} onChange={(e) => setForm({ ...form, quotation_prefix: e.target.value })} /></label><label>Default tax (%)<input type="number" onFocus={selectZeroOnFocus} value={form.default_tax} onChange={(e) => setForm({ ...form, default_tax: Number(e.target.value) })} /></label><label>Currency<input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label><label className="full">Invoice footer<textarea rows={3} value={form.default_footer} onChange={(e) => setForm({ ...form, default_footer: e.target.value })} /></label><label className="full">Trust text<input value={form.trust_text} onChange={(e) => setForm({ ...form, trust_text: e.target.value })} /></label></div></div><button className="button primary" type="submit">Save settings</button></form></section> }
function DocumentPreview({ data, settings, onMarkPaid, onRecordPayment }: { data: PreviewData; settings: SettingsData | null; onMarkPaid?: (doc: Document, paid: boolean) => void; onRecordPayment?: (doc: Document, amount: number) => void }) {
  const { type, document: doc, lines, customer } = data;
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const number = doc.invoice_number || doc.quotation_number || '';
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
  const grand = Number(doc.grand_total || 0);
  const tax = Math.max(0, grand - subtotal + Number(doc.discount || 0));
  const balance = type === 'invoice' ? Number(doc.balance_due || 0) : 0;
  const isPaid = type === 'invoice' && doc.status === 'Paid';
  const isPartial = type === 'invoice' && doc.status === 'Partial';
  const name = customer?.name || doc.customers?.name || 'Walk-in customer';
  const project = customer?.project_name || doc.customers?.project_name || null;
  const address = customer?.address || doc.customers?.address || null;
  const phone = customer?.phone || doc.customers?.phone || null;
  const gst = customer?.gst_number || doc.customers?.gst_number || null;
  function submitPayment(e: React.FormEvent) { e.preventDefault(); if (paymentAmount > 0 && onRecordPayment) { onRecordPayment(doc, paymentAmount); setShowPayment(false); setPaymentAmount(0); } }
  return <div className="preview-shell"><div className="preview-actions">{onMarkPaid && (isPaid ? <button className="button secondary" onClick={() => onMarkPaid(doc, false)}><X size={16} /> Mark unpaid</button> : <button className="button success" onClick={() => onMarkPaid(doc, true)}><Check size={16} /> Mark as paid</button>)}{onRecordPayment && !isPaid && <button className="button secondary" onClick={() => setShowPayment(!showPayment)}><CircleDollarSign size={16} /> Record payment</button>}<button className="button secondary" onClick={() => window.print()}><Printer size={16} /> Print</button></div>{showPayment && <form className="payment-inline-form" onSubmit={submitPayment}><label>Payment amount<input type="number" onFocus={selectZeroOnFocus} min="1" max={balance} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} required autoFocus /></label><button type="submit" className="button primary">Add payment</button><button type="button" className="button secondary" onClick={() => { setShowPayment(false); setPaymentAmount(0); }}>Cancel</button><small>Balance due: {money(balance)}</small></form>}
    <div
  className={`a4-sheet ${type === 'quotation' ? 'quotation-sheet' : ''}`}
  id="document-print"
>
      {isPaid && <div className="paid-stamp">PAID</div>}
      <header className="doc-header"><div className="doc-company"><img src="/new-logo.png" alt="Shri Venkatesh Plumbing Work Washim logo" /><div><h1>SHRI VENKATESH PLUMBING WORK WASHIM</h1><p>PRO. {settings?.proprietor_name || 'HARISH S PHUSE'}</p><p>WASHIM MAHARASHTRA 444505</p><p>MOB. 9623199934 / 8329847776</p></div></div><div className="doc-type-badge"><strong>{type === 'invoice' ? 'INVOICE' : 'ESTIMATE'}</strong><span>{number}</span>{isPaid && <em className="paid-tag">PAID</em>}{isPartial && <em className="partial-tag">PARTIAL</em>}</div></header>
      <section className="doc-meta"><div><span className="doc-label">{type === 'invoice' ? 'Invoice date' : 'Estimate date'}</span><strong>{dateLabel(doc.invoice_date || doc.quotation_date)}</strong></div>{type === 'invoice' && <div><span className="doc-label">Due date</span><strong>{dateLabel(doc.due_date)}</strong></div>}{type === 'quotation' && <div><span className="doc-label">Valid until</span><strong>{dateLabel(doc.valid_until)}</strong></div>}<div><span className="doc-label">Status</span><span className={`status ${doc.status.toLowerCase().replace(' ', '-')}`}>{doc.status}</span></div></section>
      <section className="doc-party"><div><span className="doc-label">Billed to</span><strong>{name}</strong>{project && <p>{project}</p>}{address && <p>{address}</p>}{phone && <p>Ph: {phone}</p>}{gst && <p>GST: {gst}</p>}</div></section>
      <table className={`doc-table ${type === 'quotation' ? 'doc-table-quote' : ''}`}><thead><tr><th className="sr">SR.</th><th className="desc">DESCRIPTION</th><th className="unit">UNIT</th>{type === 'invoice' && <th className="qty">QTY</th>}<th className="rate">RATE</th>{type === 'invoice' && <th className="amt">AMOUNT</th>}</tr></thead><tbody>{lines.map((line, index) => <tr key={index}><td className="sr">{index + 1}</td><td className="desc">{line.description}</td><td className="unit">{line.unit}</td>{type === 'invoice' && <td className="qty">{line.quantity}</td>}<td className="rate">{money(line.rate)}</td>{type === 'invoice' && <td className="amt">{money(line.quantity * line.rate)}</td>}</tr>)}</tbody></table>
      {type === 'invoice' && <section className="doc-totals"><div className="totals-rows"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Discount</span><b>{money(Number(doc.discount || 0))}</b></div><div><span>Tax ({settings?.default_tax || 0}%)</span><b>{money(tax)}</b></div><div className="grand-row"><span>Grand total</span><strong>{money(grand)}</strong></div><div><span>Amount paid</span><b>{money(Number(doc.amount_paid || 0))}</b></div><div className="balance-row"><span>Balance due</span><strong>{money(balance)}</strong></div></div></section>}
      {doc.notes && <section className="doc-notes"><span className="doc-label">Notes & terms</span><p>{doc.notes}</p></section>}
      {type === 'quotation' && <section className="doc-quote-note"><p>Note:</p><p>1. The rate allow by next 24 month.</p><p>2. Weekly provision provided by owner for labor and other expenses.</p><p>3. Electrical provision by owner.</p></section>}
      {type === 'invoice' && <footer className="doc-footer"><p>{settings?.default_footer || 'Thank you for choosing us.'}</p><small>{settings?.trust_text || '30 years of plumbing trust'}</small></footer>}
    </div></div>;
}
const attendanceDays = [
  ['day_mon', 'Mon'], ['day_tue', 'Tue'], ['day_wed', 'Wed'], ['day_thu', 'Thu'], ['day_fri', 'Fri'], ['day_sat', 'Sat'], ['day_sun', 'Sun'],
] as const;
type AttendanceDayKey = typeof attendanceDays[number][0];
const dayShortKey: Record<AttendanceDayKey, string> = { day_mon: 'mon', day_tue: 'tue', day_wed: 'wed', day_thu: 'thu', day_fri: 'fri', day_sat: 'sat', day_sun: 'sun' };
function dayIncentiveKey(day: AttendanceDayKey) { return `incentive_${dayShortKey[day]}` as keyof AttendanceRecord; }
function daySiteKey(day: AttendanceDayKey) { return `site_${dayShortKey[day]}` as keyof AttendanceRecord; }
function dayIncentiveOf(record: AttendanceRecord | undefined, day: AttendanceDayKey) { return Number((record as Record<string, unknown> | undefined)?.[dayIncentiveKey(day)] ?? 0) || 0; }
function daySiteOf(record: AttendanceRecord | undefined, day: AttendanceDayKey) { return ((record as Record<string, unknown> | undefined)?.[daySiteKey(day)] as string | null) || ''; }
function computeAmount(labourer: LabourerWithPayments, record: AttendanceRecord | undefined) {
  const present = attendanceDays.filter(([key]) => record?.[key] ?? true).length;
  const perDayIncentive = attendanceDays.reduce((sum, [key]) => {
    const isPresent = record?.[key] ?? true;
    return isPresent ? sum + dayIncentiveOf(record, key) : sum;
  }, 0);
  return present * Number(labourer.daily_wage || 0) + perDayIncentive;
}

function pendingAdvances(labourer: LabourerWithPayments) {
  return [...labourer.advances]
    .filter((a) => Number(a.amount_remaining || 0) > 0)
    .sort((a, b) => (a.given_date < b.given_date ? -1 : 1));
}

function computeWeekPayable(labourer: LabourerWithPayments, earned: number) {
  const pending = pendingAdvances(labourer);
  let toRecover = 0;
  const plan: { advance: LabourAdvance; take: number }[] = [];
  for (const advance of pending) {
    if (earned - toRecover <= 0) break;
    const remaining = Number(advance.amount_remaining || 0);
    const take = Math.min(remaining, earned - toRecover);
    if (take > 0) { toRecover += take; plan.push({ advance, take }); }
  }
  const netPayable = Math.max(earned - toRecover, 0);
  const carryForward = Math.max(toRecover - earned, 0);
  return { earned, toRecover, netPayable, carryForward, plan };
}

async function reduceAdvances(plan: { advance: LabourAdvance; take: number }[]) {
  for (const { advance, take } of plan) {
    const newRemaining = Math.max(0, Number(advance.amount_remaining || 0) - take);
    await supabase.from('labour_advances').update({ amount_remaining: newRemaining }).eq('id', advance.id);
  }
}

function upcomingSunday(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7));
  return date.toISOString().slice(0, 10);
}
function weekRangeLabel(weekEnding: string) {
  const end = new Date(`${weekEnding}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function workerStats(labourer: LabourerWithPayments) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  let yearDays = 0, monthDays = 0, yearWage = 0, monthWage = 0;
  for (const att of labourer.attendance) {
    const presentKeys = attendanceDays.filter(([key]) => att[key]);
    const totalDays = presentKeys.length;
    if (totalDays === 0) continue;
    const perDayWage = Number(att.amount || 0) / totalDays;
    const weekEnd = new Date(`${att.week_ending}T12:00:00`);
    presentKeys.forEach(([key], idx) => {
      const dayDate = new Date(weekEnd);
      dayDate.setDate(weekEnd.getDate() - (6 - idx));
      if (dayDate.getFullYear() === curYear) { yearDays += 1; yearWage += perDayWage; }
      if (dayDate.getFullYear() === curYear && dayDate.getMonth() === curMonth) { monthDays += 1; monthWage += perDayWage; }
    });
  }
  const paidTotal = labourer.payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const unpaidTotal = labourer.payments.reduce((sum, p) => sum + Number(p.balance || 0), 0);
  return { yearDays, monthDays, yearWage, monthWage, paidTotal, unpaidTotal };
}

function downloadWeekExcel(labourer: LabourerWithPayments, weekEnding: string) {
  const att = labourer.attendance.find((r) => r.week_ending === weekEnding);
  if (!att) return;
  const wb = XLSX.utils.book_new();

  const presentKeys = attendanceDays.filter(([key]) => att[key]);
  const daysPresent = presentKeys.length;
  const totalIncentive = presentKeys.reduce((sum, [key]) => sum + dayIncentiveOf(att, key), 0);
  const earned = Number(att.amount || 0);
  const payment = labourer.payments.find((p) => p.week_ending === weekEnding);
  const status = payment?.payment_status || 'Unpaid';
  const paid = payment ? Number(payment.amount_paid || 0) : 0;
  const bal = payment ? Number(payment.balance || 0) : earned;
  const weekPlan = computeWeekPayable(labourer, earned);
  const stats = workerStats(labourer);
  const allAdvances = [...labourer.advances].sort((a, b) => (a.given_date < b.given_date ? -1 : 1));
  const pendingAdvanceTotal = allAdvances.reduce((sum, a) => sum + Number(a.amount_remaining || 0), 0);

  const aoa: (string | number)[][] = [];
  aoa.push([`${labourer.name} — Week Report`]);
  aoa.push([`Role: ${labourer.role || 'Worker'}`, `Daily Wage: ${money(Number(labourer.daily_wage || 0))}`, `Phone: ${labourer.phone || '—'}`]);
  aoa.push([`Week: ${weekRangeLabel(weekEnding)}`]);
  aoa.push([]);

  aoa.push(['ATTENDANCE']);
  aoa.push(['Day', 'Present?', 'Incentive', 'Site Location']);
  for (const [key, label] of attendanceDays) {
    const isPresent = att[key];
    const inc = dayIncentiveOf(att, key);
    const site = daySiteOf(att, key);
    aoa.push([label, isPresent ? 'Present' : 'Absent', isPresent ? inc : '', isPresent ? (site || '') : '']);
  }
  aoa.push([]);

  aoa.push(['EARNINGS']);
  aoa.push(['Days Present', daysPresent]);
  aoa.push(['Daily Wage', Number(labourer.daily_wage || 0)]);
  aoa.push(['Total Incentives', totalIncentive]);
  aoa.push(['Gross Earned', earned]);
  aoa.push([]);

  aoa.push(['ADVANCE RECOVERY (this week)']);
  if (weekPlan.toRecover > 0) {
    aoa.push(['Advance Recovered', weekPlan.toRecover]);
    for (const { advance, take } of weekPlan.plan) {
      aoa.push([`  From advance ${dateLabel(advance.given_date)} (${money(advance.amount)})`, take]);
    }
  } else {
    aoa.push(['Advance Recovered', 0]);
  }
  aoa.push(['Net Payable (after advance deduction)', weekPlan.netPayable]);
  aoa.push([]);

  aoa.push(['PAYMENT']);
  aoa.push(['Payment Status', status]);
  aoa.push(['Amount Paid', paid]);
  aoa.push(['Balance Due', bal]);
  if (payment?.notes) aoa.push(['Notes', payment.notes]);
  aoa.push([]);

  if (allAdvances.length > 0) {
    aoa.push(['ALL CASH ADVANCES']);
    aoa.push(['Date Given', 'Amount', 'Recovered', 'Pending', 'Note']);
    for (const adv of allAdvances) {
      const recovered = Number(adv.amount) - Number(adv.amount_remaining);
      aoa.push([dateLabel(adv.given_date), Number(adv.amount), recovered, Number(adv.amount_remaining), adv.note || '']);
    }
    aoa.push(['Total Pending Advances', pendingAdvanceTotal]);
    aoa.push([]);
  }

  aoa.push(['WORKER SUMMARY']);
  aoa.push(['Days worked this year', stats.yearDays]);
  aoa.push(['Days worked this month', stats.monthDays]);
  aoa.push(['Total paid (all weeks)', stats.paidTotal]);
  aoa.push(['Total unpaid (all weeks)', stats.unpaidTotal]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Week Report');

  const end = new Date(`${weekEnding}T12:00:00`);
  const start = new Date(end); start.setDate(start.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${labourer.name.replace(/[^a-zA-Z0-9]/g, '_')}_${fmt(start)}_${fmt(end)}.xlsx`);
}

function LabourView({ labourers, query, setQuery, onAddLabourer, onDeleteLabourer, onReload, onNotify, unlockWeek, onRecordPayment, onMarkPaid, onDeletePayment }: { labourers: LabourerWithPayments[]; query: string; setQuery: (value: string) => void; onAddLabourer: () => void; onDeleteLabourer: (labourer: Labourer) => void; onReload: () => void; onNotify: (msg: string) => void; unlockWeek: (record: AttendanceRecord) => void; onRecordPayment: (payment: LabourPayment, amount: number) => void; onMarkPaid: (payment: LabourPayment) => void; onDeletePayment: (payment: LabourPayment) => void }) {
  const [weekEnding, setWeekEnding] = useState(upcomingSunday(today));
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, AttendanceRecord>>({});
  const filtered = labourers.filter((row) => `${row.name} ${row.role || ''} ${row.phone || ''}`.toLowerCase().includes(query.toLowerCase()));
  const attendanceKey = (labourerId: string, ending: string) => `${labourerId}:${ending}`;
  const currentAttendance = (labourer: LabourerWithPayments) => attendanceOverrides[attendanceKey(labourer.id, weekEnding)] || labourer.attendance.find((r) => r.week_ending === weekEnding);
  const allPayments = labourers.flatMap((l) => l.payments);
  const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const totalUnpaid = allPayments.reduce((sum, p) => sum + Number(p.balance || 0), 0);
  const totalWages = allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const fullPaidCount = allPayments.filter((p) => p.payment_status === 'Paid').length;
  const partialCount = allPayments.filter((p) => p.payment_status === 'Partial').length;
  const unpaidCount = allPayments.filter((p) => p.payment_status === 'Unpaid').length;
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  let monthDaysAll = 0;
  for (const l of labourers) { monthDaysAll += workerStats(l).monthDays; }

  async function toggleDay(labourer: LabourerWithPayments, day: AttendanceDayKey) {
    const record = currentAttendance(labourer);
    if (record?.settled) { onNotify('This week is already saved. Open it from past weeks to make changes.'); return; }
    const days: Record<AttendanceDayKey, boolean> = { day_mon: false, day_tue: false, day_wed: false, day_thu: false, day_fri: false, day_sat: false, day_sun: false };
    attendanceDays.forEach(([key]) => { (days as Record<string, boolean>)[key] = record?.[key] ?? true; });
    days[day] = !days[day];
    const baseRecord: AttendanceRecord = {
      id: record?.id || `optimistic-${labourer.id}-${weekEnding}`, labourer_id: labourer.id, week_ending: weekEnding,
      ...days, incentive: Number(record?.incentive ?? labourer.weekly_incentive ?? 0), amount: 0, settled: record?.settled || false, notes: record?.notes || null,
      incentive_mon: Number(record?.incentive_mon ?? 0), incentive_tue: Number(record?.incentive_tue ?? 0), incentive_wed: Number(record?.incentive_wed ?? 0), incentive_thu: Number(record?.incentive_thu ?? 0), incentive_fri: Number(record?.incentive_fri ?? 0), incentive_sat: Number(record?.incentive_sat ?? 0), incentive_sun: Number(record?.incentive_sun ?? 0),
      site_mon: record?.site_mon ?? null, site_tue: record?.site_tue ?? null, site_wed: record?.site_wed ?? null, site_thu: record?.site_thu ?? null, site_fri: record?.site_fri ?? null, site_sat: record?.site_sat ?? null, site_sun: record?.site_sun ?? null,
    };
    baseRecord.amount = computeAmount(labourer, baseRecord);
    const key = attendanceKey(labourer.id, weekEnding);
    setAttendanceOverrides((current) => ({ ...current, [key]: baseRecord }));
    const { error } = await supabase.from('labour_attendance').upsert({
      labourer_id: labourer.id, week_ending: weekEnding, ...days,
      incentive: baseRecord.incentive, amount: baseRecord.amount, settled: baseRecord.settled,
      incentive_mon: baseRecord.incentive_mon, incentive_tue: baseRecord.incentive_tue, incentive_wed: baseRecord.incentive_wed, incentive_thu: baseRecord.incentive_thu, incentive_fri: baseRecord.incentive_fri, incentive_sat: baseRecord.incentive_sat, incentive_sun: baseRecord.incentive_sun,
      site_mon: baseRecord.site_mon, site_tue: baseRecord.site_tue, site_wed: baseRecord.site_wed, site_thu: baseRecord.site_thu, site_fri: baseRecord.site_fri, site_sat: baseRecord.site_sat, site_sun: baseRecord.site_sun,
    }, { onConflict: 'labourer_id,week_ending' });
    if (error) { setAttendanceOverrides((current) => { const next = { ...current }; delete next[key]; return next; }); onNotify('Unable to update attendance'); return; }
    void onReload();
  }

  async function updateDayDetail(labourer: LabourerWithPayments, day: AttendanceDayKey, field: 'incentive' | 'site', value: number | string) {
    const record = currentAttendance(labourer);
    if (record?.settled) { onNotify('This week is already saved'); return; }
    const iKey = dayIncentiveKey(day);
    const sKey = daySiteKey(day);
    const updated: AttendanceRecord = { ...(record || { id: `optimistic-${labourer.id}-${weekEnding}`, labourer_id: labourer.id, week_ending: weekEnding, day_mon: true, day_tue: true, day_wed: true, day_thu: true, day_fri: true, day_sat: true, day_sun: true, incentive: Number(labourer.weekly_incentive ?? 0), amount: 0, settled: false, notes: null, incentive_mon: 0, incentive_tue: 0, incentive_wed: 0, incentive_thu: 0, incentive_fri: 0, incentive_sat: 0, incentive_sun: 0, site_mon: null, site_tue: null, site_wed: null, site_thu: null, site_fri: null, site_sat: null, site_sun: null }) };
    if (field === 'incentive') { (updated as Record<string, unknown>)[iKey] = value; } else { (updated as Record<string, unknown>)[sKey] = value || null; }
    updated.amount = computeAmount(labourer, updated);
    const key = attendanceKey(labourer.id, weekEnding);
    setAttendanceOverrides((current) => ({ ...current, [key]: updated }));
    const payload: Record<string, unknown> = { labourer_id: labourer.id, week_ending: weekEnding, amount: updated.amount, day_mon: updated.day_mon, day_tue: updated.day_tue, day_wed: updated.day_wed, day_thu: updated.day_thu, day_fri: updated.day_fri, day_sat: updated.day_sat, day_sun: updated.day_sun, incentive: updated.incentive, incentive_mon: updated.incentive_mon, incentive_tue: updated.incentive_tue, incentive_wed: updated.incentive_wed, incentive_thu: updated.incentive_thu, incentive_fri: updated.incentive_fri, incentive_sat: updated.incentive_sat, incentive_sun: updated.incentive_sun, site_mon: updated.site_mon, site_tue: updated.site_tue, site_wed: updated.site_wed, site_thu: updated.site_thu, site_fri: updated.site_fri, site_sat: updated.site_sat, site_sun: updated.site_sun };
    payload[iKey] = field === 'incentive' ? value : dayIncentiveOf(updated, day);
    payload[sKey] = field === 'site' ? (value || null) : (daySiteOf(updated, day) || null);
    const { error } = await supabase.from('labour_attendance').upsert(payload, { onConflict: 'labourer_id,week_ending' });
    if (error) { setAttendanceOverrides((current) => { const next = { ...current }; delete next[key]; return next; }); onNotify('Unable to update day details'); return; }
  }

  async function settleWeek(labourer: LabourerWithPayments, markPaid: boolean) {
    let record = currentAttendance(labourer);
    if (record?.settled) return;
    if (!record) {
      const days: Record<AttendanceDayKey, boolean> = { day_mon: true, day_tue: true, day_wed: true, day_thu: true, day_fri: true, day_sat: true, day_sun: true };
      record = {
        id: `optimistic-${labourer.id}-${weekEnding}`, labourer_id: labourer.id, week_ending: weekEnding,
        ...days, incentive: Number(labourer.weekly_incentive ?? 0), amount: computeAmount(labourer, undefined), settled: false, notes: null,
        incentive_mon: 0, incentive_tue: 0, incentive_wed: 0, incentive_thu: 0, incentive_fri: 0, incentive_sat: 0, incentive_sun: 0,
        site_mon: null, site_tue: null, site_wed: null, site_thu: null, site_fri: null, site_sat: null, site_sun: null,
      };
      const key = attendanceKey(labourer.id, weekEnding);
      setAttendanceOverrides((current) => ({ ...current, [key]: record }));
      const { error: attError } = await supabase.from('labour_attendance').upsert({
        labourer_id: labourer.id, week_ending: weekEnding, ...days,
        incentive: record.incentive, amount: record.amount, settled: false,
        incentive_mon: 0, incentive_tue: 0, incentive_wed: 0, incentive_thu: 0, incentive_fri: 0, incentive_sat: 0, incentive_sun: 0,
        site_mon: null, site_tue: null, site_wed: null, site_thu: null, site_fri: null, site_sat: null, site_sun: null,
      }, { onConflict: 'labourer_id,week_ending' });
      if (attError) { setAttendanceOverrides((current) => { const next = { ...current }; delete next[key]; return next; }); onNotify('Unable to save attendance'); return; }
    }
    const presentCount = attendanceDays.filter(([key]) => record![key]).length;
    if (presentCount === 0) { onNotify('Mark at least one day as came first'); return; }
    const daySummary = attendanceDays.filter(([key]) => record[key]).map(([key, label]) => { const inc = dayIncentiveOf(record, key); const site = daySiteOf(record, key); return `${label}${inc > 0 ? ` +${money(inc)}` : ''}${site ? ` @ ${site}` : ''}`; }).join(', ');
    const key = attendanceKey(labourer.id, weekEnding);
    setAttendanceOverrides((current) => ({ ...current, [key]: { ...record, settled: true } }));
    let payAmount = Number(record.amount || 0);
    let payBalance = 0;
    let payStatus = markPaid ? 'Paid' : 'Unpaid';
    let payNotes = `Attendance: ${daySummary}`;
    if (markPaid) {
      const plan = computeWeekPayable(labourer, Number(record.amount || 0));
      payAmount = plan.netPayable;
      payBalance = 0;
      payNotes = `Attendance: ${daySummary}${plan.toRecover > 0 ? ` · Advance recovered ${money(plan.toRecover)}` : ''}`;
      await reduceAdvances(plan.plan);
    } else {
      payBalance = Number(record.amount || 0);
    }
    const { error: payError } = await supabase.from('labour_payments').insert({ labourer_id: labourer.id, week_ending: weekEnding, amount: payAmount, paid: markPaid, amount_paid: markPaid ? payAmount : 0, balance: payBalance, payment_status: payStatus, notes: payNotes });
    if (payError) { setAttendanceOverrides((current) => ({ ...current, [key]: { ...record, settled: false } })); onNotify('Unable to save payment'); return; }
    const { error } = await supabase.from('labour_attendance').update({ settled: true }).eq('labourer_id', labourer.id).eq('week_ending', weekEnding);
    if (error) { setAttendanceOverrides((current) => ({ ...current, [key]: { ...record, settled: false } })); onNotify('Payment created but week could not be locked'); return; }
    onNotify(markPaid ? `Paid ${money(payAmount)} to ${labourer.name}` : 'Week saved — pay later from past weeks');
    void onReload();
  }

  const detailLabourer = detailFor ? labourers.find((l) => l.id === detailFor) || null : null;

  function clearOverride(labourerId: string, ending: string) {
    const key = attendanceKey(labourerId, ending);
    setAttendanceOverrides((current) => { const next = { ...current }; delete next[key]; return next; });
  }
  const handleDeletePayment = (payment: LabourPayment) => { clearOverride(payment.labourer_id, payment.week_ending); void onDeletePayment(payment); };
  const handleUnlockWeek = (record: AttendanceRecord) => { clearOverride(record.labourer_id, record.week_ending); void unlockWeek(record); };

  async function giveAdvance(labourer: LabourerWithPayments, amount: number, givenDate: string, note: string) {
    const { error } = await supabase.from('labour_advances').insert({ labourer_id: labourer.id, amount, amount_remaining: amount, given_date: givenDate, note: note || null });
    if (error) { onNotify('Unable to record advance'); return; }
    onNotify(`Advance of ${money(amount)} given to ${labourer.name}`);
    void onReload();
  }
  async function deleteAdvance(advance: LabourAdvance) {
    if (Number(advance.amount_remaining) !== Number(advance.amount)) { onNotify('Cannot delete an advance after some of it has been recovered'); return; }
    if (!window.confirm('Delete this advance?')) return;
    const { error } = await supabase.from('labour_advances').delete().eq('id', advance.id);
    if (error) { onNotify('Unable to delete advance'); return; }
    onNotify('Advance removed');
    void onReload();
  }
  async function editAdvanceNote(advance: LabourAdvance, note: string) {
    const { error } = await supabase.from('labour_advances').update({ note: note || null }).eq('id', advance.id);
    if (error) { onNotify('Unable to update note'); return; }
    onNotify('Note updated');
    void onReload();
  }

  return <section><PageHeading title="Labour" description="Track workers, attendance and weekly wage payments." action="Add labourer" onAction={onAddLabourer} />
    {labourers.length === 0 && <div className="ld-onboarding-banner"><div className="ld-onboarding-icon"><Lightbulb size={24} /></div><div><h4>How it works</h4><p><strong>1.</strong> Add a worker &nbsp; <strong>2.</strong> Mark days they worked each week &nbsp; <strong>3.</strong> Click Pay — done!</p></div></div>}
    <div className="labour-summary ld-summary-3">
      <div className="report-card"><span>Paid out</span><strong className="positive">{money(totalPaid)}</strong><small>{fullPaidCount} {fullPaidCount === 1 ? 'week' : 'weeks'} fully paid</small></div>
      <div className="report-card"><span>Still to pay</span><strong className="warning-text">{money(totalUnpaid)}</strong><small>{unpaidCount + partialCount} {unpaidCount + partialCount === 1 ? 'week' : 'weeks'} pending</small></div>
      <div className="report-card"><span>Workers</span><strong>{labourers.length}</strong><small>{labourers.length === 0 ? 'Add your first worker' : 'Click a worker to manage'}</small></div>
    </div>
    <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search worker name" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
    <div className="labourer-grid">{filtered.map((labourer) => { const s = workerStats(labourer); const pendingAdvance = labourer.advances.reduce((sum, a) => sum + Number(a.amount_remaining || 0), 0); return <div className="labourer-card" key={labourer.id} onClick={() => setDetailFor(labourer.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailFor(labourer.id); } }}>
      <div className="lc-header"><div className="person-cell"><div className="person-avatar"><HardHat size={18} /></div><div><strong>{labourer.name}</strong><small>{money(labourer.daily_wage)}/day</small></div></div>{s.unpaidTotal > 0 ? <span className="chip due">{money(s.unpaidTotal)} to pay</span> : <span className="chip settled"><Check size={14} /> Settled</span>}</div>
      <div className="lc-rate"><span>{labourer.phone || 'No phone'}</span></div>
      {pendingAdvance > 0 && <div className="lc-advance-badge"><HandCoins size={14} /> Cash advance pending: {money(pendingAdvance)}</div>}
      <div className="lc-hint">Click to mark days &amp; pay →</div>
    </div>; })}</div>
    {filtered.length === 0 && <div className="table-card"><EmptyState title="No workers yet" text="Click 'Add labourer' to start. Add a worker, mark their days, and pay them — that's it!" /></div>}
    {detailLabourer && <Modal wide title="Worker details" onClose={() => setDetailFor(null)}><LabourerDetail labourer={detailLabourer} weekEnding={weekEnding} setWeekEnding={setWeekEnding} currentAttendance={currentAttendance} toggleDay={toggleDay} updateDayDetail={updateDayDetail} settleWeek={settleWeek} onRecordPayment={onRecordPayment} onMarkPaid={onMarkPaid} onDeletePayment={handleDeletePayment} onUnlockWeek={handleUnlockWeek} onDeleteLabourer={onDeleteLabourer} onGiveAdvance={(amount, date, note) => void giveAdvance(detailLabourer, amount, date, note)} onDeleteAdvance={deleteAdvance} onEditAdvanceNote={editAdvanceNote} /></Modal>}
  </section>;
}

function LabourerDetail({ labourer, weekEnding, setWeekEnding, currentAttendance, toggleDay, updateDayDetail, settleWeek, onRecordPayment, onMarkPaid, onDeletePayment, onUnlockWeek, onDeleteLabourer, onGiveAdvance, onDeleteAdvance, onEditAdvanceNote }: { labourer: LabourerWithPayments; weekEnding: string; setWeekEnding: (v: string) => void; currentAttendance: (l: LabourerWithPayments) => AttendanceRecord | undefined; toggleDay: (l: LabourerWithPayments, d: AttendanceDayKey) => void; updateDayDetail: (l: LabourerWithPayments, d: AttendanceDayKey, field: 'incentive' | 'site', value: number | string) => void; settleWeek: (l: LabourerWithPayments, markPaid: boolean) => void; onRecordPayment: (payment: LabourPayment, amount: number) => void; onMarkPaid: (payment: LabourPayment) => void; onDeletePayment: (payment: LabourPayment) => void; onUnlockWeek: (record: AttendanceRecord) => void; onDeleteLabourer: (labourer: Labourer) => void; onGiveAdvance: (amount: number, date: string, note: string) => void; onDeleteAdvance: (advance: LabourAdvance) => void; onEditAdvanceNote: (advance: LabourAdvance, note: string) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceDate, setAdvanceDate] = useState(today);
  const [advanceNote, setAdvanceNote] = useState('');
  const [payConfirm, setPayConfirm] = useState<null | { type: 'full' | 'week'; amount: number; payment?: LabourPayment }>(null);
  const [partialFor, setPartialFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const record = currentAttendance(labourer);
  const present = record ? attendanceDays.filter(([key]) => record[key]).length : attendanceDays.length;
  const finalAmount = computeAmount(labourer, record);
  const settled = record?.settled || false;
  const linkedPayment = labourer.payments.find((p) => p.week_ending === weekEnding);
  const payStatus = linkedPayment?.payment_status || 'Unpaid';
  const isPaid = payStatus === 'Paid';
  const isPartial = payStatus === 'Partial';
  const balance = linkedPayment ? Number(linkedPayment.balance || 0) : 0;
  const paidSoFar = linkedPayment ? Number(linkedPayment.amount_paid || 0) : 0;
  const pastPayments = [...labourer.payments].sort((a, b) => b.week_ending.localeCompare(a.week_ending));
  const pastAdvances = [...labourer.advances].sort((a, b) => (b.given_date < a.given_date ? -1 : 1));
  const weekPay = !settled ? computeWeekPayable(labourer, finalAmount) : null;
  const pendingAdvanceTotal = labourer.advances.reduce((sum, a) => sum + Number(a.amount_remaining || 0), 0);
  const dueTotal = labourer.payments.reduce((sum, p) => sum + Number(p.balance || 0), 0);
  const paidTotal = labourer.payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  const stats = workerStats(labourer);
  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'short' });

  function submitAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (advanceAmount > 0) { onGiveAdvance(advanceAmount, advanceDate, advanceNote); setShowAdvanceForm(false); setAdvanceAmount(0); setAdvanceNote(''); }
  }

  function confirmPay() {
    if (!payConfirm) return;
    if (payConfirm.type === 'week') { void settleWeek(labourer, true); }
    else if (payConfirm.payment) { void onMarkPaid(payConfirm.payment); }
    setPayConfirm(null);
  }

  return <div className="labourer-detail">
    <div className="ld-header"><div className="person-cell"><div className="person-avatar large"><HardHat size={22} /></div><div><h3>{labourer.name}</h3><small>{labourer.role ? `${labourer.role} · ` : ''}{money(labourer.daily_wage)}/day{labourer.phone ? ` · ${labourer.phone}` : ''}</small></div></div><div className="ld-header-actions"><button className="icon-button danger" onClick={() => void onDeleteLabourer(labourer)}><Trash2 size={16} /></button></div></div>

    <div className="ld-strip ld-strip-4">
      <div className="ld-strip-item"><span>Days worked in {new Date().getFullYear()}</span><strong>{stats.yearDays}</strong></div>
      <div className="ld-strip-item"><span>Days in {monthLabel}</span><strong>{stats.monthDays}</strong></div>
      <div className="ld-strip-item"><span>Total paid</span><strong className="positive">{money(paidTotal)}</strong></div>
      <div className="ld-strip-item"><span>{dueTotal > 0 ? 'To pay' : 'All settled'}</span><strong className={dueTotal > 0 ? 'warning-text' : 'positive'}>{dueTotal > 0 ? money(dueTotal) : '₹0'}</strong></div>
    </div>

    {pendingAdvanceTotal > 0 && <div className="ld-advance-pending"><HandCoins size={16} /> Cash advance pending: {money(pendingAdvanceTotal)} — will be deducted automatically</div>}

    <div className="ld-week-bar"><div><span className="eyebrow">THIS WEEK</span><strong>{weekRangeLabel(weekEnding)}</strong></div><label>Week ending (Sunday)<input type="date" value={weekEnding} onChange={(e) => setWeekEnding(upcomingSunday(e.target.value))} /></label></div>

    <div className="ld-days">{attendanceDays.map(([key, label]) => { const isPresent = record?.[key] ?? true; const dayInc = dayIncentiveOf(record, key); const daySite = daySiteOf(record, key); return <div className={`ld-day-card ${isPresent ? 'came' : 'absent'}`} key={key}><button className={`ld-day ${isPresent ? 'came' : 'absent'}`} onClick={() => void toggleDay(labourer, key)} disabled={settled}><span className="ld-day-label">{label}</span><span className="ld-day-state">{isPresent ? <><Check size={18} /> Came</> : <><X size={18} /> Absent</>}</span></button>{isPresent && settled && (dayInc > 0 || daySite) && <div className="ld-day-detail-static">{dayInc > 0 && <span>+{money(dayInc)}</span>}{daySite && <small>{daySite}</small>}</div>}</div>; })}</div>

    <div className="ld-live-counter">{present} {present === 1 ? 'day' : 'days'} worked → <strong>{money(weekPay?.netPayable ?? finalAmount)}</strong> {weekPay && weekPay.toRecover > 0 ? `(${money(weekPay.toRecover)} advance deducted)` : 'to pay'}</div>

    {showAdvanced && !settled && <div className="ld-advanced-days">{attendanceDays.map(([key, label]) => { const isPresent = record?.[key] ?? true; const dayInc = dayIncentiveOf(record, key); const daySite = daySiteOf(record, key); return <div className="ld-adv-day-row" key={key}>{isPresent ? <><span className="ld-adv-day-label">{label}</span><input type="number" inputMode="decimal" onFocus={selectZeroOnFocus} min="0" step="0.01" placeholder="Bonus" value={dayInc} onChange={(e) => void updateDayDetail(labourer, key, 'incentive', Number(e.target.value))} /><input type="text" placeholder="Site name" value={daySite} onChange={(e) => void updateDayDetail(labourer, key, 'site', e.target.value)} /></> : <div className="ld-adv-day-absent"><span className="ld-adv-day-label">{label}</span><small>Absent</small></div>}</div>; })}</div>}
    {!settled && <button type="button" className="text-button ld-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}><ChevronRight size={15} className={showAdvanced ? 'ld-chevron-down' : ''} /> {showAdvanced ? 'Hide' : 'Add'} per-day bonuses & sites</button>}

    {settled && linkedPayment ? (
      isPaid ? <div className="ld-paid-badge"><Check size={18} /> Fully paid {money(linkedPayment.amount)} for this week</div>
      : <div className="ld-pay-panel">
        <div className="ld-pay-status">
          {isPartial ? <><span className="ld-status-label partial">Partially paid</span> {money(paidSoFar)} paid — {money(balance)} left to pay</> : <span className="ld-status-label unpaid">Saved — {money(balance)} not paid yet</span>}
        </div>
        {partialFor === linkedPayment.id ? (
          <form className="ld-partial-form" onSubmit={(e) => { e.preventDefault(); if (payAmount > 0 && payAmount <= balance) { onRecordPayment(linkedPayment, payAmount); setPartialFor(null); setPayAmount(0); } }}>
            <label>Pay amount<input type="number" inputMode="decimal" onFocus={selectZeroOnFocus} min="1" max={balance} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} required autoFocus /></label>
            <button type="submit" className="button primary">Pay {money(payAmount || 0)}</button>
            <button type="button" className="button secondary" onClick={() => { setPartialFor(null); setPayAmount(0); }}>Cancel</button>
          </form>
        ) : (
          <div className="ld-pay-buttons">
            <button className="button primary ld-pay-now" onClick={() => setPayConfirm({ type: 'full', amount: balance, payment: linkedPayment })}>Pay full {money(balance)}</button>
            <button className="text-button" onClick={() => { setPartialFor(linkedPayment.id); setPayAmount(0); }}>Partial pay</button>
          </div>
        )}
      </div>
    ) : settled ? <div className="ld-saved-notice">Week saved</div>
    : <div className="ld-actions">{weekPay && weekPay.netPayable <= 0 ? <><div className="ld-no-pay">Advance covers all earnings — nothing to pay this week</div><button className="button secondary ld-pay-now" onClick={() => void settleWeek(labourer, true)} disabled={present === 0}>Save week</button></> : <><button className="button primary ld-pay-now" onClick={() => setPayConfirm({ type: 'week', amount: weekPay?.netPayable ?? finalAmount })} disabled={present === 0}>Pay {money(weekPay?.netPayable ?? finalAmount)} now</button><button className="text-button ld-save-only" onClick={() => void settleWeek(labourer, false)}>Save without paying yet</button></>}</div>}

    {payConfirm && <div className="ld-confirm-overlay" onClick={() => setPayConfirm(null)}><div className="ld-confirm-dialog" onClick={(e) => e.stopPropagation()}><div className="ld-confirm-icon"><CircleDollarSign size={28} /></div><h4>Pay {money(payConfirm.amount)}?</h4><p>This will mark the week as fully paid{weekPay && weekPay.toRecover > 0 && payConfirm.type === 'week' ? ` and recover ${money(weekPay.toRecover)} from pending advances` : ''}.</p><div className="ld-confirm-actions"><button className="button primary" onClick={confirmPay}>Yes, pay {money(payConfirm.amount)}</button><button className="button secondary" onClick={() => setPayConfirm(null)}>Cancel</button></div></div></div>}

    <button type="button" className="text-button ld-more-options-toggle" onClick={() => setShowMoreOptions(!showMoreOptions)}><ChevronRight size={15} className={showMoreOptions ? 'ld-chevron-down' : ''} /> More options</button>
    {showMoreOptions && <div className="ld-more-options">
      <div className="ld-more-section">
        <div className="ld-more-heading"><HandCoins size={16} /> <h5>Cash advance</h5></div>
        <p className="ld-more-desc">Give cash in advance. It will be deducted automatically from future weekly earnings.</p>
        {!showAdvanceForm && <button className="button secondary" onClick={() => setShowAdvanceForm(true)}><HandCoins size={16} /> Give cash advance</button>}
        {showAdvanceForm && <form className="ld-advance-form" onSubmit={submitAdvance}><label>Amount<input type="number" inputMode="decimal" onFocus={selectZeroOnFocus} min="1" step="0.01" value={advanceAmount} onChange={(e) => setAdvanceAmount(Number(e.target.value))} required autoFocus /></label><label>Date<input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} /></label><label className="full">Note (optional)<input type="text" value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} placeholder="Reason for advance" /></label><div className="form-actions"><button type="submit" className="button primary">Give {money(advanceAmount || 0)} advance</button><button type="button" className="button secondary" onClick={() => { setShowAdvanceForm(false); setAdvanceAmount(0); setAdvanceNote(''); }}>Cancel</button></div></form>}
        {pastAdvances.length > 0 && <div className="ld-advance-history">{pastAdvances.map((adv) => { const recovered = Number(adv.amount) - Number(adv.amount_remaining); const canDelete = Number(adv.amount_remaining) === Number(adv.amount); return <div className="profile-payment-row advance-row" key={adv.id}><div><strong>{money(adv.amount)} · {dateLabel(adv.given_date)}</strong>{adv.note && <small>{adv.note}</small>}<small className="advance-recovery">Recovered {money(recovered)} · Pending {money(adv.amount_remaining)}</small></div><div className="profile-payment-actions">{canDelete ? <button className="icon-button danger" onClick={() => void onDeleteAdvance(adv)}><Trash2 size={15} /></button> : <AdvanceNoteEditor advance={adv} onSave={onEditAdvanceNote} />}</div></div>; })}</div>}
      </div>
    </div>}

    <div className="ld-history"><div className="profile-section-heading"><h4>Past weeks</h4><span>{pastPayments.length} {pastPayments.length === 1 ? 'week' : 'weeks'}</span></div>{pastPayments.length > 0 ? pastPayments.map((payment) => { const attRecord = labourer.attendance.find((r) => r.week_ending === payment.week_ending); const daysPresent = attRecord ? attendanceDays.filter(([key]) => attRecord[key]).length : null; const pStatus = payment.payment_status || (payment.paid ? 'Paid' : 'Unpaid'); const pBalance = Number(payment.balance ?? (payment.paid ? 0 : payment.amount)); const pPaid = Number(payment.amount_paid ?? (payment.paid ? payment.amount : 0)); const isPartialForThis = partialFor === payment.id; return <div className="profile-payment-row" key={payment.id}><div><strong>{weekRangeLabel(payment.week_ending)}</strong><small>{daysPresent !== null ? `${daysPresent} days worked` : 'Weekly payment'}</small>{attRecord?.settled && pStatus !== 'Paid' && <button className="text-button tiny" onClick={() => void onUnlockWeek(attRecord)}>Make changes</button>}</div><div className="profile-payment-actions"><div className="pp-amounts"><strong>{money(payment.amount)}</strong>{pStatus === 'Partial' && <small className="pp-partial">Paid {money(pPaid)} · {money(pBalance)} left</small>}</div><span className={`pay-status-chip ${pStatus.toLowerCase()}`}>{pStatus === 'Paid' ? <><Check size={13} /> Paid</> : pStatus === 'Partial' ? <><CircleDollarSign size={13} /> Partial</> : <><X size={13} /> Unpaid</>}</span>{pStatus !== 'Paid' && !isPartialForThis && <button className="button tiny primary" onClick={() => setPayConfirm({ type: 'full', amount: pBalance, payment })}>Pay {money(pBalance)}</button>}{pStatus !== 'Paid' && !isPartialForThis && <button className="text-button tiny" onClick={() => { setPartialFor(payment.id); setPayAmount(0); }}>Partial</button>}{isPartialForThis && <form className="pp-partial-form" onSubmit={(e) => { e.preventDefault(); if (payAmount > 0 && payAmount <= pBalance) { onRecordPayment(payment, payAmount); setPartialFor(null); setPayAmount(0); } }}><input type="number" inputMode="decimal" onFocus={selectZeroOnFocus} min="1" max={pBalance} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} placeholder="Amount" required autoFocus /><button type="submit" className="button tiny primary">Pay {money(payAmount || 0)}</button><button type="button" className="button tiny secondary" onClick={() => { setPartialFor(null); setPayAmount(0); }}>Cancel</button></form>}<button className="button tiny secondary" onClick={() => downloadWeekExcel(labourer, payment.week_ending)} title="Download this week as Excel"><Download size={14} /> Excel</button><button className="icon-button danger" onClick={() => void onDeletePayment(payment)}><Trash2 size={15} /></button></div></div>; }) : <div className="labour-empty">No past weeks yet — mark attendance above to get started.</div>}</div>

  </div>;
}

function AdvanceNoteEditor({ advance, onSave }: { advance: LabourAdvance; onSave: (advance: LabourAdvance, note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(advance.note || '');
  if (editing) return <form onSubmit={(e) => { e.preventDefault(); onSave(advance, note); setEditing(false); }}><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note" autoFocus /><button type="submit" className="button tiny primary">Save</button></form>;
  return <button className="text-button tiny" onClick={() => setEditing(true)}>Edit note</button>;
}

function LabourerForm({ onSubmit }: { onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return <form className="form-grid" onSubmit={onSubmit}>
    <label className="full">Worker name *<input name="name" required placeholder="e.g. Ramesh" /></label>
    <label>Daily wage *<input name="daily_wage" type="number" onFocus={selectZeroOnFocus} min="0" required defaultValue="0" /><small className="field-help">How much they earn per working day. Example: ₹500 per day</small></label>
    <label>Phone (optional)<input name="phone" inputMode="tel" placeholder="Mobile number" /></label>
    <button type="button" className="text-button full ld-form-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}><ChevronRight size={15} className={showAdvanced ? 'ld-chevron-down' : ''} /> {showAdvanced ? 'Hide' : 'Show'} advanced options</button>
    {showAdvanced && <><label>Role / trade<input name="role" placeholder="e.g. Plumber helper" /><small className="field-help">What kind of work they do</small></label>
    <label>Weekly bonus<input name="weekly_incentive" type="number" onFocus={selectZeroOnFocus} min="0" defaultValue="0" /><small className="field-help">Added when all six working days (Mon–Sat) are present</small></label></>}
    <div className="form-actions full"><button type="submit" className="button primary">Add worker</button></div>
  </form>;
}
function DocumentForm({ type, settings, invoiceCount, quotationCount, editing, onNotify: setNotice, onSaved }: { type: 'invoice' | 'quotation'; settings: SettingsData | null; invoiceCount: number; quotationCount: number; editing: { document: Document; lines: Line[]; customer: Customer | null } | null; onNotify: (message: string) => void; onSaved: () => void }) {
  const [custName, setCustName] = useState(editing?.customer?.name || editing?.document.customers?.name || '');
  const [custProject, setCustProject] = useState(editing?.customer?.project_name || editing?.document.customers?.project_name || '');
  const [custAddress, setCustAddress] = useState(editing?.customer?.address || editing?.document.customers?.address || '');
  const [custPhone, setCustPhone] = useState(editing?.customer?.phone || editing?.document.customers?.phone || '');
  const [date, setDate] = useState(editing?.document.invoice_date || editing?.document.quotation_date || today);
  const [dueDate, setDueDate] = useState(editing?.document.due_date || editing?.document.valid_until || '');
  const [discount, setDiscount] = useState(Number(editing?.document.discount || 0));
  const [taxEnabled, setTaxEnabled] = useState(Number(editing?.document.tax || 0) > 0);
  const [lines, setLines] = useState<Line[]>(editing?.lines.length ? editing.lines : [{ description: '', unit: 'NOS.', quantity: 1, rate: 0 }]);
  const [notes, setNotes] = useState(editing?.document.notes || '');
  const isQuote = type === 'quotation';
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.rate, 0);
  const tax = taxEnabled ? subtotal * Number(settings?.default_tax || 0) / 100 : 0;
  const grand = subtotal - discount + tax;
  function updateLine(index: number, key: keyof Line, value: string | number) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line)); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!custName.trim()) return;
    const isEditing = !!editing;
    let customerId = editing?.document.customer_id || null;
    if (isEditing && editing?.customer) {
      const { error: custErr } = await supabase.from('customers').update({ name: custName.trim(), project_name: custProject || null, address: custAddress || null, phone: custPhone || null }).eq('id', editing.customer.id);
      if (custErr) { setNotice('Unable to update customer'); return; }
    } else {
      const { data: customer, error: customerError } = await supabase.from('customers').insert({ name: custName.trim(), project_name: custProject || null, address: custAddress || null, phone: custPhone || null }).select('id').maybeSingle();
      if (customerError || !customer) return;
      customerId = customer.id;
    }
    const table = type === 'invoice' ? 'invoices' : 'quotations';
    const itemsTable = type === 'invoice' ? 'invoice_items' : 'quotation_items';
    const itemKey = type === 'invoice' ? 'invoice_id' : 'quotation_id';
    if (isEditing) {
      const docId = editing!.document.id;
      const updatePayload = type === 'invoice'
        ? { customer_id: customerId, invoice_date: date, due_date: dueDate || null, discount, tax, grand_total: grand, balance_due: Math.max(0, grand - Number(editing!.document.amount_paid || 0)), notes }
        : { customer_id: customerId, quotation_date: date, valid_until: dueDate || null, discount, tax, grand_total: grand, notes };
      const { error: docError } = await supabase.from(table).update(updatePayload).eq('id', docId);
      if (docError) { onNotify(docError.message); return; }
      await supabase.from(itemsTable).delete().eq(itemKey, docId);
      const rows = lines.filter((line) => line.description.trim()).map((line) => ({ [itemKey]: docId, description: line.description.trim(), unit: line.unit.trim() || 'NOS.', quantity: line.quantity, rate: line.rate }));
      if (rows.length) { const { error: lineError } = await supabase.from(itemsTable).insert(rows); if (lineError) { onNotify(lineError.message); return; } }
      onSaved();
      return;
    }
    const existing = type === 'invoice' ? invoiceCount : quotationCount;
    const prefix = type === 'invoice' ? settings?.invoice_prefix || 'INV-' : settings?.quotation_prefix || 'QT-';
    const number = `${prefix}${String(existing + 1).padStart(4, '0')}`;
    const payload = type === 'invoice'
      ? { invoice_number: number, customer_id: customerId, invoice_date: date, due_date: dueDate || null, status: 'Unpaid', discount, tax, grand_total: grand, amount_paid: 0, balance_due: grand, notes }
      : { quotation_number: number, customer_id: customerId, quotation_date: date, valid_until: dueDate || null, status: 'Draft', discount, tax, grand_total: grand, notes };
    const { data, error } = await supabase.from(table).insert(payload).select('id').maybeSingle();
    if (error || !data) { setNotice(error?.message || 'Unable to save document'); return; }
    const rows = lines.filter((line) => line.description.trim()).map((line) => ({ [itemKey]: data.id, description: line.description.trim(), unit: line.unit.trim() || 'NOS.', quantity: line.quantity, rate: line.rate }));
    const { error: lineError } = rows.length ? await supabase.from(itemsTable).insert(rows) : { error: null };
    if (lineError) return;
    onSaved();
  }
  return <form onSubmit={save} className="document-form"><div className="form-section-title">Customer details</div><div className="form-grid"><label>Customer name *<input value={custName} onChange={(e) => setCustName(e.target.value)} required placeholder="e.g. Anil Kad" /></label><label>Project / property<input value={custProject} onChange={(e) => setCustProject(e.target.value)} placeholder="e.g. Kad residence" /></label><label className="full">Address<input value={custAddress} onChange={(e) => setCustAddress(e.target.value)} placeholder="Site address" /></label><label>Phone<input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} inputMode="tel" placeholder="Mobile number" /></label><label>{type === 'invoice' ? 'Invoice date *' : 'Quotation date *'}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><label>{type === 'invoice' ? 'Due date' : 'Valid until'}<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label></div><div className="line-items"><div className="line-header"><h3>Work items</h3><button type="button" className="text-button" onClick={() => setLines([...lines, { description: '', unit: 'NOS.', quantity: 1, rate: 0 }])}><Plus size={15} /> Add row</button></div>{lines.map((line, index) => <div className={`line-row ${isQuote ? 'line-row-quote' : ''}`} key={index}><textarea className="desc-input" rows={4} placeholder="Description of work" value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)} onInput={resizeDescription} required /><div className="mobile-field"><small>Unit</small><input className="unit-input" placeholder="Unit" value={line.unit} onChange={(e) => updateLine(index, 'unit', e.target.value)} /></div>{!isQuote && <div className="mobile-field"><small>Qty</small><input className="number-input" type="number" onFocus={selectZeroOnFocus} min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))} /></div>}<div className="mobile-field"><small>Rate</small><input className="number-input" type="number" onFocus={selectZeroOnFocus} min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(index, 'rate', Number(e.target.value))} /></div>{!isQuote && <div className="amount-row"><span>Amount</span><strong>{money(line.quantity * line.rate)}</strong></div>}{lines.length > 1 && <button type="button" className="icon-button danger remove-row" onClick={() => setLines(lines.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={15} /></button>}</div>)}</div><div className="document-summary"><label>Notes / terms<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add work notes or terms" /></label>{!isQuote && <div className="totals-box"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Discount</span><input type="number" onFocus={selectZeroOnFocus} min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div><label className="tax-toggle"><input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} /> Add tax ({settings?.default_tax || 0}%)</label><div className="grand-total"><span>Grand total</span><strong>{money(grand)}</strong></div></div>}</div><div className="form-actions"><button className="button primary" type="submit">{editing ? 'Save changes' : `Save ${type}`}</button></div></form>;
}

function EstimateList({ estimates, query, setQuery, onCreate, onView, onEdit, onDelete }: { estimates: Estimate[]; query: string; setQuery: (value: string) => void; onCreate: () => void; onView: (estimate: Estimate) => void; onEdit: (estimate: Estimate) => void; onDelete: (estimate: Estimate) => void }) {
  const filtered = estimates.filter((row) => `${row.estimate_number} ${row.customers?.name || ''} ${row.status}`.toLowerCase().includes(query.toLowerCase()));
  return <section><PageHeading title="Estimates" description="Create purchase lists for clients to buy materials." action="Create estimate" onAction={onCreate} /><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search estimates" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="table-card"><table><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((row) => <tr className="clickable-row" key={row.id} onClick={() => void onView(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void onView(row); } }} tabIndex={0}><td><button className="document-link" onClick={(event) => { event.stopPropagation(); void onView(row); }}>{row.estimate_number}</button><small className="table-subtext">{row.customers?.project_name || 'No project'}</small></td><td>{row.customers?.name || 'No customer'}</td><td>{dateLabel(row.estimate_date)}</td><td><span className={`status ${row.status.toLowerCase().replace(' ', '-')}`}>{row.status}</span></td><td><div className="row-actions"><button className="text-button" onClick={(event) => { event.stopPropagation(); void onEdit(row); }}>Edit</button><button className="text-button" onClick={(event) => { event.stopPropagation(); void onView(row); }}>View</button><button className="icon-button danger" onClick={(event) => { event.stopPropagation(); void onDelete(row); }}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState title="No estimates yet" text="Create your first estimate to see it here." />}</div></section>;
}

function EstimateForm({ estimateCount, editing, onSaved }: { estimateCount: number; editing: { estimate: Estimate; items: EstimateItem[]; customer: Customer | null } | null; onSaved: () => void }) {
  const [custName, setCustName] = useState(editing?.customer?.name || editing?.estimate.customers?.name || '');
  const [custProject, setCustProject] = useState(editing?.customer?.project_name || editing?.estimate.customers?.project_name || '');
  const [custAddress, setCustAddress] = useState(editing?.customer?.address || editing?.estimate.customers?.address || '');
  const [custPhone, setCustPhone] = useState(editing?.customer?.phone || editing?.estimate.customers?.phone || '');
  const [date, setDate] = useState(editing?.estimate.estimate_date || today);
  const [status, setStatus] = useState(editing?.estimate.status || 'Draft');
  const [notes, setNotes] = useState(editing?.estimate.notes || '');
  const [lines, setLines] = useState<EstimateLine[]>(editing?.items.length ? editing.items.map((item) => ({ description: item.description, particulars: item.particulars || '', quantity: Number(item.quantity) })) : [{ description: '', particulars: '', quantity: 1 }]);
  function updateLine(index: number, key: keyof EstimateLine, value: string | number) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line)); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!custName.trim()) return;
    const isEditing = !!editing;
    let customerId = editing?.estimate.customer_id || null;
    if (isEditing && editing?.customer) {
      const { error: custErr } = await supabase.from('customers').update({ name: custName.trim(), project_name: custProject || null, address: custAddress || null, phone: custPhone || null }).eq('id', editing.customer.id);
      if (custErr) { setNotice('Unable to update customer'); return; }
    } else {
      const { data: customer, error: customerError } = await supabase.from('customers').insert({ name: custName.trim(), project_name: custProject || null, address: custAddress || null, phone: custPhone || null }).select('id').maybeSingle();
      if (customerError || !customer) return;
      customerId = customer.id;
    }
    if (isEditing) {
      const estId = editing!.estimate.id;
      const { error: docError } = await supabase.from('estimates').update({ customer_id: customerId, estimate_date: date, status, notes }).eq('id', estId);
      if (docError) { setNotice('Unable to update estimate'); return; }
      await supabase.from('estimate_items').delete().eq('estimate_id', estId);
      const rows = lines.filter((line) => line.description.trim()).map((line) => ({ estimate_id: estId, description: line.description.trim(), particulars: line.particulars.trim() || null, quantity: line.quantity }));
      if (rows.length) { const { error: lineError } = await supabase.from('estimate_items').insert(rows); if (lineError) { setNotice('Unable to update items'); return; } }
      onSaved();
      return;
    }
    const prefix = 'EST-';
    const number = `${prefix}${String(estimateCount + 1).padStart(4, '0')}`;
    const { data, error } = await supabase.from('estimates').insert({ estimate_number: number, customer_id: customerId, estimate_date: date, status, notes }).select('id').maybeSingle();
    if (error || !data) { setNotice(error?.message || 'Unable to save document'); return; }
    const rows = lines.filter((line) => line.description.trim()).map((line) => ({ estimate_id: data.id, description: line.description.trim(), particulars: line.particulars.trim() || null, quantity: line.quantity }));
    const { error: lineError } = rows.length ? await supabase.from('estimate_items').insert(rows) : { error: null };
    if (lineError) return;
    onSaved();
  }
  return <form onSubmit={save} className="document-form"><div className="form-section-title">Customer details</div><div className="form-grid"><label>Customer name *<input value={custName} onChange={(e) => setCustName(e.target.value)} required placeholder="e.g. Anil Kad" /></label><label>Project / property<input value={custProject} onChange={(e) => setCustProject(e.target.value)} placeholder="e.g. Kad residence" /></label><label className="full">Address<input value={custAddress} onChange={(e) => setCustAddress(e.target.value)} placeholder="Site address" /></label><label>Phone<input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} inputMode="tel" placeholder="Mobile number" /></label><label>Estimate date *<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="Draft">Draft</option><option value="Sent">Sent</option></select></label></div><div className="line-items"><div className="line-header"><h3>Purchase items</h3><button type="button" className="text-button" onClick={() => setLines([...lines, { description: '', particulars: '', quantity: 1 }])}><Plus size={15} /> Add row</button></div>{lines.map((line, index) => <div className="line-row estimate-line-row" key={index}><textarea className="desc-input" rows={3} placeholder="Description" value={line.description} onChange={(e) => updateLine(index, 'description', e.target.value)} onInput={resizeDescription} required /><div className="mobile-field"><small>Particulars</small><input className="particulars-input" placeholder="Particulars / specs" value={line.particulars} onChange={(e) => updateLine(index, 'particulars', e.target.value)} /></div><div className="mobile-field"><small>Qty</small><input className="number-input" type="number" onFocus={selectZeroOnFocus} min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))} /></div>{lines.length > 1 && <button type="button" className="icon-button danger remove-row" onClick={() => setLines(lines.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={15} /></button>}</div>)}</div><div className="document-summary"><label>Notes<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes for the client" /></label></div><div className="form-actions"><button className="button primary" type="submit">{editing ? 'Save changes' : 'Save estimate'}</button></div></form>;
}

function EstimatePreview({ data, settings }: { data: EstimatePreviewData; settings: SettingsData | null }) {
  const { estimate, items, customer } = data;
  const name = customer?.name || estimate.customers?.name || 'Walk-in customer';
  const project = customer?.project_name || estimate.customers?.project_name || null;
  const address = customer?.address || estimate.customers?.address || null;
  const phone = customer?.phone || estimate.customers?.phone || null;
  return <div className="preview-shell"><div className="preview-actions"><button className="button secondary" onClick={() => window.print()}><Printer size={16} /> Print</button></div>
    <div className="a4-sheet estimate-sheet" id="document-print">
      <header className="doc-header"><div className="doc-company"><img src="/new-logo.png" alt="Shri Venkatesh Plumbing Work Washim logo" /><div><h1>SHRI VENKATESH PLUMBING WORK WASHIM</h1><p>PRO. {'HARISH S PHUSE'}</p><p>WASHIM MAHARASHTRA 444505</p><p>MOB. 9623199934 / 8329847776</p></div></div><div className="doc-type-badge"><strong>ESTIMATE</strong><span>{estimate.estimate_number}</span></div></header>
      <section className="doc-meta"><div><span className="doc-label">Estimate date</span><strong>{dateLabel(estimate.estimate_date)}</strong></div><div><span className="doc-label">Status</span><span className={`status ${estimate.status.toLowerCase().replace(' ', '-')}`}>{estimate.status}</span></div></section>
      <section className="doc-party"><div><span className="doc-label">Billed to</span><strong>{name}</strong>{project && <p>{project}</p>}{address && <p>{address}</p>}{phone && <p>Ph: {phone}</p>}</div></section>
      <table className="doc-table estimate-table"><thead><tr><th className="sr">SN</th><th className="desc">DESCRIPTION</th><th className="particulars">PARTICULARS</th><th className="qty">QTY</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id || index}><td className="sr">{index + 1}</td><td className="desc">{item.description}</td><td className="particulars">{item.particulars || '—'}</td><td className="qty">{Number(item.quantity)}</td></tr>)}</tbody></table>
      {estimate.notes && <section className="doc-notes"><span className="doc-label">Notes</span><p>{estimate.notes}</p></section>}
      <footer className="doc-footer"><p>{settings?.default_footer || 'Thank you for choosing us.'}</p><small>{settings?.trust_text || '30 years of plumbing trust'}</small></footer>
    </div></div>;
}

export default App;
