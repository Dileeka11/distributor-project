<?php
/**
 * One-time Laravel setup runner for shared hosting (no SSH/Terminal).
 *
 * USAGE:
 *   1. Set SETUP_TOKEN below to a long random string.
 *   2. Visit: http://api.kadurata-kuda.sourcecode.lk/_setup.php?token=YOUR_TOKEN&cmd=key
 *   3. Run each cmd in order: key, migrate, storagelink, cache, perms
 *   4. DELETE THIS FILE when done.
 */

const SETUP_TOKEN = 'k7Hx9pQ2mNvBdLs8wYr4Zc3JfTgVnE6a';

if (!isset($_GET['token']) || !hash_equals(SETUP_TOKEN, (string) $_GET['token'])) {
    http_response_code(403);
    exit('Forbidden');
}

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

function runArtisan($kernel, array $args): string {
    $output = new Symfony\Component\Console\Output\BufferedOutput();
    $status = $kernel->call($args[0], array_slice($args, 1), $output);
    return "[exit=$status]\n" . $output->fetch();
}

header('Content-Type: text/plain; charset=utf-8');

$cmd = $_GET['cmd'] ?? 'help';

switch ($cmd) {
    case 'key':
        echo runArtisan($kernel, ['key:generate', '--force' => true]);
        break;

    case 'migrate':
        echo runArtisan($kernel, ['migrate', '--force' => true]);
        break;

    case 'seed':
        echo runArtisan($kernel, ['db:seed', '--force' => true]);
        break;

    case 'storagelink':
        echo runArtisan($kernel, ['storage:link']);
        break;

    case 'cache':
        echo runArtisan($kernel, ['config:cache']);
        echo runArtisan($kernel, ['route:cache']);
        echo runArtisan($kernel, ['view:cache']);
        break;

    case 'clearcache':
        echo runArtisan($kernel, ['config:clear']);
        echo runArtisan($kernel, ['route:clear']);
        echo runArtisan($kernel, ['view:clear']);
        echo runArtisan($kernel, ['cache:clear']);
        break;

    case 'perms':
        $paths = [__DIR__ . '/../storage', __DIR__ . '/../bootstrap/cache'];
        foreach ($paths as $p) {
            $ok = @chmod($p, 0775);
            echo "chmod 0775 $p => " . ($ok ? 'OK' : 'FAILED') . "\n";
            $iter = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($p, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );
            foreach ($iter as $item) {
                @chmod($item->getPathname(), $item->isDir() ? 0775 : 0664);
            }
        }
        echo "Done.\n";
        break;

    case 'info':
        echo "PHP: " . PHP_VERSION . "\n";
        echo "Laravel: " . app()->version() . "\n";
        echo "Env: " . app()->environment() . "\n";
        echo "Debug: " . (config('app.debug') ? 'true' : 'false') . "\n";
        echo "DB: " . config('database.default') . " -> " . config('database.connections.' . config('database.default') . '.database') . "\n";
        try {
            DB::connection()->getPdo();
            echo "DB connection: OK\n";
        } catch (\Throwable $e) {
            echo "DB connection: FAILED - " . $e->getMessage() . "\n";
        }
        break;

    default:
        echo "Available commands (add &cmd=... to URL):\n";
        echo "  info         - show PHP/Laravel/DB info & test DB connection\n";
        echo "  key          - generate APP_KEY\n";
        echo "  migrate      - run database migrations\n";
        echo "  seed         - run database seeders\n";
        echo "  storagelink  - create public/storage symlink\n";
        echo "  cache        - cache config + routes + views (production)\n";
        echo "  clearcache   - clear all caches\n";
        echo "  perms        - fix storage + bootstrap/cache permissions\n";
}
