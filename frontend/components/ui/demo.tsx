import { RuixenStatsChart as RuixenStats } from "@/components/ui/ruixen-stats";

export default function DemoOne() {
  return (
    <RuixenStats
      data={[
        { name: 'Jan', value: 4000 },
        { name: 'Fev', value: 3000 },
        { name: 'Mar', value: 5000 },
        { name: 'Abr', value: 4500 },
      ]}
      heroValue={12400}
      heroLabel="Receita total"
      sideStats={[
        { value: 'R$ 3.2k', label: 'Despesas' },
        { value: 'R$ 8.9k', label: 'Poupança' },
      ]}
    />
  );
}
