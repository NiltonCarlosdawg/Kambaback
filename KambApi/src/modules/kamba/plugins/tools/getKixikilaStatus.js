const prisma = require('../../../../lib/prisma');

module.exports = {
  name: 'getKixikilaStatus',
  description: 'Busca estado das kixikilas (grupos de poupança colectiva) do utilizador — como organizador ou membro. Inclui próxima vez, contribuições pendentes e histórico.',
  handler: async (_, context) => {
    const usuarioId = context.usuarioId;

    const comoOrganizador = await prisma.kixikila.findMany({
      where: { organizadorId: usuarioId, ativa: true },
      include: {
        membros: {
          include: { usuario: { select: { nome: true } } },
          orderBy: { posicao: 'asc' }
        },
        contribuicoes: {
          where: {
            periodo: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        }
      }
    }).catch(() => []);

    const comoMembro = await prisma.kixikilaMembro.findMany({
      where: { usuarioId, kixikila: { ativa: true } },
      include: {
        kixikila: {
          include: {
            membros: {
              include: { usuario: { select: { nome: true } } },
              orderBy: { posicao: 'asc' }
            },
            contribuicoes: {
              where: {
                periodo: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
              }
            }
          }
        }
      }
    }).catch(() => []);

    if (comoOrganizador.length === 0 && comoMembro.length === 0) {
      return {
        temKixikila: false,
        mensagem: 'Não tens nenhuma kixikila activa. Queres criar um grupo de poupança colectiva?'
      };
    }

    const formatarKixikila = (k, ehOrganizador = false) => {
      const hoje = new Date();
      const totalMembros = k.membros?.length || 0;
      const montantePorCiclo = (k.contribuicaoMensal || 0) * totalMembros;

      const jaReceberam = k.membros?.filter(m => m.jaRecebeu) || [];
      const proxAReceber = k.membros?.find(m => !m.jaRecebeu);

      const contribuicoesMes = k.contribuicoes || [];
      const totalContribuido = contribuicoesMes.reduce((acc, c) => acc + Number(c.valor), 0);
      const pendentes = totalMembros - contribuicoesMes.length;

      return {
        id: k.id,
        nome: k.nome,
        ehOrganizador,
        contribuicaoMensal: Number(k.contribuicaoMensal || 0),
        montantePorCiclo,
        totalMembros,
        cicloActual: k.cicloActual || 1,
        totalCiclos: totalMembros,
        progressoCiclo: `${jaReceberam.length}/${totalMembros}`,
        proxAReceber: proxAReceber ? {
          nome: proxAReceber.usuario?.nome || 'Desconhecido',
          posicao: proxAReceber.posicao,
          montante: montantePorCiclo
        } : null,
        contribuicoesMesActual: {
          pagas: contribuicoesMes.length,
          pendentes,
          totalArrecadado: totalContribuido
        },
        membros: k.membros?.map(m => ({
          nome: m.usuario?.nome || 'Desconhecido',
          posicao: m.posicao,
          jaRecebeu: m.jaRecebeu || false
        })) || []
      };
    };

    return {
      temKixikila: true,
      comoOrganizador: comoOrganizador.map(k => formatarKixikila(k, true)),
      comoMembro: comoMembro.map(m => formatarKixikila(m.kixikila, false)),
      resumo: {
        totalGrupos: comoOrganizador.length + comoMembro.length,
        totalCompromissoMensal: [
          ...comoOrganizador,
          ...comoMembro.map(m => m.kixikila)
        ].reduce((acc, k) => acc + Number(k.contribuicaoMensal || 0), 0)
      }
    };
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
