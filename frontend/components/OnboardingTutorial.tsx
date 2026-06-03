import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  LayoutDashboard,
  MessageCircle,
  Palette,
  Target,
  Wallet,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type TutorialUser = {
  nome?: string;
  email?: string;
  rendaMensalMedia?: number;
};

interface OnboardingTutorialProps {
  user: TutorialUser | null;
  onComplete: () => void;
}

type TutorialStep = {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  icon: React.ElementType;
};

const STEP_VARIANTS = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 24 : -24,
    filter: 'blur(4px)',
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -24 : 24,
    filter: 'blur(4px)',
  }),
};

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ user, onComplete }) => {
  const { formatMoney } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const firstName = user?.nome?.split(' ')[0] || 'kamba';
  const monthlyIncome = user?.rendaMensalMedia ?? 0;
  const suggestedSavings = monthlyIncome > 0 ? formatMoney(monthlyIncome * 0.2, false) : '';

  const steps: TutorialStep[] = [
    {
      eyebrow: '1 · Visão geral',
      title: `Bem-vindo, ${firstName}. Vamos começar pelo painel.`,
      description: 'O Dashboard é a tua base diária. Ele mostra rapidamente o que entra, o que sai e se estás no caminho certo.',
      points: [
        'Vês saldo, receitas, despesas e poupança sem perder tempo.',
        'Os alertas ajudam a perceber riscos antes de virarem problema.',
        'É o melhor ponto de partida sempre que entras na app.',
      ],
      icon: LayoutDashboard,
    },
    {
      eyebrow: '2 · Movimentos',
      title: 'Regista cada transação e liga-a ao cartão certo.',
      description: 'As transações alimentam todo o resto da app. Quanto mais completas estiverem, mais úteis ficam os relatórios e sugestões.',
      points: [
        'Regista receitas e despesas assim que acontecem.',
        'Associa cada movimento ao cartão ou conta correta.',
        'Filtra e revê o histórico para descobrir padrões de consumo.',
      ],
      icon: ArrowLeftRight,
    },
    {
      eyebrow: '3 · Organização',
      title: 'Usa carteira, categorias e objetivos para dar ordem ao dinheiro.',
      description: 'A estrutura financeira fica mais clara quando separas gastos, metas e saldos por contexto.',
      points: [
        'A Carteira centraliza cartões e contas num único sítio.',
        'Categorias mostram onde o dinheiro está a sair mais depressa.',
        'Objetivos transformam intenção em progresso visível.',
      ],
      icon: Wallet,
    },
    {
      eyebrow: '4 · Personalização',
      title: 'Ajusta a experiência ao teu estilo de trabalho.',
      description: 'Antes de mergulhar no uso diário, vale a pena afinar a interface para ficar mais cómoda e mais tua.',
      points: [
        'Escolhe tema, cor de destaque, idioma e layout da dashboard.',
        'Mostra ou esconde valores quando quiseres mais privacidade.',
        'Ativa notificações e define a moeda que faz mais sentido para ti.',
        monthlyIncome > 0
          ? `Com a tua renda atual, uma meta inicial de poupança de cerca de ${suggestedSavings} já é um bom ponto de partida.`
          : 'Completar o perfil ajuda o Kamba AI a dar conselhos mais precisos e personalizados.',
      ],
      icon: Palette,
    },
    {
      eyebrow: '5 · Apoio inteligente',
      title: 'O Kamba AI e o Perfil completam a experiência.',
      description: 'O assistente responde em linguagem natural e usa o teu contexto para ser mais útil. O perfil mantém os dados base limpos e atualizados.',
      points: [
        'Faz perguntas como “Quanto gastei este mês?” ou “Estou a poupar o suficiente?”',
        'Atualiza renda, morada e dados pessoais no Perfil para melhorar as recomendações.',
        'Quando terminares, a app abre na área de Personalização para fechar a configuração inicial.',
      ],
      icon: MessageCircle,
    },
  ];

  const activeStep = steps[stepIndex];
  const totalSteps = steps.length;
  const progress = ((stepIndex + 1) / totalSteps) * 100;
  const Icon = activeStep.icon;

  const goToStep = (nextIndex: number) => {
    if (nextIndex === stepIndex) return;
    setDirection(nextIndex > stepIndex ? 1 : -1);
    setStepIndex(nextIndex);
  };

  const handleNext = () => {
    if (stepIndex === totalSteps - 1) {
      onComplete();
      return;
    }
    goToStep(stepIndex + 1);
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    goToStep(stepIndex - 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-32 -right-28 h-96 w-96 rounded-full blur-[120px]"
          style={{ backgroundColor: 'var(--accent)', opacity: 0.14 }}
        />
        <div
          className="absolute bottom-0 -left-28 h-80 w-80 rounded-full blur-[120px]"
          style={{ backgroundColor: 'var(--accent)', opacity: 0.1 }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.22) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--accent)' }}>
              <svg fill="black" viewBox="0 0 48 48" className="h-5 w-5">
                <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--text-faint)' }}>
                Primeiro acesso
              </p>
              <h1 className="text-lg font-bold tracking-tight">KambaPro</h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 rounded-full border px-4 py-2 text-xs font-semibold sm:flex" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Sparkles size={14} style={{ color: 'var(--accent)' }} />
            Tutorial guiado em 5 passos
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 py-6 lg:flex-row">
          <aside className="lg:w-80">
            <div className="rounded-3xl border p-5 shadow-2xl" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--text-faint)' }}>
                  Progresso
                </p>
                <div className="mt-3 h-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
                  Etapa {stepIndex + 1} de {totalSteps}
                </p>
              </div>

              <div className="space-y-2">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === stepIndex;
                  const isDone = index < stepIndex;

                  return (
                    <div
                      key={step.eyebrow}
                      className="flex items-start gap-3 rounded-2xl border px-3 py-3"
                      style={{
                        backgroundColor: isActive ? 'var(--accent-10)' : 'transparent',
                        borderColor: isActive ? 'var(--accent-20)' : 'var(--border)',
                      }}
                    >
                      <div
                        className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-elevated)',
                          color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                        }}
                      >
                        {isDone ? <CheckCircle2 size={18} /> : <StepIcon size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: isActive ? 'var(--accent)' : 'var(--text-faint)' }}>
                          {step.eyebrow}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                          {step.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="flex-1">
            <div className="rounded-[2rem] border p-5 shadow-2xl sm:p-7 lg:p-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border" style={{ backgroundColor: 'var(--accent-10)', borderColor: 'var(--accent-20)' }}>
                    <Icon size={26} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--text-faint)' }}>
                      {activeStep.eyebrow}
                    </p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{activeStep.title}</h2>
                  </div>
                </div>

                <div className="hidden rounded-full border px-4 py-2 text-xs font-semibold md:block" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
                  Não tens de decorar tudo. Usa este guia como ponto de partida.
                </div>
              </div>

              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeStep.eyebrow}
                  custom={direction}
                  variants={STEP_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
                >
                  <div className="space-y-5">
                    <p className="max-w-2xl text-base leading-7" style={{ color: 'var(--text-muted)' }}>
                      {activeStep.description}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {activeStep.points.map((point) => (
                        <div
                          key={point}
                          className="rounded-2xl border p-4"
                          style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)' }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--accent-10)' }}>
                              <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
                            </div>
                            <p className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                              {point}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border p-5" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)' }}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--accent-10)' }}>
                          <UserRound size={20} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--text-faint)' }}>
                            Personalização rápida
                          </p>
                          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Ajusta a app ao teu estilo
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
                        <p>• Tema, cor, layout e idioma vão definir a cara da tua experiência.</p>
                        <p>• Valores visíveis ou mascarados ajudam-te a equilibrar privacidade e rapidez.</p>
                        <p>• Notificações e moeda ficam mais úteis quando estão alinhadas com a tua rotina.</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border p-5" style={{ backgroundColor: 'var(--accent-10)', borderColor: 'var(--accent-20)' }}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--accent)' }}>
                          <Target size={18} style={{ color: 'var(--accent-text)' }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                            Dica do Kamba
                          </p>
                          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                            {monthlyIncome > 0
                              ? `Com a tua renda atual, reservar cerca de ${suggestedSavings} por mês é um bom início para criar folga financeira.`
                              : 'Completa o teu Perfil depois do tutorial para o Kamba AI sugerir metas e conselhos mais realistas.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
                  Este guia aparece só no primeiro acesso de cada conta.
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={stepIndex === 0}
                    className="flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <ArrowLeft size={16} />
                    Anterior
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}
                  >
                    {stepIndex === totalSteps - 1 ? 'Abrir personalização' : 'Próximo'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
