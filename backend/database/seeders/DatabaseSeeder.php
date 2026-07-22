<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Item;
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@medistock.lk'],
            ['name' => 'System Admin', 'password' => Hash::make('demo1234')],
        );

        $categories = ['Antibiotics', 'Analgesics', 'Antacids', 'Vitamins & Supplements', 'Cardiac', 'Dermatology', 'Cough & Cold', 'Diabetes Care'];
        foreach ($categories as $name) {
            Category::query()->firstOrCreate(['name' => $name]);
        }
        $cats = Category::query()->pluck('id', 'name');

        $items = [
            ['AA0012', 'Paracetamol 500mg', 'Analgesics', 2.10, 2.75, 3.50, 4200],
            ['AB0048', 'Amoxicillin 250mg Cap', 'Antibiotics', 6.40, 7.90, 10.00, 1860],
            ['AC0103', 'Cetirizine 10mg', 'Cough & Cold', 1.20, 1.75, 2.50, 320],
            ['AD0211', 'Omeprazole 20mg', 'Antacids', 4.80, 6.10, 8.00, 2750],
            ['AE0077', 'Metformin 500mg', 'Diabetes Care', 2.90, 3.80, 5.00, 95],
            ['AF0150', 'Vitamin C 1000mg', 'Vitamins & Supplements', 5.50, 7.20, 9.50, 1410],
            ['AG0302', 'Atorvastatin 10mg', 'Cardiac', 8.20, 10.40, 14.00, 640],
            ['AH0419', 'Azithromycin 500mg', 'Antibiotics', 22.00, 27.50, 35.00, 0],
            ['AI0088', 'Ibuprofen 400mg', 'Analgesics', 3.10, 4.00, 5.50, 3300],
            ['AJ0521', 'Hydrocortisone Cream 1%', 'Dermatology', 48.00, 60.00, 78.00, 210],
            ['AK0144', 'Salbutamol Inhaler', 'Cough & Cold', 145.00, 178.00, 230.00, 78],
            ['AL0233', 'Losartan 50mg', 'Cardiac', 6.90, 8.60, 11.50, 1190],
        ];
        foreach ($items as [$code, $name, $cat, $dp, $wp, $rp, $stock]) {
            Item::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $name,
                    'category_id' => $cats[$cat],
                    'distributor_price' => $dp,
                    'wholesale_price' => $wp,
                    'retail_price' => $rp,
                    'stock' => $stock,
                ],
            );
        }

        $suppliers = [
            ['SUP-001', 'Lanka Pharma Imports (Pvt) Ltd', 'Nuwan Perera', '011 234 5678', 'orders@lankapharma.lk', '142 Galle Rd, Colombo 03', 30, 685400],
            ['SUP-002', 'Ceylon Medico Distributors', 'Fathima Rizwan', '011 555 9023', 'supply@ceylonmedico.lk', '08 Hospital St, Colombo 01', 45, 0],
            ['SUP-003', 'Hemas Pharmaceuticals', 'Dilan Jayasuriya', '011 463 1200', 'trade@hemaspharma.lk', 'Welisara, Ragama', 30, 248900],
            ['SUP-004', 'George Steuart Health', 'Amila Silva', '011 470 8800', 'b2b@gsh.lk', 'Vauxhall St, Colombo 02', 60, 132500],
            ['SUP-005', 'Sunshine Healthcare Lanka', 'Kasun Bandara', '038 222 4411', 'sales@sunshine.lk', 'Panadura', 30, 0],
        ];
        foreach ($suppliers as [$code, $name, $contact, $phone, $email, $address, $terms, $payable]) {
            Supplier::query()->updateOrCreate(
                ['code' => $code],
                compact('name', 'contact', 'phone', 'email', 'address') + ['terms_days' => $terms, 'payable' => $payable],
            );
        }

        $customers = [
            ['CUS-1001', 'City Care Pharmacy', 'Roshan Fernando', '077 123 4567', 'citycare@gmail.com', '23 Main St, Kandy', 'Pharmacy', 500000, 318500],
            ['CUS-1002', 'Nawaloka Medical Centre', 'Priya Wickrama', '071 880 2231', 'purchasing@nawaloka.lk', 'Negombo Rd, Wattala', 'Hospital', 1200000, 742000],
            ['CUS-1003', 'Green Cross Pharmacy', 'Sanjeewa Kumar', '076 540 1122', 'greencross@gmail.com', 'Galle Fort, Galle', 'Pharmacy', 300000, 0],
            ['CUS-1004', 'Wellness Plus Chain', 'Amaya Senanayake', '070 998 7766', 'ap@wellnessplus.lk', 'Union Place, Colombo 02', 'Chain', 2000000, 1485000],
            ['CUS-1005', 'Suwa Sevana Pharmacy', 'Mohamed Aslam', '075 332 1190', 'suwasevana@gmail.com', 'Kurunegala', 'Pharmacy', 250000, 96400],
            ['CUS-1006', 'Lifeline Drugstore', 'Tharindu Perera', '078 445 6677', 'lifeline@gmail.com', 'Matara', 'Pharmacy', 400000, 0],
        ];
        foreach ($customers as [$code, $name, $contact, $phone, $email, $address, $type, $limit, $balance]) {
            Customer::query()->updateOrCreate(
                ['code' => $code],
                compact('name', 'contact', 'phone', 'email', 'address', 'type') + ['credit_limit' => $limit, 'balance' => $balance],
            );
        }

        Setting::setMany([
            'company' => 'Kadurata Kuda',
            'logo' => 'M',
            'accent' => '#C8102E',
            'accent_press' => '#a60d26',
            'mode' => 'light',
            'currency' => 'LKR',
            'symbol' => 'Rs',
            'tax_rate' => 8,
            'invoice_prefix' => 'INV',
            'phone' => '011 234 5678',
            'email' => 'hello@medistock.lk',
            'vat_no' => '134000000-7000',
            'address' => 'Colombo, Sri Lanka',
        ]);
    }
}
