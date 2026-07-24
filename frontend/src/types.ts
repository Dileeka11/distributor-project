export type ID = number;

export interface Category { id: ID; name: string; }

export interface Item {
  id: ID;
  code: string;
  name: string;
  category_id: ID;
  category?: Category;
  distributor_price: string | number;
  wholesale_price: string | number;
  retail_price: string | number;
  stock: number;
  opening_discount?: string | number; // % off when selling old/opening stock
  // Present when this item is a composite product built from other items.
  product?: { id: ID; item_id: ID; actual_price: string | number; selling_price: string | number } | null;
}

export interface ProductComponent {
  id: ID;
  product_id: ID;
  item_id: ID;
  item?: Item;
  name: string; // snapshot
  qty: string | number;
  price: string | number;
  total: string | number;
}

// A sellable item built by combining other items (recipe + pricing).
export interface Product {
  id: ID;
  item_id: ID;
  item?: Item;
  actual_price: string | number;  // per-unit component total
  selling_price: string | number;
  components?: ProductComponent[];
}

export interface Party {
  id: ID;
  code: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface Supplier extends Party {
  terms_days: number;
  payable: string | number;
}

export interface Customer extends Party {
  city: string | null;
  type: string;
  cash_discount: string | number;
  cheque_discount: string | number;
  terms_days: number;
  credit_limit: string | number;
  description: string | null;
  balance: string | number;
  opening_collected?: string | number;
  paid_total?: string | number;
}

export interface CustomerType {
  id: ID;
  name: string;
}

export type TxnType = 'cash' | 'credit';
export type TxnStatus = 'paid' | 'partial' | 'unpaid';

export interface InvoiceLine {
  id?: ID;
  item_id: ID;
  batch_id?: ID | null;
  name: string;
  qty: string | number;
  price: string | number;
  total: string | number;
}

export interface ItemBatch {
  id: ID;
  unit_price: string | number;
  discount: string | number;
  unit_cost: string | number;
  qty_remaining: number;
}

export interface Invoice {
  id: ID;
  no: string;
  date: string;
  type: TxnType;
  customer_id: ID;
  customer?: Customer;
  subtotal: string | number;
  cash_discount?: string | number;
  cheque_discount?: string | number;
  discount_amount?: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  total: string | number;
  paid: string | number;
  advance?: string | number; // up-front amount paid now (stable; excludes later collections)
  status: TxnStatus;
  cancelled_at?: string | null;
  lines?: InvoiceLine[];
  cheques?: Cheque[];
}

export interface Cheque {
  id?: ID;
  cheque_no: string | null;
  cheque_date: string | null;
  amount: string | number;
}

export interface ChequeRecord {
  id: ID;
  invoice_id: ID;
  invoice_no: string;
  customer_id: ID;
  customer_name: string;
  cheque_no: string | null;
  cheque_date: string | null;
  amount: string | number;
  invoice_total: string | number;
  invoice_paid: string | number;
  cleared: boolean;
}

export interface GrnChequeRecord {
  id: ID;
  grn_id: ID;
  grn_no: string;
  supplier_id: ID;
  supplier_name: string;
  cheque_no: string | null;
  cheque_date: string | null;
  amount: string | number;
  grn_total: string | number;
  grn_paid: string | number;
  cleared: boolean;
}

export interface GrnLine {
  id?: ID;
  item_id: ID;
  name: string;
  qty: string | number;
  unit_price?: string | number;
  discount?: string | number;
  price: string | number;
  total: string | number;
}

export interface Grn {
  id: ID;
  no: string;
  date: string;
  type: TxnType;
  supplier_id: ID;
  supplier?: Supplier;
  subtotal: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  total: string | number;
  paid: string | number;
  advance?: string | number; // up-front amount paid now (stable; excludes later payments)
  status: TxnStatus;
  cancelled_at?: string | null;
  lines?: GrnLine[];
  cheques?: Cheque[];
}

export interface Settlement {
  id: ID;
  code: string;
  date: string;
  side: 'receivable' | 'payable';
  customer_id?: ID | null;
  supplier_id?: ID | null;
  customer?: Customer | null;
  supplier?: Supplier | null;
  amount: string | number;
  mode: string;
  reference?: string | null;
  cheque_date?: string | null;
  cheques?: SettlementCheque[];
  passed?: boolean;
}

export interface SettlementCheque {
  id?: ID;
  cheque_no: string | null;
  cheque_date: string | null;
  amount: string | number;
  cleared_at?: string | null;
}

export interface SettlementChequeRecord {
  id: ID;
  settlement_id: ID;
  settlement_code: string;
  side: 'receivable' | 'payable';
  customer_id?: ID | null;
  supplier_id?: ID | null;
  party_name: string | null;
  cheque_no: string | null;
  cheque_date: string | null;
  amount: string | number;
  settlement_amount: string | number;
  cleared: boolean;
}

export interface AppSettings {
  company?: string;
  logo?: string;
  accent?: string;
  accent_press?: string;
  mode?: 'light' | 'dark';
  currency?: string;
  symbol?: string;
  tax_rate?: number;
  invoice_prefix?: string;
  phone?: string;
  email?: string;
  vat_no?: string;
  address?: string;
}

export interface User {
  id: ID;
  name: string;
  username?: string | null;
  email?: string | null;
  is_admin?: boolean;
  permissions?: string[];
}

export interface JobRole {
  id: ID;
  name: string;
}

export interface Employee {
  id: ID;
  code: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  basic_salary: string | number;
  hourly_rate: string | number;
  work_hours: string | number;   // standard hours per day; OT starts beyond this
  ot_rate: string | number;      // overtime rate (LKR / hour)
  join_date: string | null;
  active: boolean;
}

export interface Attendance {
  id: ID;
  employee_id: ID;
  employee?: Employee;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: string | number;
  status: string; // present | absent | leave | half-day
}

export interface LeaveCategory {
  id: ID;
  name: string;
  annual_days: number;   // yearly allowance per employee
  color: string;
  active: boolean;
}

export interface Leave {
  id: ID;
  employee_id: ID;
  employee?: Employee;
  leave_category_id: ID;
  category?: LeaveCategory;
  from_date: string;
  days: number;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  decided_at: string | null;
  decided_by?: ID | null;
  decidedBy?: { id: ID; name: string } | null;
  created_by?: ID | null;
}

export interface LeaveBalance {
  category_id: ID;
  name: string;
  color: string;
  allowance: number;
  used: number;
  remaining: number;
}

export interface Payroll {
  id: ID;
  code: string;
  employee_id: ID;
  employee?: Employee;
  month: number;
  year: number;
  days_worked: number;
  total_hours: string | number;
  ot_hours: string | number;
  basic_salary: string | number;
  hours_pay: string | number;
  ot_pay: string | number;
  bonus: string | number;
  gross_pay: string | number;
  deductions: string | number;
  net_pay: string | number;
  generated_at: string | null;
}

export interface DashboardPayload {
  totals: {
    sales: number; cash: number; credit: number;
    receivable: number; payable: number; low_stock_count: number;
  };
  low_stock: Pick<Item, 'id' | 'code' | 'name' | 'stock'>[];
  recent_invoices: Invoice[];
  top_receivables: Pick<Customer, 'id' | 'code' | 'name' | 'credit_limit' | 'balance'>[];
  sales_series: { date: string; label: string; cash: number; credit: number; }[];
  sales_month: string;
  inventory_by_category: { label: string; value: number; }[];
}
