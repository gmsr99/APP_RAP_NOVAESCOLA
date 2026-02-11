import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, School, Users, Building2, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Instituicao {
    id: number;
    nome: string;
}

interface Turma {
    id: number;
    nome: string;
    instituicao_nome: string;
    instituicao_id: number;
}

const Turmas = () => {
    const queryClient = useQueryClient();
    const [isInstDialogOpen, setIsInstDialogOpen] = useState(false);
    const [isTurmaDialogOpen, setIsTurmaDialogOpen] = useState(false);

    // Form states
    const [newInstName, setNewInstName] = useState('');
    const [newTurmaName, setNewTurmaName] = useState('');
    const [selectedInstId, setSelectedInstId] = useState<string>('');

    // Fetch Data
    const { data: instituicoes = [], isLoading: isLoadingInst } = useQuery({
        queryKey: ['instituicoes'],
        queryFn: () => api.get<Instituicao[]>('/api/instituicoes'),
    });

    const { data: turmas = [], isLoading: isLoadingTurmas } = useQuery({
        queryKey: ['turmas'],
        queryFn: () => api.get<Turma[]>('/api/turmas'), // We need a generic endpoint or reuse the dropdown one? 
        // Wait, the service `listar_turmas_com_instituicao` endpoint is NOT exposed as /api/turmas directly?
        // Let's check main.py or if I need to add GET /api/turmas.
        // Looking at main.py: NO GET /api/turmas was added, only POST. 
        // Existing endpoint `get_turmas_dropdown` ? No, in main.py I see `aula_service` routes.
        // Ah, `aula_service` uses `turma_service`? 
        // Wait, I need to check `main.py` again. `listar_turmas_com_instituicao` is NOT exposed.
        // I should add `GET /api/turmas` to main.py as well.
    });

    // Mutations
    const createInstMutation = useMutation({
        mutationFn: (nome: string) => api.post('/api/instituicoes', { nome }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['instituicoes'] });
            setIsInstDialogOpen(false);
            setNewInstName('');
            toast.success('Instituição criada com sucesso!');
        },
        onError: () => toast.error('Erro ao criar instituição.'),
    });

    const createTurmaMutation = useMutation({
        mutationFn: (data: { nome: string; instituicao_id: string }) =>
            api.post('/api/turmas', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['turmas'] });
            setIsTurmaDialogOpen(false);
            setNewTurmaName('');
            setSelectedInstId('');
            toast.success('Turma criada com sucesso!');
        },
        onError: () => toast.error('Erro ao criar turma.'),
    });

    const handleCreateInst = () => {
        if (!newInstName) return;
        createInstMutation.mutate(newInstName);
    };

    const handleCreateTurma = () => {
        if (!newTurmaName || !selectedInstId) return;
        createTurmaMutation.mutate({ nome: newTurmaName, instituicao_id: selectedInstId });
    };

    // Group turmas by institution
    const turmasByInst = instituicoes.map(inst => ({
        ...inst,
        turmas: turmas.filter((t: Turma) => t.instituicao_id === inst.id)
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold">Gestão de Turmas</h1>
                    <p className="text-muted-foreground mt-1">
                        Adiciona novas instituições e turmas ao projeto.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isInstDialogOpen} onOpenChange={setIsInstDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Building2 className="mr-2 h-4 w-4" />
                                Nova Instituição
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Criar Nova Instituição</DialogTitle>
                                <DialogDescription>
                                    Adiciona uma nova escola ou centro parceiro.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="inst-name">Nome da Instituição</Label>
                                    <Input
                                        id="inst-name"
                                        placeholder="Ex: Escola Secundária de..."
                                        value={newInstName}
                                        onChange={(e) => setNewInstName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateInst} disabled={createInstMutation.isPending}>
                                    {createInstMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Criar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isTurmaDialogOpen} onOpenChange={setIsTurmaDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Nova Turma
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Criar Nova Turma</DialogTitle>
                                <DialogDescription>
                                    Adiciona uma nova turma a uma instituição existente.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Instituição</Label>
                                    <Select value={selectedInstId} onValueChange={setSelectedInstId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a instituição" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {instituicoes.map((inst: Instituicao) => (
                                                <SelectItem key={inst.id} value={inst.id.toString()}>
                                                    {inst.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="turma-name">Nome da Turma</Label>
                                    <Input
                                        id="turma-name"
                                        placeholder="Ex: 12º B / Grupo Teatro"
                                        value={newTurmaName}
                                        onChange={(e) => setNewTurmaName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateTurma} disabled={createTurmaMutation.isPending}>
                                    {createTurmaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Criar
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <School className="h-5 w-5" />
                        Estrutura Escolar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingInst || isLoadingTurmas ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Accordion type="multiple" className="w-full">
                            {turmasByInst.map((inst) => (
                                <AccordionItem key={inst.id} value={inst.id.toString()}>
                                    <AccordionTrigger className="hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <Building2 className="h-4 w-4 text-primary" />
                                            <span className="font-medium text-lg">{inst.nome}</span>
                                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full ml-2">
                                                {inst.turmas.length} turmas
                                            </span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="pl-6 space-y-1">
                                            {inst.turmas.length === 0 ? (
                                                <p className="text-sm text-muted-foreground italic py-2">
                                                    Nenhuma turma registada.
                                                </p>
                                            ) : (
                                                inst.turmas.map((turma: Turma) => (
                                                    <div
                                                        key={turma.id}
                                                        className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50"
                                                    >
                                                        <Users className="h-4 w-4 text-muted-foreground" />
                                                        <span>{turma.nome}</span>
                                                    </div>
                                                ))
                                            )}
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

export default Turmas;
