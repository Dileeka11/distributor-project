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
  // Cost lots still holding units (loaded with products: one per assembly run).
  batches?: ItemBatch[];
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
  credit_discount: string | number;
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
  // `product` is set only when the item is a composite product (a PRD- code).
  item?: { id: ID; code: string; name: string; product?: { id: ID; item_id: ID } | null };
}

export interface SalesOrderLine {
  id?: ID;
  item_id: ID;
  name: string; // snapshot
  qty: number;
}

/** What a customer wants on a given day — becomes an invoice when it goes out. */
export interface SalesOrder {
  id: ID;
  no: string;
  date: string;      // taken on (Y-m-d)
  due_date: string;  // to deliver / invoice on (Y-m-d)
  customer_id: ID;
  customer?: { id: ID; code: string; name: string; phone: string | null; address: string | null };
  status: 'pending' | 'invoiced' | 'cancelled';
  note: string | null;
  invoice_id: ID | null;
  invoice?: { id: ID; no: string } | null;
  cancelled_at: string | null;
  lines?: SalesOrderLine[];
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
  credit_discount?: string | number;
  discount_amount?: string | number;
  /** Return credit taken off this bill, after discount and tax. */
  return_credit?: string | number;
  /** Goods handed back off this invoice. */
  returns?: SalesReturn[];
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
  /** Cost of customer-returned goods handed back to the supplier on this GRN. */
  return_deduction?: string | number;
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

export interface SalesReturnLine {
  id?: ID;
  invoice_line_id: ID | null;
  item_id: ID;
  batch_id?: ID | null;
  name: string;
  qty: string | number;
  price: string | number;
  discount_rate: string | number;
  total: string | number;
  item?: { id: ID; code: string; name: string };
}

export interface SalesReturn {
  id: ID;
  no: string;
  date: string;
  customer_id: ID;
  invoice_id: ID;
  total: string | number;
  note: string | null;
  customer?: Customer;
  invoice?: Pick<Invoice, 'id' | 'no' | 'date'>;
  lines?: SalesReturnLine[];
  /** Credit already spent on later invoices. */
  used?: string | number;
}

/** One invoice line as the returns screen sees it. */
export interface ReturnableLine {
  invoice_line_id: ID;
  item_id: ID;
  batch_id: ID | null;
  code: string | null;
  name: string;
  qty: number;
  price: number;
  discount_rate: number;
  /** What one unit is worth back, the invoice's discount included. */
  unit_net: number;
  line_total: number;
  returned_qty: number;
  returnable_qty: number;
}

export interface ReturnableInvoice {
  invoice: Pick<Invoice, 'id' | 'no' | 'date' | 'type' | 'subtotal' | 'discount_amount' | 'total'>;
  customer: Customer;
  discount_rate: number;
  lines: ReturnableLine[];
}

/** One returned item still with us, offered back to a supplier on a GRN. */
export interface ReturnStockRow {
  sales_return_line_id: ID;
  item_id: ID;
  code: string | null;
  name: string;
  return_no: string | null;
  return_date: string | null;
  customer: string | null;
  returned_qty: number;
  sent_qty: number;
  qty_available: number;
  /** What we paid for it — the cost lot it was bought on. */
  unit_cost: number;
}
