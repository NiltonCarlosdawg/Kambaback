<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Categoria;
use App\Models\Gasto;
use App\Models\Objetivo;
use Illuminate\Support\Facades\DB;

class InsightController extends Controller
{
    // Para um gráfico de pizza (PizzaChart)
    public function gastosPorCategoria()
    {
        $dados = Categoria::withSum('gastos', 'valor')
            ->get()
            ->map(fn($cat) => [
                'name' => $cat->nome,
                'value' => (float) $cat->gastos_sum_valor ?? 0
            ]);

        return response()->json($dados);
    }

    // Para um gráfico de barras (BarChart)
    public function progressoObjetivos()
    {
        $dados = Objetivo::all()->map(fn($obj) => [
            'name' => $obj->titulo,
            'alvo' => (float) $obj->valor_alvo,
            'atual' => (float) $obj->valor_atual,
        ]);

        return response()->json($dados);
    }

    // Para um gráfico de linha (LineChart)
    public function gastosAoLongoDoTempo()
    {
        $dados = Gasto::select(
                DB::raw('DATE_FORMAT(data, "%Y-%m-%d") as name'),
                DB::raw('SUM(valor) as total')
            )
            ->groupBy('name')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json($dados);
    }
}