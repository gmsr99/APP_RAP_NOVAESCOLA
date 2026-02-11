import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Search,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Loader2
} from 'lucide-react';
import { sessions } from '@/data/mockData';
import { Equipment, EquipmentStatus } from '@/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

// Normalize DB status to keys
const getStatusConfig = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'disponivel') return { label: 'Disponível', icon: CheckCircle2, color: 'text-success bg-success/10' };
  if (normalized === 'em uso' || normalized === 'em_uso') return { label: 'Em uso', icon: Clock, color: 'text-warning bg-warning/10' };
  if (normalized === 'manutencao') return { label: 'Manutenção', icon: AlertTriangle, color: 'text-destructive bg-destructive/10' };
  return { label: status, icon: Package, color: 'text-muted-foreground bg-secondary' };
};

const Equipamento = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: equipmentList, isLoading, error } = useQuery({
    queryKey: ['equipamento'],
    queryFn: () => api.get<Equipment[]>('/api/equipamento'),
  });

  const equipment = equipmentList || [];

  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.type.toLowerCase().includes(searchTerm.toLowerCase());

    // Normalize status for filtering
    const eqStatus = eq.status.toLowerCase();
    const filter = statusFilter.toLowerCase();

    const matchesStatus = filter === 'all' ||
      (filter === 'disponivel' && eqStatus === 'disponivel') ||
      (filter === 'em_uso' && (eqStatus === 'em uso' || eqStatus === 'em_uso')) ||
      (filter === 'manutencao' && eqStatus === 'manutencao');

    return matchesSearch && matchesStatus;
  });

  const getSessionForEquipment = (sessionId?: string) => {
    if (!sessionId) return null;
    return sessions.find(s => s.id === sessionId);
  };

  const getStats = (list: Equipment[]) => {
    return {
      total: list.length,
      disponivel: list.filter(e => e.status.toLowerCase() === 'disponivel').length,
      em_uso: list.filter(e => ['em uso', 'em_uso'].includes(e.status.toLowerCase())).length,
      manutencao: list.filter(e => e.status.toLowerCase() === 'manutencao').length,
    };
  };

  const stats = getStats(equipment);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Erro ao carregar equipamento. Tenta novamente mais tarde.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Gestão de Equipamento</h1>
          <p className="text-muted-foreground mt-1">
            Controla o inventário e disponibilidade de equipamento.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Equipamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats.disponivel}</p>
              <p className="text-sm text-muted-foreground">Disponível</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats.em_uso}</p>
              <p className="text-sm text-muted-foreground">Em uso</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stats.manutencao}</p>
              <p className="text-sm text-muted-foreground">Manutenção</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar equipamento..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === 'disponivel' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('disponivel')}
          >
            Disponível
          </Button>
          <Button
            variant={statusFilter === 'em_uso' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('em_uso')}
          >
            Em uso
          </Button>
          <Button
            variant={statusFilter === 'manutencao' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('manutencao')}
          >
            Manutenção
          </Button>
        </div>
      </div>

      {/* Equipment Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último responsável</TableHead>
                <TableHead>Sessão associada</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEquipment.map((eq) => {
                const status = getStatusConfig(eq.status);
                const StatusIcon = status.icon;
                const session = getSessionForEquipment(eq.assignedToSession);

                return (
                  <TableRow key={eq.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{eq.name}</p>
                          {eq.notes && (
                            <p className="text-xs text-muted-foreground">{eq.notes}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{eq.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        status.color
                      )}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      {eq.lastResponsible ? (
                        <span>{eq.lastResponsible.name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session ? (
                        <span className="text-sm">
                          {session.institution.split(' ').slice(0, 2).join(' ')} - {session.startTime}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Marcar como disponível</DropdownMenuItem>
                          <DropdownMenuItem>Marcar em manutenção</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Equipamento;
