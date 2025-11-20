<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
       Schema::create('objetivos', function (Blueprint $table) {
    $table->id();
    $table->string('titulo');
    $table->decimal('valor_alvo', 10, 2);
    $table->decimal('valor_atual', 10, 2)->default(0);
    $table->date('data_limite')->nullable();
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('objetivos');
    }
};
