<?php

namespace Database\Factories;

use App\Models\Categoria; // Importa o modelo
use Illuminate\Database\Eloquent\Factories\Factory;

class CategoriaFactory extends Factory
{
    /**
     * O nome do modelo correspondente à factory.
     *
     * @var string
     */
    protected $model = Categoria::class;

    /**
     * Define o estado padrão do modelo.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nome' => $this->faker->word(), // Gera um nome aleatório
            'cor' => $this->faker->hexColor(), // Gera uma cor hex aleatória
        ];
    }
}