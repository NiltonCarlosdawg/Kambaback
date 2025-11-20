<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\CategoriaController;
use App\Http\Controllers\Api\GastoController;
use App\Http\Controllers\Api\ObjetivoController;
use App\Http\Controllers\Api\NoticiaController;
use App\Http\Controllers\Api\InsightController; // Criaremos este

// Rotas CRUD padrão
Route::apiResource('categorias', CategoriaController::class);
Route::apiResource('gastos', GastoController::class);
Route::apiResource('objetivos', ObjetivoController::class);
Route::apiResource('noticias', NoticiaController::class);

// Rotas especiais para a InsightsPage (com recharts)
Route::prefix('insights')->group(function () {
    Route::get('gastos-por-categoria', [InsightController::class, 'gastosPorCategoria']);
    Route::get('progresso-objetivos', [InsightController::class, 'progressoObjetivos']);
    Route::get('gastos-ao-longo-do-tempo', [InsightController::class, 'gastosAoLongoDoTempo']);
});

// (Opcional) Autenticação com Laravel Sanctum
// Route::post('/register', [AuthController::class, 'register']);
// Route::post('/login', [AuthController::class, 'login']);
// Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
//     return $request->user();
// });

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});