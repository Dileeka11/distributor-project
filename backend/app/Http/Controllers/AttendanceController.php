<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = Attendance::query()
            ->with('employee:id,code,name,role')
            ->when($request->input('date'), fn ($q, $d) => $q->whereDate('date', $d))
            ->when($request->input('employee_id'), fn ($q, $e) => $q->where('employee_id', $e))
            ->orderByDesc('date')->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * Clock in / out for today. The first tap records clock-in; the second records
     * clock-out and computes the hours worked for the day.
     */
    public function clock(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            // The client sends its own wall-clock date/time so the recorded times
            // match the live clock the user sees (server may be on a different TZ).
            'date' => ['nullable', 'date'],
            'time' => ['nullable', 'date_format:H:i:s'],
        ]);

        $att = Attendance::firstOrNew([
            'employee_id' => $data['employee_id'],
            'date' => $data['date'] ?? Carbon::today()->toDateString(),
        ]);
        $now = $data['time'] ?? Carbon::now()->format('H:i:s');

        if (! $att->clock_in) {
            // Recording a check-in (and its time) is admin-only; other users may
            // only mark the check-out of an already-clocked-in employee.
            abort_unless((bool) optional($request->user())->is_admin, 403, 'Only an admin can record a check-in.');
            $att->fill(['clock_in' => $now, 'clock_out' => null, 'status' => 'present', 'total_hours' => 0]);
        } elseif (! $att->clock_out) {
            $att->clock_out = $now;
            $att->total_hours = $this->hours($att->clock_in, $now);
        } else {
            abort(422, 'Already clocked in and out for today.');
        }
        $att->save();

        return response()->json(['data' => $att->load('employee:id,code,name,role')]);
    }

    /** Manual create / correct an attendance row for any employee & date. */
    public function store(Request $request): JsonResponse
    {
        // Manual entry sets the check-in time — admin only.
        abort_unless((bool) optional($request->user())->is_admin, 403, 'Only an admin can add or correct attendance times.');

        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'date' => ['required', 'date'],
            'clock_in' => ['nullable', 'date_format:H:i'],
            'clock_out' => ['nullable', 'date_format:H:i'],
            'status' => ['nullable', 'string', 'max:20'],
        ]);

        $in = ! empty($data['clock_in']) ? $data['clock_in'].':00' : null;
        $out = ! empty($data['clock_out']) ? $data['clock_out'].':00' : null;

        $att = Attendance::updateOrCreate(
            ['employee_id' => $data['employee_id'], 'date' => $data['date']],
            [
                'clock_in' => $in,
                'clock_out' => $out,
                'status' => $data['status'] ?? 'present',
                'total_hours' => ($in && $out) ? $this->hours($in, $out) : 0,
            ],
        );

        return response()->json(['data' => $att->load('employee:id,code,name,role')]);
    }

    public function destroy(Attendance $attendance): JsonResponse
    {
        $attendance->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /** Hours between two H:i:s times, wrapping past midnight for overnight shifts. */
    private function hours(string $in, string $out): float
    {
        [$ih, $im] = array_map('intval', explode(':', substr($in, 0, 5)));
        [$oh, $om] = array_map('intval', explode(':', substr($out, 0, 5)));
        $mins = ($oh * 60 + $om) - ($ih * 60 + $im);
        if ($mins < 0) {
            $mins += 24 * 60;
        }

        return round($mins / 60, 2);
    }
}
