const prisma = require("../../../../lib/prisma");

const agregarContexto = async (usuarioId) => {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(
    hoje.getFullYear(),
    hoje.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  const [
    cartoes,
    gastosMes,
    receitasMes,
    objetivos,
    preferencias,
    gastos3Meses,
  ] = await Promise.all([
    prisma.cartao.findMany({
      where: { usuarioId, ativo: true, excluido: false },
      select: { nome: true, saldoAtual: true, tipo: true },
    }),
    prisma.gasto.findMany({
      where: {
        usuarioId,
        data: { gte: inicioMes, lte: fimMes },
        excluido: false,
        tipo: "DESPESA",
      },
      include: { categoria: { select: { nome: true } } },
    }),
    prisma.gasto.aggregate({
      where: {
        usuarioId,
        data: { gte: inicioMes, lte: fimMes },
        excluido: false,
        tipo: "RECEITA",
      },
      _sum: { valor: true },
    }),
    prisma.objetivo.findMany({
      where: { usuarioId, concluido: false, excluido: false },
      select: {
        titulo: true,
        valorAlvo: true,
        valorAtual: true,
        dataPrevista: true,
        prioridade: true,
      },
      orderBy: { dataPrevista: "asc" },
    }),
    prisma.kambaPreferencias.findUnique({ where: { usuarioId } }),
    prisma.gasto.findMany({
      where: {
        usuarioId,
        data: { gte: tresMesesAtras, lt: inicioMes },
        excluido: false,
        tipo: "DESPESA",
      },
      include: { categoria: { select: { nome: true } } },
    }),
  ]);

  // ── SALDOS ─────────────────────────────────
  const saldoTotal = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual), 0);
  const contasDetalhe = cartoes.map((c) => ({
    nome: c.nome,
    tipo: c.tipo,
    saldo: Number(c.saldoAtual),
  }));

  // ── GASTOS ─────────────────────────────────
  const totalGastos = gastosMes.reduce((acc, g) => acc + Number(g.valor), 0);
  const totalReceitas = Number(receitasMes._sum.valor) || 0;

  const porCategoria = {};
  for (const g of gastosMes) {
    const nome = g.categoria?.nome || "Geral";
    porCategoria[nome] = (porCategoria[nome] || 0) + Number(g.valor);
  }
  const categorias = Object.entries(porCategoria)
    .map(([nome, valor]) => ({ nome, valor: Math.round(valor) }))
    .sort((a, b) => b.valor - a.valor);

  // ── PROJECÇÃO ─────────────────────────────
  const diaAtual = hoje.getDate();
  const diasNoMes = fimMes.getDate();
  const mediaDiaria = diaAtual > 0 ? totalGastos / diaAtual : 0;
  const projecaoFimMes = Math.round(mediaDiaria * diasNoMes);

  // ── GASTOS HISTÓRICOS ──────────────────────
  const mesesHist = new Set(
    gastos3Meses.map((g) => `${g.data.getFullYear()}-${g.data.getMonth()}`),
  );
  const mediaGastoMensal =
    mesesHist.size > 0
      ? Math.round(
          gastos3Meses.reduce((acc, g) => acc + Number(g.valor), 0) /
            mesesHist.size,
        )
      : totalGastos;

  // ── OBJECTIVOS ─────────────────────────────
  const objFormatados = objetivos.map((o) => {
    const progresso =
      Number(o.valorAlvo) > 0
        ? Math.round((Number(o.valorAtual) / Number(o.valorAlvo)) * 100)
        : 0;
    return {
      titulo: o.titulo,
      valorAlvo: Number(o.valorAlvo),
      valorAtual: Number(o.valorAtual),
      progresso,
      prioridade: o.prioridade,
      prazo: o.dataPrevista
        ? `${o.dataPrevista.getDate()}/${o.dataPrevista.getMonth() + 1}`
        : null,
    };
  });

  // ── FUNDO EMERGÊNCIA ──────────────────────
  const mesesCobertura =
    mediaGastoMensal > 0 ? saldoTotal / mediaGastoMensal : 0;

  // ── PREFERÊNCIAS ──────────────────────────
  const prefs = preferencias
    ? {
        temNegocio: preferencias.temNegocio,
        preocupaComDolar: preferencias.preocupaComDolar,
        querPoupar: preferencias.querPoupar,
        temDividas: preferencias.temDividas,
        estiloResposta: preferencias.estiloResposta,
        temasFrequentes: preferencias.temasFrequentes,
      }
    : null;

  // ── SITUAÇÃO FINANCEIRA ─────────────────────
  const calcularSituacao = (
    saldoTotal,
    totalGastos,
    renda,
    objetivos,
    numContas,
  ) => {
    if (numContas === 0)
      return { codigo: "sem_dados", detalhe: "Nenhuma conta registada." };
    if (!renda || renda === 0)
      return { codigo: "sem_renda", detalhe: "Renda mensal não configurada." };
    if (saldoTotal <= 0)
      return {
        codigo: "critica",
        detalhe: `Saldo em zero ou negativo com ${objetivos.length} meta(s) activa(s).`,
      };
    if (totalGastos > renda * 1.1)
      return {
        codigo: "critica",
        detalhe: `A gastar ${Math.round((totalGastos / renda) * 100)}% da renda este mês.`,
      };
    if (totalGastos > renda * 0.85)
      return {
        codigo: "atencao",
        detalhe: `${Math.round((totalGastos / renda) * 100)}% da renda já gasta.`,
      };
    if (saldoTotal < totalGastos * 1.5)
      return {
        codigo: "atencao",
        detalhe: "Reserva abaixo de 1.5x os gastos mensais.",
      };
    if (totalGastos < renda * 0.6 && saldoTotal > totalGastos * 3)
      return { codigo: "boa", detalhe: "Margem e reserva confortáveis." };
    return { codigo: "estavel", detalhe: "Situação sob controlo." };
  };

  // Buscar renda do perfil
  const perfil = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { rendaMensalMedia: true },
  });
  const renda = perfil?.rendaMensalMedia ? Number(perfil.rendaMensalMedia) : 0;
  const situacaoFinanceira = calcularSituacao(
    saldoTotal,
    totalGastos,
    renda,
    objFormatados,
    cartoes.length,
  );

  return {
    saldoTotal: Math.round(saldoTotal),
    numContas: cartoes.length,
    contas: contasDetalhe,
    rendaMensal: renda,
    gastosEsteMes: {
      total: Math.round(totalGastos),
      numTransacoes: gastosMes.length,
      categorias: categorias.slice(0, 5),
      totalReceitas: Math.round(totalReceitas),
      poupancaLiquida: Math.round(totalReceitas - totalGastos),
    },
    projecaoFimMes,
    mediaGastoMensal,
    objetivos: objFormatados.slice(0, 5),
    fundoEmergencia: {
      mesesCobertura: Math.round(mesesCobertura * 10) / 10,
      saldo: Math.round(saldoTotal),
    },
    preferencias: prefs,
    situacaoFinanceira,
  };
};

