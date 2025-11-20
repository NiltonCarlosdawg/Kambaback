<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Gasto;
use Illuminate\Http\Request;

class GastoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        // 1. Validação dos dados (Recomendado)
        $validatedData = $request->validate([
            'descricao' => 'required|string|max:255',
            'valor' => 'required|numeric|min:0.01',
            'data' => 'required|date',
            'categoria_id' => 'required|exists:categorias,id',
        ]);

        // 2. Criação e Salvamento
        $gasto = Gasto::create($validatedData);

        // 3. RETORNO COM STATUS 201
        // Ao passar o 201 como segundo parâmetro, você define o status HTTP.
        return response()->json($gasto, 201); // <-- MUDANÇA AQUI!
    }
    public function show(Gasto $gasto)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Gasto $gasto)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Gasto $gasto)
    {
        //
    }
}
