<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Payroll;
use App\Services\NumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = Payroll::query()
            ->with('employee:id,code,name,role')
            ->when($request->input('employee_id'), fn ($q, $e) => $q->where('employee_id', $e))
            ->when($request->input('year'), fn ($q, $y) => $q->where('year', $y))
            ->orderByDesc('year')->orderByDesc('month')->orderByDesc('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * Build (or rebuild) a monthly payslip for an employee:
     *   hours pay = Σ attendance hours in the month × hourly_rate
     *   gross     = basic_salary + hours pay + bonus
     *   net       = gross − deductions
     * Reuses the existing payslip code when regenerating the same month.
     */
    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
            'bonus' => ['nullable', 'numeric', 'min:0'],
        ]);

        $emp = Employee::query()->findOrFail($data['employee_id']);
        $att = Attendance::query()
            ->where('employee_id', $emp->id)
            ->whereYear('date', $data['year'])
            ->whereMonth('date', $data['month'])
            ->get();

        // Split each day's hours into regular vs overtime (beyond the daily
        // standard). Regular hours pay at hourly_rate, OT hours at ot_rate.
        $std = (float) $emp->work_hours;
        $regularHours = 0.0;
        $otHours = 0.0;
        foreach ($att as $a) {
            $h = (float) $a->total_hours;
            if ($std > 0 && $h > $std) {
                $regularHours += $std;
                $otHours += $h - $std;
            } else {
                $regularHours += $h;
            }
        }
        $totalHours = round($regularHours + $otHours, 2);
        $otHours = round($otHours, 2);
        $daysWorked = $att->where('status', '!=', 'absent')->count();
        $basic = (float) $emp->basic_salary;
        $hoursPay = round($regularHours * (float) $emp->hourly_rate, 2);
        $otPay = round($otHours * (float) $emp->ot_rate, 2);
        $bonus = (float) ($data['bonus'] ?? 0);
        $deductions = (float) ($data['deductions'] ?? 0);
        $gross = round($basic + $hoursPay + $otPay + $bonus, 2);
        $net = round($gross - $deductions, 2);

        $existing = Payroll::query()
            ->where(['employee_id' => $emp->id, 'month' => $data['month'], 'year' => $data['year']])
            ->first();

        $payroll = Payroll::query()->updateOrCreate(
            ['employee_id' => $emp->id, 'month' => $data['month'], 'year' => $data['year']],
            [
                'code' => $existing->code ?? NumberService::next(Payroll::class, 'PSL-', 4, 'code'),
                'days_worked' => $daysWorked,
                'total_hours' => $totalHours,
                'ot_hours' => $otHours,
                'basic_salary' => $basic,
                'hours_pay' => $hoursPay,
                'ot_pay' => $otPay,
                'bonus' => $bonus,
                'gross_pay' => $gross,
                'deductions' => $deductions,
                'net_pay' => $net,
                'generated_at' => now(),
            ],
        );

        return response()->json(['data' => $payroll->load('employee:id,code,name,role')], 201);
    }

    public function destroy(Payroll $payroll): JsonResponse
    {
        $payroll->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