const formatarContextoFinanceiro = (contexto) => {
  if (!contexto) return "";

  const lines = [];
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(" DADOS FINANCEIROS REAIS (BD)");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Saldo
  lines.push(
    `• Saldo total: ${contexto.saldoTotal.toLocaleString("pt-AO")} AOA (${contexto.numContas} ${contexto.numContas === 1 ? "conta" : "contas"})`,
  );
  if (contexto.contas.length > 0) {
    for (const c of contexto.contas) {
      lines.push(`  - ${c.nome}: ${c.saldo.toLocaleString("pt-AO")} AOA`);
    }
  }
  lines.push("");

  // Gastos
  const { gastosEsteMes } = contexto;
  if (gastosEsteMes.total > 0) {
    lines.push(
      `• Gastos este mês: ${gastosEsteMes.total.toLocaleString("pt-AO")} AOA (${gastosEsteMes.numTransacoes} transacções)`,
    );
    for (const cat of gastosEsteMes.categorias) {
      const pct =
        gastosEsteMes.total > 0
          ? Math.round((cat.valor / gastosEsteMes.total) * 100)
          : 0;
      lines.push(
        `  - ${cat.nome}: ${cat.valor.toLocaleString("pt-AO")} AOA (${pct}%)`,
      );
    }
  } else {
    lines.push("• Gastos este mês: nenhum registado");
  }

  if (gastosEsteMes.totalReceitas > 0) {
    lines.push(
      `• Receitas este mês: ${gastosEsteMes.totalReceitas.toLocaleString("pt-AO")} AOA`,
    );
    lines.push(
      `• Poupança líquida: ${gastosEsteMes.poupancaLiquida.toLocaleString("pt-AO")} AOA`,
    );
  } else {
    lines.push("• Receitas este mês: nenhuma registada");
  }
  lines.push("");

  // Projecção
  if (
    gastosEsteMes.total > 0 &&
    contexto.projecaoFimMes > gastosEsteMes.total
  ) {
    lines.push(
      `• Projecção fim do mês: ~${contexto.projecaoFimMes.toLocaleString("pt-AO")} AOA`,
    );
    lines.push("");
  }

  // Objectivos
  if (contexto.objetivos.length > 0) {
    lines.push(`• Objectivos activos: ${contexto.objetivos.length}`);
    for (const obj of contexto.objetivos) {
      lines.push(
        `  - "${obj.titulo}": ${obj.progresso}% concluído (${obj.valorAtual.toLocaleString("pt-AO")} AOA de ${obj.valorAlvo.toLocaleString("pt-AO")} AOA)${obj.prazo ? ` — prazo: ${obj.prazo}` : ""}`,
      );
    }
    lines.push("");
  }

  // Fundo emergência
  if (contexto.fundoEmergencia.mesesCobertura > 0) {
    lines.push(
      `• Fundo emergência: cobre ${contexto.fundoEmergencia.mesesCobertura} ${contexto.fundoEmergencia.mesesCobertura === 1 ? "mês" : "meses"} de gastos`,
    );
    if (contexto.fundoEmergencia.mesesCobertura < 3) {
      lines.push("  ⚠ Abaixo do recomendado (mínimo 3 meses)");
    }
    lines.push("");
  }

  // Preferências
  if (contexto.preferencias) {
    const p = contexto.preferencias;
    const tracos = [];
    if (p.temNegocio) tracos.push("tem negócio próprio");
    if (p.preocupaComDolar) tracos.push("preocupa-se com câmbio/dólar");
    if (p.querPoupar) tracos.push("quer poupar");
    if (p.temDividas) tracos.push("tem dívidas");
    if (p.temasFrequentes?.length > 0)
      tracos.push(`temas frequentes: ${p.temasFrequentes.join(", ")}`);

    if (tracos.length > 0) {
      lines.push(`• Perfil do utilizador: ${tracos.join("; ")}`);
      lines.push("");
    }
  }

  // Nota final
  lines.push(
    "━ IMPORTANTE: Estes dados são da base de dados. Usa-os como referência principal.",
  );
  lines.push(
    "   Se o utilizador mencionar valores diferentes, confronta com estes dados.",
  );
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
};

module.exports = {
  agregarContexto,
  formatarContextoFinanceiro,
};
