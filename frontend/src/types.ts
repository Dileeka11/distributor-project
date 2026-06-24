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
  name: string;
  qty: string | number;
  price: string | number;
  total: string | number;
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
  status: TxnStatus;
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

export interface GrnLine {
  id?: ID;
  item_id: ID;
  name: string;
  qty: string | number;
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
  status: TxnStatus;
  lines?: GrnLine[];
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

export interface User { id: ID; name: string; email: string; }

export interface DashboardPayload {
  totals: {
    sales: number; cash: number; credit: number;
    receivable: number; payable: number; low_stock_count: number;
  };
  low_stock: Pick<Item, 'id' | 'code' | 'name' | 'stock'>[];
  recent_invoices: Invoice[];
  top_receivables: Pick<Customer, 'id' | 'code' | 'name' | 'credit_limit' | 'balance'>[];
  sales_series: { date: string; label: string; cash: number; credit: number; }[];
  inventory_by_category: { label: string; value: number; }[];
}
