-- Sales orders (migration 2026_09_11_000001_create_sales_orders_tables).
-- Migrations are not run on the live server: run this once in phpMyAdmin
-- BEFORE (or together with) deploying the code that uses these tables.
-- Safe to run twice: tables are only created if missing, and the migration
-- row is only added if it is not there yet.

CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `no` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `due_date` date NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `note` text DEFAULT NULL,
  `invoice_id` bigint(20) unsigned DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_orders_no_unique` (`no`),
  KEY `sales_orders_customer_id_foreign` (`customer_id`),
  KEY `sales_orders_invoice_id_foreign` (`invoice_id`),
  KEY `sales_orders_created_by_foreign` (`created_by`),
  KEY `sales_orders_status_due_date_index` (`status`,`due_date`),
  CONSTRAINT `sales_orders_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_orders_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `sales_orders_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_order_lines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sales_order_id` bigint(20) unsigned NOT NULL,
  `item_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `qty` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sales_order_lines_sales_order_id_foreign` (`sales_order_id`),
  KEY `sales_order_lines_item_id_foreign` (`item_id`),
  CONSTRAINT `sales_order_lines_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`),
  CONSTRAINT `sales_order_lines_sales_order_id_foreign` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record the migration so a future `php artisan migrate` skips it. (The batch
-- number is worked out in a derived table: an aggregate over `migrations`
-- always returns one row, so the NOT EXISTS check must sit outside it.)
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_11_000001_create_sales_orders_tables', nb.batch
FROM (SELECT COALESCE(MAX(`batch`), 0) + 1 AS batch FROM `migrations`) AS nb
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_09_11_000001_create_sales_orders_tables'
);
