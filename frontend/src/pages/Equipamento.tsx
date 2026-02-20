import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Package,
  CheckCircle2,
  Clock,
  Loader2,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { KitCategoria } from '@/types';
import { format, parseISO, addMinutes, isAfter } from 'date-fns';
import { pt } from 'date-fns/locale';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Ocupacao {
  aula_id: number;
  data_hora: string;
  duracao_minutos: number;
  turma_nome: string | null;
  estabelecimento_nome: string | null;
}

interface ItemComOcupacao {
  id: number;
  nome: string;
  ocupacoes: Ocupacao[];
  ocupadoAgora: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const Equipamento = () => {
  // Fetch categories with items
  const { data: categorias, isLoading } = useQuery<KitCategoria[]>({
    queryKey: ['equipamento-categorias'],
    queryFn: async () => {
      const res = await api.get('/api/equipamento/categorias');
      return res.data;
    },
  });

  // Fetch all sessions that have equipment assigned (for occupation info)
  const { data: todasAulas } = useQuery<any[]>({
    queryKey: ['aulas-para-equipamento'],
    queryFn: async () => {
      const res = await api.get('/api/aulas');
      return res.data;
    },
  });

  // For each category, build item occupation info
  const buildItemsWithOcupacao = (cat: KitCategoria): ItemComOcupacao[] => {
    return cat.itens.map(item => {
      // We'd need per-item occupation data. For now, show basic info.
      return {
        id: item.id,
        nome: item.nome,
        ocupacoes: [],
        ocupadoAgora: false,
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cats = categorias || [];
  const totalItens = cats.reduce((acc, c) => acc + c.itens.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Gestão de Equipamento</h1>
        <p className="text-muted-foreground mt-1">
          Kits de material organizados por categoria.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{cats.length}</p>
              <p className="text-sm text-muted-foreground">Categorias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10">
              <Package className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{totalItens}</p>
              <p className="text-sm text-muted-foreground">Itens no total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kits de Material
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma categoria de equipamento encontrada.
            </p>
          ) : (
            <Accordion type="multiple" className="w-full" defaultValue={cats.map(c => String(c.id))}>
              {cats.map(cat => (
                <AccordionItem key={cat.id} value={String(cat.id)}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Layers className="h-4 w-4 text-primary" />
                      <span className="font-medium text-lg">{cat.nome}</span>
                      <Badge variant="secondary" className="ml-2">
                        {cat.itens.length} {cat.itens.length === 1 ? 'item' : 'itens'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-7">
                      {cat.itens.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{item.nome}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Disponível
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Equipamento;
