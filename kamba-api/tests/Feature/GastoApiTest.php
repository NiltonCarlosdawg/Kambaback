<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\Gasto;
use App\Models\Categoria;

class GastoApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_can_create_a_gasto()
    {
        // Usa o método factory() no modelo para criar um dado fictício
        $categoria = Categoria::factory()->create(); // <-- Mude para esta sintaxe simples

        // 2. Envia a requisição POST
        $response = $this->postJson('/api/gastos', [
            'descricao' => 'Almoço com cliente',
            'valor' => 45.50,
            'data' => '2025-10-31',
            'categoria_id' => $categoria->id, // Usa o ID gerado
        ]);

        // 3. Verifica a resposta
        $response->assertStatus(201)
                 ->assertJson(['descricao' => 'Almoço com cliente']);

        // 4. Verifica se o item foi realmente inserido no banco de dados
        $this->assertDatabaseHas('gastos', [
            'descricao' => 'Almoço com cliente'
        ]);
    }
}